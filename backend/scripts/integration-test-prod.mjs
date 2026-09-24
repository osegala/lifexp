#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
    assertErrorCode,
    assertProdTarget,
    assertStatus,
    assertTruthy,
    cognitoAuthArgs,
    parseReadOnlyArgs,
    parseStackOutputs,
    redactSensitive,
    resolveProdAwsProfile,
    sanitizedAwsCliError
} from "./integration-test-helpers.mjs";

const REGION = "us-east-2";
const STACK_NAME = "evrenthia-prod";

export const READ_ONLY_ENDPOINTS = Object.freeze([
    "/me",
    "/tasks",
    "/goals",
    "/history",
    "/history/completions",
    "/achievements",
    "/shop",
    "/inventory",
    "/world",
    "/entitlements",
    "/preferences",
    "/devices",
    "/reminders"
]);

const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const assertObject = (value, label) => assertTruthy(isObject(value), `${label} must be an object`);
const assertArray = (value, label) => assertTruthy(Array.isArray(value), `${label} must be an array`);
const assertNumber = (value, label) => assertTruthy(typeof value === "number" && Number.isFinite(value), `${label} must be numeric`);

function makeReporter(secrets) {
    const counts = { passed: 0, failed: 0 };
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
        }
    };
}

function spawnAws(args, secrets = [], { stderrOnly = false } = {}) {
    const result = spawnSync("aws", args, { encoding: "utf8", maxBuffer: 10 * 1024 * 1024 });
    if (result.error) throw new Error(`AWS CLI failed to start: ${result.error.message}`);
    if (result.status !== 0) {
        throw sanitizedAwsCliError(result.stderr || (!stderrOnly && result.stdout) || `exit ${result.status}`, secrets);
    }
    return result.stdout.trim();
}

export function productionTargetFromOutputs(value) {
    const outputs = parseStackOutputs(value);
    const target = {
        stackName: STACK_NAME,
        region: REGION,
        apiUrl: outputs.ApiUrl,
        tableName: outputs.TableName,
        userPoolId: outputs.UserPoolId,
        clientId: outputs.UserPoolClientId,
        functionNames: [outputs.GetMeFunctionName, outputs.CreateProfileFunctionName].filter(Boolean)
    };
    for (const [name, output] of Object.entries(target)) {
        if (name !== "functionNames" && !output) throw new Error(`Production stack output ${name} is missing.`);
    }
    assertProdTarget(target);
    return { ...target, apiUrl: target.apiUrl.replace(/\/$/, "") };
}

function discoverProductionStack(profile, secrets) {
    const args = [
        "cloudformation", "describe-stacks",
        "--stack-name", STACK_NAME,
        "--query", "Stacks[0].Outputs",
        "--region", REGION,
        "--output", "json"
    ];
    if (profile) args.push("--profile", profile);
    return productionTargetFromOutputs(spawnAws(args, secrets));
}

function authenticate(target, profile, email, password) {
    const token = spawnAws(cognitoAuthArgs({
        region: REGION,
        clientId: target.clientId,
        email,
        password,
        profile
    }), [email, password], { stderrOnly: true });
    if (!token || token === "None" || token === "null") throw new Error("Cognito did not return an ID token.");
    return token;
}

function createGetApi(apiUrl, token, secrets) {
    return async function get(path, { auth = true } = {}) {
        const headers = { Accept: "application/json" };
        if (auth) headers.Authorization = `Bearer ${token}`;
        let response;
        try {
            response = await fetch(`${apiUrl}${path}`, {
                method: "GET",
                headers,
                signal: AbortSignal.timeout(30_000)
            });
        } catch (error) {
            throw new Error(`GET ${path} failed: ${redactSensitive(error?.message ?? error, secrets)}`);
        }
        const text = await response.text();
        let body = null;
        if (text) {
            try { body = JSON.parse(text); }
            catch { body = text; }
        }
        return { status: response.status, body };
    };
}

function assertNoStorageKeys(value, path = "response") {
    if (!value || typeof value !== "object") return;
    for (const [key, child] of Object.entries(value)) {
        assertTruthy(key !== "PK" && key !== "SK", `${path} must not expose ${key}`);
        assertNoStorageKeys(child, `${path}.${key}`);
    }
}

export function validateReadOnlyResponse(path, body) {
    assertObject(body, path);
    switch (path) {
        case "/me":
            assertTruthy(typeof body.displayName === "string", "/me displayName");
            assertTruthy(typeof body.timeZone === "string", "/me timeZone");
            for (const field of ["level", "xp", "coins", "worldPoints", "tasksCompleted"]) assertNumber(body[field], `/me ${field}`);
            break;
        case "/tasks":
            assertObject(body.time, "/tasks time");
            assertObject(body.summary, "/tasks summary");
            assertArray(body.tasks, "/tasks tasks");
            break;
        case "/goals":
            for (const field of ["daily", "weekly", "player"]) assertObject(body[field], `/goals ${field}`);
            break;
        case "/history":
            assertObject(body.summary, "/history summary");
            assertArray(body.days, "/history days");
            break;
        case "/history/completions":
            assertArray(body.items, "/history/completions items");
            assertTruthy(body.nextCursor === null || typeof body.nextCursor === "string", "/history/completions nextCursor");
            break;
        case "/achievements":
            assertObject(body.summary, "/achievements summary");
            assertArray(body.achievements, "/achievements achievements");
            break;
        case "/shop":
            assertObject(body.player, "/shop player");
            assertArray(body.items, "/shop items");
            break;
        case "/inventory":
            assertObject(body.equipped, "/inventory equipped");
            assertArray(body.items, "/inventory items");
            break;
        case "/world":
            assertNumber(body.worldPoints, "/world worldPoints");
            assertObject(body.effects, "/world effects");
            assertArray(body.buildings, "/world buildings");
            break;
        case "/entitlements":
            assertTruthy(typeof body.plan === "string", "/entitlements plan");
            assertTruthy(typeof body.adsEnabled === "boolean", "/entitlements adsEnabled");
            break;
        case "/preferences":
            for (const field of ["notificationsEnabled", "dailyReminderEnabled", "weeklySummaryEnabled", "taskRemindersEnabled", "soundEnabled", "hapticsEnabled"]) {
                assertTruthy(typeof body[field] === "boolean", `/preferences ${field}`);
            }
            break;
        case "/devices":
            assertArray(body.devices, "/devices devices");
            break;
        case "/reminders":
            assertTruthy(typeof body.timeZone === "string", "/reminders timeZone");
            assertArray(body.reminders, "/reminders reminders");
            break;
        default:
            throw new Error(`Unsupported production smoke endpoint: ${path}`);
    }
    assertNoStorageKeys(body, path);
    return body;
}

async function main() {
    parseReadOnlyArgs(process.argv.slice(2));
    const email = process.env.EVRENTHIA_PROD_TEST_EMAIL;
    const password = process.env.EVRENTHIA_PROD_TEST_PASSWORD;
    const secrets = [email, password].filter(Boolean);
    const reporter = makeReporter(secrets);
    let fatalError;

    try {
        if (!email || !password) {
            throw new Error("EVRENTHIA_PROD_TEST_EMAIL and EVRENTHIA_PROD_TEST_PASSWORD are required; create no users from this runner.");
        }
        const profile = resolveProdAwsProfile(process.env);
        console.log("Evrenthia production read-only smoke test");
        const target = await reporter.step("discover and verify production stack outputs", async () =>
            discoverProductionStack(profile, secrets));
        const token = await reporter.step("authenticate dedicated production smoke-test user", async () =>
            authenticate(target, profile, email, password));
        secrets.push(token);
        const get = createGetApi(target.apiUrl, token, secrets);

        await reporter.step("API Gateway rejects missing authorization", async () => {
            assertStatus(await get("/me", { auth: false }), 401, "unauthenticated GET /me");
        });
        for (const path of READ_ONLY_ENDPOINTS) {
            await reporter.step(`GET ${path}`, async () => {
                const result = assertStatus(await get(path), 200, `GET ${path}`);
                validateReadOnlyResponse(path, result.body);
            });
        }
        await reporter.step("GET validation error uses the canonical envelope", async () => {
            const result = assertStatus(await get("/history/completions?limit=0"), 400, "invalid completion-history limit");
            assertErrorCode(result, "VALIDATION_ERROR", "invalid completion-history limit");
        });
    } catch (error) {
        fatalError = error;
        if (reporter.counts.failed === 0) {
            reporter.counts.failed++;
            console.error(`FAIL production smoke setup: ${redactSensitive(error?.message ?? error, secrets)}`);
        }
    } finally {
        console.log("");
        console.log(`Smoke checks passed: ${reporter.counts.passed}`);
        console.log(`Failed: ${reporter.counts.failed}`);
    }

    if (fatalError || reporter.counts.failed) process.exitCode = 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
