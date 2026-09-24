#!/usr/bin/env node

import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
    assertDevTarget,
    assertEqual,
    assertErrorCode,
    assertStatus,
    assertTruthy,
    CleanupStack,
    cognitoAuthArgs,
    generateRunId,
    parseMode,
    parseStackOutputs,
    redactSensitive,
    resolveAwsProfile,
    sanitizedAwsCliError
} from "./integration-test-helpers.mjs";

const DEFAULTS = Object.freeze({
    region: "us-east-2",
    stackName: "evrenthia-dev"
});

const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const assertObject = (value, label) => assertTruthy(isObject(value), `${label} must be an object`);
const assertArray = (value, label) => assertTruthy(Array.isArray(value), `${label} must be an array`);
const assertNumber = (value, label) => assertTruthy(typeof value === "number" && Number.isFinite(value), `${label} must be numeric`);
const boolEnv = (name) => process.env[name]?.toLowerCase() === "true";

function makeReporter(secrets) {
    const counts = { passed: 0, skipped: 0, failed: 0 };
    return {
        counts,
        async step(label, check) {
            try {
                const result = await check();
                counts.passed++;
                console.log(`PASS ${label}`);
                return result;
            } catch (error) {
                counts.failed++;
                console.error(`FAIL ${label}: ${redactSensitive(error?.message ?? error, secrets)}`);
                throw error;
            }
        },
        skip(label, reason) {
            counts.skipped++;
            console.log(`SKIP ${label}: ${reason}`);
        },
        cleanupFailure(label, error) {
            counts.failed++;
            console.error(`FAIL cleanup ${label}: ${redactSensitive(error?.message ?? error, secrets)}`);
        }
    };
}

function spawnAws(args, secrets = [], { stderrOnly = false } = {}) {
    const result = spawnSync("aws", args, {
        encoding: "utf8",
        maxBuffer: 10 * 1024 * 1024
    });
    if (result.error) throw new Error(`AWS CLI failed to start: ${result.error.message}`);
    if (result.status !== 0) {
        throw sanitizedAwsCliError(result.stderr || (!stderrOnly && result.stdout) || `exit ${result.status}`, secrets);
    }
    return result.stdout.trim();
}

function runAws(args, { profile, region, secrets = [] }) {
    const profileArgs = profile ? ["--profile", profile] : [];
    const output = spawnAws([
        ...args,
        ...profileArgs,
        "--region", region,
        "--output", "json"
    ], secrets);
    return output ? JSON.parse(output) : {};
}

function discoverStack(config, secrets) {
    const raw = runAws([
        "cloudformation", "describe-stacks",
        "--stack-name", config.stackName,
        "--query", "Stacks[0].Outputs"
    ], { ...config, secrets });
    const outputs = parseStackOutputs(raw);
    const apiUrl = outputs.DevApiUrl ?? outputs.ApiUrl;
    const tableName = outputs.DevTableName;
    const userPoolId = outputs.DevUserPoolId;
    const clientId = outputs.DevUserPoolClientId;
    const functionNames = [outputs.GetMeFunctionName, outputs.CreateProfileFunctionName].filter(Boolean);

    for (const [name, value] of Object.entries({ apiUrl, tableName, userPoolId, clientId })) {
        if (!value) throw new Error(`Stack output ${name} is missing.`);
    }
    if (!userPoolId.startsWith(`${config.region}_`)) {
        throw new Error("Refusing Cognito user pool output that does not match the selected AWS region.");
    }
    assertDevTarget({ ...config, apiUrl, tableName, functionNames });
    return { outputs, apiUrl: apiUrl.replace(/\/$/, ""), tableName, userPoolId, clientId };
}

function authenticate(target, config, email, password) {
    const token = spawnAws(cognitoAuthArgs({
        region: config.region,
        clientId: target.clientId,
        email,
        password,
        profile: config.profile
    }), [email, password], { stderrOnly: true });
    if (!token || token === "None" || token === "null") throw new Error("Cognito did not return an ID token.");
    return token;
}

function createApi(apiUrl, token, secrets) {
    return async function request(method, path, options = {}) {
        const headers = { Accept: "application/json", ...options.headers };
        if (options.auth !== false) headers.Authorization = `Bearer ${token}`;
        let body;
        if (Object.hasOwn(options, "rawBody")) {
            body = options.rawBody;
            headers["Content-Type"] ??= "application/json";
        } else if (Object.hasOwn(options, "body")) {
            body = JSON.stringify(options.body);
            headers["Content-Type"] ??= "application/json";
        }

        let response;
        try {
            response = await fetch(`${apiUrl}${path}`, {
                method,
                headers,
                body,
                signal: AbortSignal.timeout(30_000)
            });
        } catch (error) {
            throw new Error(`${method} ${path} failed: ${redactSensitive(error?.message ?? error, secrets)}`);
        }
        const text = await response.text();
        let parsed = null;
        if (text) {
            try { parsed = JSON.parse(text); }
            catch { parsed = text; }
        }
        return { status: response.status, body: parsed, headers: response.headers };
    };
}

function assertNoStorageKeys(value, path = "response") {
    if (!value || typeof value !== "object") return;
    for (const [key, child] of Object.entries(value)) {
        assertTruthy(key !== "PK" && key !== "SK", `${path} must not expose ${key}`);
        assertNoStorageKeys(child, `${path}.${key}`);
    }
}

function deterministicDeviceId(email) {
    const bytes = Buffer.from(createHash("sha256").update(`evrenthia-integration-device\0${email.toLowerCase()}`).digest().subarray(0, 16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = bytes.toString("hex");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function localTimeAhead(timeZone, minutes) {
    const parts = new Intl.DateTimeFormat("en-GB", {
        timeZone,
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23"
    }).formatToParts(new Date(Date.now() + minutes * 60_000));
    const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
    return `${values.hour}:${values.minute}`;
}

function notificationWorkerIsDryRun(config, secrets) {
    const resource = runAws([
        "cloudformation", "describe-stack-resource",
        "--stack-name", config.stackName,
        "--logical-resource-id", "NotificationWorkerFunction"
    ], { ...config, secrets });
    const functionName = resource.StackResourceDetail?.PhysicalResourceId;
    if (!functionName) return false;
    const lambda = runAws([
        "lambda", "get-function-configuration",
        "--function-name", functionName
    ], { ...config, secrets });
    return lambda.Environment?.Variables?.PUSH_DELIVERY_MODE === "DRY_RUN";
}

async function readOnlyChecks(api, reporter) {
    await reporter.step("API Gateway rejects missing authorization", async () => {
        assertStatus(await api("GET", "/me", { auth: false }), 401, "unauthenticated GET /me");
    });

    const me = await reporter.step("GET /me", async () => {
        const result = assertStatus(await api("GET", "/me"), 200, "GET /me");
        assertObject(result.body, "/me");
        assertTruthy(typeof result.body.displayName === "string", "/me displayName");
        assertTruthy(typeof result.body.timeZone === "string", "/me timeZone");
        for (const field of ["level", "xp", "coins", "worldPoints", "tasksCompleted"]) assertNumber(result.body[field], `/me ${field}`);
        return result.body;
    });

    await reporter.step("GET /tasks", async () => {
        const result = assertStatus(await api("GET", "/tasks"), 200, "GET /tasks");
        assertObject(result.body.time, "/tasks time");
        assertObject(result.body.summary, "/tasks summary");
        assertArray(result.body.tasks, "/tasks tasks");
    });

    await reporter.step("GET /goals", async () => {
        const result = assertStatus(await api("GET", "/goals"), 200, "GET /goals");
        for (const field of ["daily", "weekly", "player"]) assertObject(result.body[field], `/goals ${field}`);
    });

    await reporter.step("GET /history", async () => {
        const result = assertStatus(await api("GET", "/history"), 200, "GET /history");
        assertObject(result.body.summary, "/history summary");
        assertArray(result.body.days, "/history days");
        for (const field of ["totalCompletions", "last7Days", "totalXpEarned", "totalCoinsEarned", "activeDays", "averagePerActiveDay"]) {
            assertNumber(result.body.summary[field], `/history summary.${field}`);
        }
    });

    await reporter.step("GET /achievements", async () => {
        const result = assertStatus(await api("GET", "/achievements"), 200, "GET /achievements");
        assertArray(result.body.achievements, "/achievements achievements");
        for (const item of result.body.achievements) {
            assertTruthy(typeof item.achievementId === "string", "achievementId");
            assertTruthy(typeof item.name === "string", "achievement name");
            assertTruthy(typeof item.type === "string", "achievement type");
            assertNumber(item.progressPercent, "achievement progressPercent");
            assertTruthy(typeof item.earned === "boolean", "achievement earned");
        }
    });

    await reporter.step("GET /shop", async () => {
        const result = assertStatus(await api("GET", "/shop"), 200, "GET /shop");
        assertObject(result.body.player, "/shop player");
        assertArray(result.body.items, "/shop items");
        for (const item of result.body.items) {
            assertNumber(item.price, "shop item price");
            assertNumber(item.effectivePrice, "shop item effectivePrice");
            assertTruthy(item.effectivePrice <= item.price, "effectivePrice must not exceed price");
            assertNumber(item.requiredLevel, "shop item requiredLevel");
            assertNumber(item.effectiveRequiredLevel, "shop item effectiveRequiredLevel");
            assertTruthy(item.effectiveRequiredLevel >= 1 && item.effectiveRequiredLevel <= item.requiredLevel, "effectiveRequiredLevel must be valid");
            assertTruthy(typeof item.owned === "boolean", "shop item owned state");
            assertTruthy(typeof item.status === "string", "shop item status");
        }
    });

    await reporter.step("GET /inventory", async () => {
        const result = assertStatus(await api("GET", "/inventory"), 200, "GET /inventory");
        assertObject(result.body.equipped, "/inventory equipped");
        assertArray(result.body.items, "/inventory items");
        assertNoStorageKeys(result.body, "/inventory");
    });

    await reporter.step("GET /world", async () => {
        const result = assertStatus(await api("GET", "/world"), 200, "GET /world");
        assertNumber(result.body.worldPoints, "/world worldPoints");
        assertObject(result.body.effects, "/world effects");
        assertEqual(result.body.buildings?.length, 6, "/world building count");
        for (const effect of Object.values(result.body.effects)) assertNumber(effect, "world effect");
        for (const building of result.body.buildings) {
            assertNumber(building.currentLevel, "building currentLevel");
            assertNumber(building.maxLevel, "building maxLevel");
        }
    });

    const preferences = await reporter.step("GET /preferences", async () => {
        const result = assertStatus(await api("GET", "/preferences"), 200, "GET /preferences");
        for (const field of ["notificationsEnabled", "dailyReminderEnabled", "weeklySummaryEnabled", "taskRemindersEnabled", "soundEnabled", "hapticsEnabled"]) {
            assertTruthy(typeof result.body[field] === "boolean", `/preferences ${field}`);
        }
        return result.body;
    });

    await reporter.step("malformed JSON returns INVALID_JSON", async () => {
        const result = assertStatus(await api("POST", "/tasks", { rawBody: "{" }), 400, "malformed task JSON");
        assertErrorCode(result, "INVALID_JSON", "malformed task JSON");
    });
    await reporter.step("blank task title returns VALIDATION_ERROR", async () => {
        const result = assertStatus(await api("POST", "/tasks", { body: { title: "   " } }), 400, "blank task title");
        assertErrorCode(result, "VALIDATION_ERROR", "blank task title");
    });
    await reporter.step("protected task fields return VALIDATION_ERROR", async () => {
        const result = assertStatus(await api("POST", "/tasks", { body: { title: "Rejected", xpReward: 999 } }), 400, "protected task fields");
        assertErrorCode(result, "VALIDATION_ERROR", "protected task fields");
    });
    await reporter.step("unknown building returns a controlled error", async () => {
        const result = assertStatus(await api("POST", "/world/buildings/integration_unknown/upgrade", { body: {} }), 404, "unknown building");
        assertErrorCode(result, "BUILDING_NOT_FOUND", "unknown building");
    });
    await reporter.step("unknown shop item returns a controlled error", async () => {
        const result = assertStatus(await api("POST", "/shop/purchase", { body: { itemId: "integration_unknown" } }), 404, "unknown shop item");
        assertErrorCode(result, "ITEM_NOT_FOUND", "unknown shop item");
    });

    return { me, preferences };
}

function archiveCleanup(api, taskId) {
    return async () => assertStatus(await api("DELETE", `/tasks/${encodeURIComponent(taskId)}`), [204, 404], `cleanup task ${taskId}`);
}

async function taskLifecycle(api, reporter, cleanup, runId, skipCompletion) {
    const originalTitle = `Integration ${runId}`;
    const patchedTitle = `${originalTitle} updated`;
    const task = await reporter.step("create disposable one-time task", async () => {
        const result = assertStatus(await api("POST", "/tasks", {
            body: { title: originalTitle, description: `Disposable integration task ${runId}`, repeatType: "NONE" }
        }), 201, "create task");
        assertTruthy(result.body.taskId, "created taskId");
        assertEqual(result.body.xpReward, 10, "server task xpReward");
        assertEqual(result.body.coinReward, 1, "server task coinReward");
        cleanup.add(`archive task ${result.body.taskId}`, archiveCleanup(api, result.body.taskId));
        return result.body;
    });

    await reporter.step("created task appears scheduled and due", async () => {
        const result = assertStatus(await api("GET", "/tasks"), 200, "GET /tasks after create");
        const found = result.body.tasks.find((item) => item.taskId === task.taskId);
        assertTruthy(found, "created task in /tasks");
        assertEqual(found.isScheduledToday, true, "created task isScheduledToday");
        assertEqual(found.isDueToday, true, "created task isDueToday");
    });

    await reporter.step("patch disposable task", async () => {
        const result = assertStatus(await api("PATCH", `/tasks/${task.taskId}`, {
            body: {
                title: patchedTitle,
                description: `Snapshot ${runId} must remain immutable`,
                repeatType: "DAILY"
            }
        }), 200, "patch task");
        assertEqual(result.body.title, patchedTitle, "patched task title");
        assertEqual(result.body.repeatType, "DAILY", "patched task schedule");
        const reset = assertStatus(await api("PATCH", `/tasks/${task.taskId}`, {
            body: { repeatType: "NONE" }
        }), 200, "reset task schedule");
        assertEqual(reset.body.repeatType, "NONE", "reset task repeatType");
        assertEqual(reset.body.repeatDays.length, 0, "reset task repeatDays");
    });

    if (skipCompletion) {
        reporter.skip("completion, duplicate protection, and immutable completion history", "EVRENTHIA_INTEGRATION_SKIP_MUTATING_COMPLETION=true");
    } else {
        const before = assertStatus(await api("GET", "/me"), 200, "GET /me before completion").body;
        const completion = await reporter.step("complete task and verify progression deltas", async () => {
            const result = assertStatus(await api("POST", `/tasks/${task.taskId}/complete`, { body: {} }), 200, "complete task");
            const body = result.body;
            for (const field of ["task", "rewards", "goalRewards", "streak", "progression", "player", "time"]) assertObject(body[field], `completion ${field}`);
            assertArray(body.newAchievements, "completion newAchievements");
            for (const field of ["base", "bonuses", "total"]) assertObject(body.rewards[field], `completion rewards.${field}`);
            assertEqual(body.rewards.total.xp, body.rewards.xp, "completion total XP");
            assertEqual(body.rewards.total.coins, body.rewards.coins, "completion total coins");
            assertEqual(body.rewards.base.xp, 10, "completion base XP");
            assertEqual(body.rewards.base.coins, 1, "completion base coins");
            assertEqual(body.streak.current, 0, "one-time task current streak");
            const after = assertStatus(await api("GET", "/me"), 200, "GET /me after completion").body;
            assertEqual(after.xp, before.xp + body.rewards.xp, "profile XP delta");
            assertEqual(after.coins, before.coins + body.rewards.coins, "profile coin delta");
            assertEqual(after.worldPoints, before.worldPoints + body.rewards.worldPoints, "profile World Point delta");
            assertEqual(after.tasksCompleted, before.tasksCompleted + 1, "profile tasksCompleted delta");
            assertEqual(body.progression.totalXp, after.xp, "completion progression totalXp");
            return { body, after };
        });

        await reporter.step("duplicate completion awards nothing", async () => {
            const duplicate = assertStatus(await api("POST", `/tasks/${task.taskId}/complete`, { body: {} }), 409, "duplicate completion");
            assertErrorCode(duplicate, "TASK_ALREADY_COMPLETED", "duplicate completion");
            const afterDuplicate = assertStatus(await api("GET", "/me"), 200, "GET /me after duplicate").body;
            for (const field of ["xp", "coins", "worldPoints", "tasksCompleted"]) {
                assertEqual(afterDuplicate[field], completion.after[field], `duplicate completion ${field}`);
            }
        });

        await reporter.step("completion history preserves task snapshot", async () => {
            const result = assertStatus(await api("GET", `/history/completions?taskId=${encodeURIComponent(task.taskId)}`), 200, "completion history");
            assertArray(result.body.items, "completion history items");
            const snapshot = result.body.items.find((item) => item.taskId === task.taskId);
            assertTruthy(snapshot, "completion history snapshot");
            assertEqual(snapshot.taskTitle, patchedTitle, "completion history title");
        });
    }

    await reporter.step("archive task and verify archived behavior", async () => {
        assertStatus(await api("DELETE", `/tasks/${task.taskId}`), 204, "archive task");
        const visible = assertStatus(await api("GET", "/tasks"), 200, "GET /tasks after archive").body.tasks;
        assertTruthy(!visible.some((item) => item.taskId === task.taskId), "archived task hidden by default");
        const all = assertStatus(await api("GET", "/tasks?includeArchived=true"), 200, "GET archived tasks").body.tasks;
        const archived = all.find((item) => item.taskId === task.taskId);
        assertTruthy(archived, "archived task included");
        assertEqual(archived.archived, true, "archived flag");
        assertEqual(archived.active, false, "archived active flag");
        const patch = assertStatus(await api("PATCH", `/tasks/${task.taskId}`, { body: { title: "No" } }), 409, "patch archived task");
        assertErrorCode(patch, "TASK_ARCHIVED", "patch archived task");
        const complete = assertStatus(await api("POST", `/tasks/${task.taskId}/complete`, { body: {} }), 409, "complete archived task");
        assertErrorCode(complete, "TASK_ARCHIVED", "complete archived task");
    });

    if (!skipCompletion) {
        await reporter.step("archiving does not change completion history", async () => {
            const result = assertStatus(await api("GET", `/history/completions?taskId=${encodeURIComponent(task.taskId)}`), 200, "history after archive");
            const snapshot = result.body.items.find((item) => item.taskId === task.taskId);
            assertEqual(snapshot?.taskTitle, patchedTitle, "archived task snapshot title");
        });
    }
}

async function preferenceLifecycle(api, reporter, cleanup, preferences) {
    await reporter.step("toggle and restore sound preference", async () => {
        const original = preferences.soundEnabled;
        const restore = async () => {
            const result = await api("PATCH", "/preferences", { body: { soundEnabled: original } });
            assertStatus(result, 200, "restore sound preference");
            assertEqual(result.body.soundEnabled, original, "restored sound preference");
        };
        const cancelCleanup = cleanup.add("restore sound preference", restore);
        try {
            const changed = assertStatus(await api("PATCH", "/preferences", {
                body: { soundEnabled: !original }
            }), 200, "toggle sound preference");
            assertEqual(changed.body.soundEnabled, !original, "toggled sound preference");
        } finally {
            await restore();
            cancelCleanup();
        }
    });
}

async function deviceLifecycle(api, reporter, cleanup, email) {
    const deviceId = deterministicDeviceId(email);
    const pushToken = `ExpoPushToken[integration-${createHash("sha256").update(deviceId).digest("hex").slice(0, 24)}]`;
    await reporter.step("register, read, and disable integration device", async () => {
        cleanup.add("disable integration device", async () => {
            assertStatus(await api("DELETE", `/devices/${deviceId}`), [204, 404], "cleanup device");
        });
        const created = assertStatus(await api("POST", "/devices", {
            body: { deviceId, pushProvider: "EXPO", platform: "IOS", pushToken }
        }), 200, "register device");
        assertEqual(created.body.device.deviceId, deviceId, "registered device ID");
        const list = assertStatus(await api("GET", "/devices"), 200, "GET devices");
        assertTruthy(!JSON.stringify(list.body).includes("pushToken"), "device responses hide pushToken");
        assertTruthy(list.body.devices.some((device) => device.deviceId === deviceId && device.enabled), "registered device listed");
        assertStatus(await api("DELETE", `/devices/${deviceId}`), 204, "disable device");
        const disabled = assertStatus(await api("GET", "/devices"), 200, "GET disabled devices");
        assertEqual(disabled.body.devices.find((device) => device.deviceId === deviceId)?.enabled, false, "device soft-disabled");
    });
}

async function reminderLifecycle(api, reporter, cleanup, runId, timeZone) {
    let taskId;
    await reporter.step("create disposable reminder task", async () => {
        const result = assertStatus(await api("POST", "/tasks", {
            body: { title: `Reminder ${runId}`, description: `Disposable reminder task ${runId}`, repeatType: "NONE" }
        }), 201, "create reminder task");
        taskId = result.body.taskId;
        cleanup.add(`archive reminder task ${taskId}`, archiveCleanup(api, taskId));
    });

    await reporter.step("create, retry, update, and disable task reminder", async () => {
        const request = {
            type: "TASK",
            taskId,
            enabled: true,
            localTime: localTimeAhead(timeZone, 5),
            daysOfWeek: [],
            clientRequestId: `integration-${runId}`
        };
        const created = assertStatus(await api("POST", "/reminders", { body: request }), 201, "create reminder");
        assertEqual(created.body.idempotent, false, "initial reminder idempotent flag");
        const reminderId = created.body.reminder.reminderId;
        cleanup.add(`disable reminder ${reminderId}`, async () => {
            assertStatus(await api("DELETE", `/reminders/${reminderId}`), [204, 404], "cleanup reminder");
        });
        const retried = assertStatus(await api("POST", "/reminders", { body: request }), 200, "retry reminder");
        assertEqual(retried.body.idempotent, true, "retried reminder idempotent flag");
        assertEqual(retried.body.reminder.reminderId, reminderId, "idempotent reminder ID");
        const updated = assertStatus(await api("PATCH", `/reminders/${reminderId}`, {
            body: { localTime: localTimeAhead(timeZone, 6) }
        }), 200, "update reminder");
        assertEqual(updated.body.reminder.reminderId, reminderId, "updated reminder ID");
        assertStatus(await api("DELETE", `/reminders/${reminderId}`), 204, "disable reminder");
        const reminders = assertStatus(await api("GET", "/reminders"), 200, "GET reminders");
        assertEqual(reminders.body.reminders.find((item) => item.reminderId === reminderId)?.enabled, false, "reminder soft-disabled");
        assertStatus(await api("DELETE", `/tasks/${taskId}`), 204, "archive reminder task");
    });
}

async function main() {
    const { mode, confirmDev } = parseMode(process.argv.slice(2));
    const config = {
        profile: resolveAwsProfile(process.env),
        region: process.env.EVRENTHIA_AWS_REGION ?? DEFAULTS.region,
        stackName: process.env.EVRENTHIA_STACK_NAME ?? DEFAULTS.stackName
    };
    const email = process.env.EVRENTHIA_TEST_EMAIL;
    const password = process.env.EVRENTHIA_TEST_PASSWORD;
    const secrets = [email, password].filter(Boolean);
    const reporter = makeReporter(secrets);
    const cleanup = new CleanupStack();
    let fatalError;

    try {
        if (!email || !password) throw new Error("EVRENTHIA_TEST_EMAIL and EVRENTHIA_TEST_PASSWORD are required.");
        console.log(`Evrenthia dev integration run (${mode})`);
        const target = await reporter.step("discover and verify development stack outputs", async () => discoverStack(config, secrets));
        if (mode === "full" && !confirmDev && !boolEnv("EVRENTHIA_INTEGRATION_ALLOW_DEV_MUTATION")) {
            throw new Error("Full mode requires --confirm-dev or EVRENTHIA_INTEGRATION_ALLOW_DEV_MUTATION=true.");
        }
        const token = await reporter.step("authenticate dedicated Cognito test user", async () => authenticate(target, config, email, password));
        secrets.push(token);
        const api = createApi(target.apiUrl, token, secrets);
        const baseline = await readOnlyChecks(api, reporter);

        if (mode === "full") {
            const runId = generateRunId();
            await taskLifecycle(api, reporter, cleanup, runId, boolEnv("EVRENTHIA_INTEGRATION_SKIP_MUTATING_COMPLETION"));
            await preferenceLifecycle(api, reporter, cleanup, baseline.preferences);
            if (notificationWorkerIsDryRun(config, secrets)) {
                await deviceLifecycle(api, reporter, cleanup, email);
            } else {
                reporter.skip("device registration lifecycle", "NotificationWorker is not configured with PUSH_DELIVERY_MODE=DRY_RUN");
            }
            await reminderLifecycle(api, reporter, cleanup, runId, baseline.me.timeZone);
        } else {
            reporter.skip("safe mutation lifecycle", "read-only mode");
        }
    } catch (error) {
        fatalError = error;
        if (reporter.counts.failed === 0) {
            reporter.counts.failed++;
            console.error(`FAIL integration setup: ${redactSensitive(error?.message ?? error, secrets)}`);
        }
    } finally {
        await cleanup.run((label, error) => reporter.cleanupFailure(label, error));
        console.log("");
        console.log(`Integration tests passed: ${reporter.counts.passed}`);
        console.log(`Skipped: ${reporter.counts.skipped}`);
        console.log(`Failed: ${reporter.counts.failed}`);
    }

    if (fatalError || reporter.counts.failed) process.exitCode = 1;
}

await main();
