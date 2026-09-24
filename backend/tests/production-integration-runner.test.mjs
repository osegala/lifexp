import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
    assertDevTarget,
    assertProdTarget,
    parseReadOnlyArgs,
    redactSensitive,
    resolveProdAwsProfile
} from "../scripts/integration-test-helpers.mjs";
import {
    productionTargetFromOutputs,
    READ_ONLY_ENDPOINTS,
    validateReadOnlyResponse
} from "../scripts/integration-test-prod.mjs";

const backend = fileURLToPath(new URL("../", import.meta.url));
const prodRunner = readFileSync(`${backend}/scripts/integration-test-prod.mjs`, "utf8");
const devRunner = readFileSync(`${backend}/scripts/integration-test-dev.mjs`, "utf8");

const prodTarget = {
    stackName: "evrenthia-prod",
    tableName: "Evrenthia-Prod",
    apiUrl: "https://prod123.execute-api.us-east-2.amazonaws.com",
    region: "us-east-2",
    userPoolId: "us-east-2_ProductionPool",
    clientId: "productionclient123",
    functionNames: ["Evrenthia-Prod-GetMe", "Evrenthia-Prod-CreateProfile"]
};

test("production runner is structurally read-only", () => {
    assert.match(prodRunner, /method: "GET"/);
    assert.doesNotMatch(prodRunner, /--full|EVRENTHIA_INTEGRATION_ALLOW_DEV_MUTATION/);
    assert.doesNotMatch(prodRunner, /\b(?:POST|PUT|PATCH|DELETE)\b/);
    assert.doesNotMatch(prodRunner, /dynamodb|BatchWrite|PutItem|UpdateItem|DeleteItem|seed-catalogs/i);
    assert.doesNotMatch(prodRunner, /admin-create-user|sign-up|UserPoolUser/i);
    assert.doesNotMatch(prodRunner, /integration-test-dev/);
});

test("production runner covers only the approved GET endpoints", () => {
    assert.deepEqual(READ_ONLY_ENDPOINTS, [
        "/me", "/tasks", "/goals", "/history", "/history/completions",
        "/achievements", "/shop", "/inventory", "/world", "/entitlements",
        "/preferences", "/devices", "/reminders"
    ]);
});

test("production mode parser refuses every mode except read-only", () => {
    assert.equal(parseReadOnlyArgs([]), "read-only");
    assert.equal(parseReadOnlyArgs(["--read-only"]), "read-only");
    assert.throws(() => parseReadOnlyArgs(["--full"]), /only read-only mode/);
    assert.throws(() => parseReadOnlyArgs(["--confirm-dev"]), /only read-only mode/);
});

test("production credentials and optional AWS profile come only from production environment variables", () => {
    assert.match(prodRunner, /process\.env\.EVRENTHIA_PROD_TEST_EMAIL/);
    assert.match(prodRunner, /process\.env\.EVRENTHIA_PROD_TEST_PASSWORD/);
    assert.doesNotMatch(prodRunner, /process\.env\.EVRENTHIA_TEST_(?:EMAIL|PASSWORD)/);
    assert.equal(resolveProdAwsProfile({}), null);
    assert.equal(resolveProdAwsProfile({ EVRENTHIA_PROD_AWS_PROFILE: "production-admin" }), "production-admin");
    assert.equal(resolveProdAwsProfile({ EVRENTHIA_PROD_AWS_PROFILE: "" }), null);
});

test("production target discovery requires generic isolated stack outputs", () => {
    const target = productionTargetFromOutputs([
        { OutputKey: "ApiUrl", OutputValue: prodTarget.apiUrl },
        { OutputKey: "TableName", OutputValue: prodTarget.tableName },
        { OutputKey: "UserPoolId", OutputValue: prodTarget.userPoolId },
        { OutputKey: "UserPoolClientId", OutputValue: prodTarget.clientId },
        { OutputKey: "GetMeFunctionName", OutputValue: prodTarget.functionNames[0] },
        { OutputKey: "CreateProfileFunctionName", OutputValue: prodTarget.functionNames[1] }
    ]);
    assert.deepEqual(target, prodTarget);
    assert.throws(() => productionTargetFromOutputs([]), /output apiUrl is missing/);
});

test("production rejects dev and known non-production Cognito resources", () => {
    assert.equal(assertProdTarget(prodTarget), true);
    assert.throws(() => assertProdTarget({ ...prodTarget, stackName: "evrenthia-dev" }), /other than evrenthia-prod/);
    assert.throws(() => assertProdTarget({ ...prodTarget, tableName: "Evrenthia-Dev" }), /other than Evrenthia-Prod/);
    assert.throws(() => assertProdTarget({ ...prodTarget, functionNames: ["Evrenthia-Dev-GetMe"] }), /production-scoped Lambda/);
    assert.throws(() => assertProdTarget({ ...prodTarget, userPoolId: "us-east-2_GeLguitkg" }), /non-production Cognito user pool/);
    assert.throws(() => assertProdTarget({ ...prodTarget, clientId: "2d934f22a9lvbppn6m9liistj" }), /non-production Cognito app client/);
});

test("development safety continues rejecting production targets", () => {
    assert.match(devRunner, /assertDevTarget/);
    assert.throws(() => assertDevTarget({
        stackName: "evrenthia-prod",
        tableName: "Evrenthia-Prod",
        apiUrl: prodTarget.apiUrl,
        region: prodTarget.region,
        functionNames: prodTarget.functionNames
    }), /non-development stack/);
});

test("empty and default production response states are valid", () => {
    const responses = {
        "/me": { displayName: "Smoke", timeZone: "UTC", level: 1, xp: 0, coins: 0, worldPoints: 0, tasksCompleted: 0 },
        "/tasks": { time: {}, summary: {}, tasks: [] },
        "/goals": { daily: {}, weekly: {}, player: {} },
        "/history": { summary: {}, days: [] },
        "/history/completions": { items: [], nextCursor: null },
        "/achievements": { summary: {}, achievements: [] },
        "/shop": { player: {}, items: [] },
        "/inventory": { equipped: {}, items: [] },
        "/world": { worldPoints: 0, effects: {}, buildings: [] },
        "/entitlements": { plan: "FREE", adsEnabled: true },
        "/preferences": {
            notificationsEnabled: true,
            dailyReminderEnabled: false,
            weeklySummaryEnabled: false,
            taskRemindersEnabled: true,
            soundEnabled: true,
            hapticsEnabled: true
        },
        "/devices": { devices: [] },
        "/reminders": { timeZone: "UTC", reminders: [] }
    };
    for (const path of READ_ONLY_ENDPOINTS) {
        assert.equal(validateReadOnlyResponse(path, responses[path]), responses[path]);
    }
});

test("production runner redaction hides credentials and ID tokens", () => {
    const password = "production-password-secret";
    const token = "production.id.token";
    const output = redactSensitive({ message: `password=${password} Authorization=Bearer ${token}` }, [password, token]);
    assert.doesNotMatch(output, /production-password-secret|production\.id\.token/);
    assert.match(output, /REDACTED/);
});
