import test from "node:test";
import assert from "node:assert/strict";
import {
    ApiError,
    authSubject,
    handleApiError,
    logUnexpectedError,
    noContent,
    parseJsonBody,
    requireActivePlayer,
    requiredString,
    validateBodyFields
} from "../layers/api-shared/nodejs/http.mjs";
import {
    validateTaskCreate,
    validateTaskPatch
} from "../layers/api-shared/nodejs/task-input.mjs";
import { validateProfilePatch } from "../functions/update-me/logic.mjs";
import { validateRegistration } from "../functions/devices/logic.mjs";
import {
    validateReminderCreate,
    validateReminderPatch
} from "../functions/reminders/logic.mjs";
import {
    HistoryQueryError,
    historyQuery
} from "../functions/get-completion-history/logic.mjs";
import {
    CompletionError,
    planCompletion
} from "../functions/complete-task/logic.mjs";
import { planPurchase, PurchaseError } from "../functions/purchase-item/logic.mjs";
import { planUpgrade, UpgradeError } from "../functions/upgrade-building/logic.mjs";
import { levelInfo } from "../layers/api-shared/nodejs/leveling.mjs";
import { resolveTaskReward } from "../layers/api-shared/nodejs/task-rewards.mjs";

function body(response) {
    return JSON.parse(response.body);
}

function expectCode(fn, ErrorType, code, statusCode = 400) {
    assert.throws(fn, (error) =>
        error instanceof ErrorType && error.code === code && error.statusCode === statusCode
    );
}

test("canonical errors use a stable nested JSON shape", () => {
    let error;
    try {
        parseJsonBody({ body: "{" });
    } catch (caught) {
        error = caught;
    }
    const response = handleApiError(error, "test parse");

    assert.equal(response.statusCode, 400);
    assert.deepEqual(response.headers, { "Content-Type": "application/json" });
    assert.deepEqual(body(response), {
        error: { code: "INVALID_JSON", message: "Request body must be valid JSON." }
    });
    assert.deepEqual(noContent(), { statusCode: 204 });
});

test("task create validation rejects missing, blank, invalid, duplicate, and protected input", () => {
    expectCode(() => validateTaskCreate({}), ApiError, "VALIDATION_ERROR");
    expectCode(() => validateTaskCreate({ title: "   " }), ApiError, "VALIDATION_ERROR");
    expectCode(() => validateTaskCreate({ title: "Task", repeatType: "MONTHLY" }), ApiError, "INVALID_REPEAT_TYPE");
    expectCode(() => validateTaskCreate({ title: "Task", repeatType: "WEEKLY", repeatDays: ["MON", "FUNDAY"] }), ApiError, "INVALID_REPEAT_DAYS");
    expectCode(() => validateTaskCreate({ title: "Task", repeatType: "WEEKLY", repeatDays: ["MON", "mon"] }), ApiError, "INVALID_REPEAT_DAYS");
    expectCode(() => validateTaskCreate({ title: "Task", xpReward: 999 }), ApiError, "VALIDATION_ERROR");

    assert.deepEqual(validateTaskCreate({ title: "  Task  ", repeatType: "WEEKLY", repeatDays: ["mon"] }), {
        title: "Task",
        description: null,
        taskSize: "NORMAL",
        repeatType: "WEEKLY",
        repeatDays: ["MON"],
        active: true
    });
});

test("task patch rejects empty and protected updates while preserving valid schedule transitions", () => {
    const existing = { repeatType: "WEEKLY", repeatDays: ["MON"] };
    expectCode(() => validateTaskPatch({}, existing), ApiError, "VALIDATION_ERROR");
    expectCode(() => validateTaskPatch({ completed: true }, existing), ApiError, "VALIDATION_ERROR");
    assert.deepEqual(validateTaskPatch({ repeatType: "DAILY" }, existing), {
        repeatType: "DAILY",
        repeatDays: []
    });
});

test("profile, reminder, and device validators retain stable validation codes", () => {
    expectCode(() => validateProfilePatch({ timeZone: "Moon/Tranquility" }), Error, "INVALID_TIME_ZONE");
    expectCode(() => validateReminderCreate({ type: "TASK", taskId: "task-1", localTime: "25:00" }), Error, "INVALID_REMINDER_TIME");
    expectCode(() => validateReminderCreate({ type: "WEEKLY", localTime: "08:00" }), Error, "INVALID_REMINDER_TYPE");
    expectCode(() => validateReminderCreate({ type: "TASK", taskId: "task-1", localTime: "08:00", clientRequestId: "short" }), Error, "VALIDATION_ERROR");
    expectCode(() => validateReminderPatch({ localTime: "8am" }), Error, "INVALID_REMINDER_TIME");
    expectCode(() => validateRegistration({ deviceId: "short", pushProvider: "EXPO", platform: "IOS", pushToken: "bad" }), Error, "VALIDATION_ERROR");
    expectCode(() => validateRegistration({ deviceId: "device-123", pushProvider: "EXPO", platform: "IOS", pushToken: "bad" }), Error, "INVALID_PUSH_TOKEN");
});

test("purchase input rejects missing IDs and client-controlled pricing fields", () => {
    expectCode(() => requiredString({}, "itemId"), ApiError, "VALIDATION_ERROR");
    expectCode(
        () => validateBodyFields({ itemId: "hat", price: 1 }, ["itemId"]),
        ApiError,
        "VALIDATION_ERROR"
    );
});

test("purchase and building business failures expose stable codes", () => {
    expectCode(() => planPurchase(null, { xp: 0, coins: 10 }), PurchaseError, "ITEM_NOT_FOUND", 404);
    expectCode(
        () => planPurchase({ itemId: "hat", price: 25, requiredLevel: 1, active: true }, { xp: 0, coins: 1 }),
        PurchaseError,
        "INSUFFICIENT_COINS"
    );
    expectCode(() => planUpgrade(null, null, 100), UpgradeError, "BUILDING_NOT_FOUND", 404);
    expectCode(
        () => planUpgrade({ active: true, maxLevel: 5, upgradeCosts: [100, 250, 500, 1000] }, { level: 5 }, 1000),
        UpgradeError,
        "BUILDING_MAX_LEVEL",
        409
    );
    expectCode(
        () => planUpgrade({ active: true, maxLevel: 5, upgradeCosts: [100, 250, 500, 1000] }, { level: 1 }, 99),
        UpgradeError,
        "INSUFFICIENT_WORLD_POINTS"
    );
});

test("archived and duplicate task completion states retain stable conflict codes", () => {
    const input = {
        task: {
            taskSize: "QUICK",
            repeatType: "DAILY",
            repeatDays: [],
            active: true,
            archived: false,
            completed: false,
            lastCompletedDate: null,
            currentStreak: 0,
            bestStreak: 0,
            xpReward: 10,
            coinReward: 1
        },
        profile: { xp: 0, coins: 0, worldPoints: 0, tasksCompleted: 0 },
        dailyStats: { tasksCompleted: 0, goalRewarded: false },
        weeklyStats: { tasksCompleted: 0, goalRewarded: false },
        today: "2026-09-23",
        now: "2026-09-23T12:00:00.000Z",
        defaults: { xp: 10, coins: 1, dailyTarget: 3, weeklyTarget: 15, dailyWorldPoints: 25, weeklyWorldPoints: 100 }
    };
    input.baseReward = resolveTaskReward(input.task);
    input.progressionForXp = levelInfo;

    expectCode(() => planCompletion({ ...input, task: { ...input.task, archived: true } }), CompletionError, "TASK_ARCHIVED", 409);
    expectCode(() => planCompletion({ ...input, completionExists: true }), CompletionError, "TASK_ALREADY_COMPLETED", 409);
});

test("invalid history limits and cursors remain controlled client errors", () => {
    assert.throws(() => historyQuery("table", "USER#1", { limit: "0" }), HistoryQueryError);
    assert.throws(() => historyQuery("table", "USER#1", { cursor: "not-a-cursor" }), HistoryQueryError);
});

test("unexpected failures map to sanitized INTERNAL_ERROR responses", () => {
    const original = console.error;
    console.error = () => {};
    let response;
    try {
        response = handleApiError(new Error("AccessDenied on table Evrenthia-Dev with secret token"), "test failure");
    } finally {
        console.error = original;
    }

    assert.equal(response.statusCode, 500);
    assert.deepEqual(body(response), {
        error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred." }
    });
    assert.doesNotMatch(response.body, /Evrenthia|AccessDenied|secret|token/);
});

test("structured unexpected-error logs redact sensitive values", () => {
    const originalConsoleError = console.error;
    const originalFunctionName = process.env.AWS_LAMBDA_FUNCTION_NAME;
    let logged;
    console.error = (record) => { logged = record; };
    process.env.AWS_LAMBDA_FUNCTION_NAME = "Evrenthia-Dev-Test";
    let record;
    try {
        record = logUnexpectedError(
            "Request failed Authorization=Bearer context-jwt",
            new Error("Authorization=Bearer jwt-value token=private ExpoPushToken[push-value]")
        );
    } finally {
        console.error = originalConsoleError;
        if (originalFunctionName === undefined) delete process.env.AWS_LAMBDA_FUNCTION_NAME;
        else process.env.AWS_LAMBDA_FUNCTION_NAME = originalFunctionName;
    }

    assert.deepEqual(logged, record);
    assert.equal(record.level, "ERROR");
    assert.equal(record.event, "UNEXPECTED_ERROR");
    assert.equal(record.function, "Evrenthia-Dev-Test");
    assert.equal(record.errorName, "Error");
    assert.equal(Object.hasOwn(record, "errorMessage"), false);
    assert.match(record.message, /\[REDACTED\]/);
    assert.doesNotMatch(JSON.stringify(record), /context-jwt|jwt-value|private|push-value/);
});

test("authentication subject extraction trusts only Cognito JWT context", () => {
    assert.equal(authSubject({ requestContext: { authorizer: { jwt: { claims: { sub: "user-123" } } } } }), "user-123");
    assert.equal(authSubject({ body: JSON.stringify({ userId: "attacker" }) }), null);
});

test("active player guard uses one strongly consistent exact-key profile read", async () => {
    class GetItemCommand {
        constructor(input) { this.input = input; }
    }
    const requests = [];
    const profile = { PK: { S: "USER#user-123" }, SK: { S: "PROFILE" } };
    const client = { send: async (command) => {
        requests.push(command.input);
        return { Item: profile };
    } };
    const event = {
        body: JSON.stringify({ sub: "attacker" }),
        requestContext: { authorizer: { jwt: { claims: { sub: "user-123" } } } }
    };

    assert.deepEqual(
        await requireActivePlayer(event, client, "Evrenthia-Dev", GetItemCommand),
        { userId: "user-123", profile }
    );
    assert.deepEqual(requests, [{
        TableName: "Evrenthia-Dev",
        Key: { PK: { S: "USER#user-123" }, SK: { S: "PROFILE" } },
        ConsistentRead: true
    }]);
});

test("missing active profile returns the canonical ACCOUNT_NOT_FOUND contract", async () => {
    class GetItemCommand {
        constructor(input) { this.input = input; }
    }
    const event = { requestContext: { authorizer: { jwt: { claims: { sub: "deleted-user" } } } } };
    const client = { send: async () => ({}) };

    let error;
    let taskCreated = false;
    try {
        await requireActivePlayer(event, client, "Evrenthia-Dev", GetItemCommand);
        taskCreated = true;
    } catch (caught) {
        error = caught;
    }
    assert.equal(taskCreated, false, "POST /tasks must not reach its write after the guard rejects");
    assert.ok(error instanceof ApiError);
    assert.equal(error.statusCode, 403);
    assert.equal(error.code, "ACCOUNT_NOT_FOUND");
    assert.deepEqual(error.details, []);
    assert.deepEqual(body(handleApiError(error, "test active player")), {
        error: {
            code: "ACCOUNT_NOT_FOUND",
            message: "Player account no longer exists.",
            details: []
        }
    });
});

test("account deletion can retry after its profile was already removed", async () => {
    class GetItemCommand {
        constructor(input) { this.input = input; }
    }
    const event = { requestContext: { authorizer: { jwt: { claims: { sub: "deleted-user" } } } } };
    const client = { send: async () => ({}) };

    assert.deepEqual(
        await requireActivePlayer(
            event,
            client,
            "Evrenthia-Dev",
            GetItemCommand,
            { allowMissing: true }
        ),
        { userId: "deleted-user", profile: null }
    );
});
