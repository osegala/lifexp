import test from "node:test";
import assert from "node:assert/strict";
import {
    assertDevTarget,
    assertEqual,
    assertStatus,
    assertTruthy,
    CleanupStack,
    cognitoAuthArgs,
    generateRunId,
    IntegrationAssertionError,
    parseMode,
    parseStackOutputs,
    redactSensitive,
    resolveAwsProfile,
    sanitizedAwsCliError
} from "../scripts/integration-test-helpers.mjs";

const devTarget = {
    stackName: "evrenthia-dev",
    tableName: "Evrenthia-Dev",
    apiUrl: "https://abc123.execute-api.us-east-2.amazonaws.com",
    region: "us-east-2",
    functionNames: ["Evrenthia-Dev-GetMe", "Evrenthia-Dev-CreateProfile"]
};

test("integration safety accepts only matching development targets", () => {
    assert.equal(assertDevTarget(devTarget), true);
    assert.throws(() => assertDevTarget({ ...devTarget, stackName: "evrenthia-prod" }), /non-development stack/);
    assert.throws(() => assertDevTarget({ ...devTarget, tableName: "Evrenthia" }), /non-development table/);
    assert.throws(() => assertDevTarget({ ...devTarget, apiUrl: "https://example.com" }), /selected AWS region/);
    assert.throws(() => assertDevTarget({ ...devTarget, functionNames: ["Evrenthia-Prod-GetMe"] }), /development-scoped Lambda/);
});

test("integration output redaction removes credentials and tokens", () => {
    const password = "correct-horse-battery-staple";
    const redacted = redactSensitive({
        password,
        authorization: "Bearer jwt-value",
        message: `request used ${password} and ExpoPushToken[private-device-token]`
    }, [password]);

    assert.doesNotMatch(redacted, /correct-horse|jwt-value|private-device-token/);
    assert.match(redacted, /REDACTED/);
});

test("Cognito authentication uses direct AWS CLI arguments without stdin paramfiles", () => {
    const args = cognitoAuthArgs({
        region: "us-east-2",
        clientId: "client-123",
        email: "tester@example.com",
        password: "password,with=specials",
        profile: "evrenthia-admin"
    });

    assert.deepEqual(args, [
        "cognito-idp", "initiate-auth",
        "--region", "us-east-2",
        "--auth-flow", "USER_PASSWORD_AUTH",
        "--client-id", "client-123",
        "--auth-parameters", JSON.stringify({
            USERNAME: "tester@example.com",
            PASSWORD: "password,with=specials"
        }),
        "--query", "AuthenticationResult.IdToken",
        "--output", "text",
        "--profile", "evrenthia-admin"
    ]);
    assert.doesNotMatch(args.join(" "), /file:\/\/\/dev\/stdin|cli-input-json/);
});

test("AWS profile resolution preserves local defaults and supports ambient CI credentials", () => {
    assert.equal(resolveAwsProfile({}), "evrenthia-admin");
    assert.equal(resolveAwsProfile({ EVRENTHIA_AWS_PROFILE: "local-admin" }), "local-admin");
    assert.equal(resolveAwsProfile({ EVRENTHIA_AWS_PROFILE: "" }), null);
    assert.equal(resolveAwsProfile({ GITHUB_ACTIONS: "true" }), null);

    const args = cognitoAuthArgs({
        region: "us-east-2",
        clientId: "client-123",
        email: "tester@example.com",
        password: "password",
        profile: null
    });
    assert.equal(args.includes("--profile"), false);
});

test("sanitized AWS CLI failures never expose passwords or ID tokens", () => {
    const password = "dev-password-secret";
    const idToken = "eyJhbGciOiJub25lIn0.private-id-token.signature";
    const error = sanitizedAwsCliError(
        `authentication failed password=${password} token=${idToken} Authorization=Bearer ${idToken}`,
        [password, idToken]
    );

    assert.doesNotMatch(error.message, /dev-password-secret|private-id-token/);
    assert.match(error.message, /REDACTED/);
});

test("integration response assertions report controlled failures", () => {
    assert.equal(assertStatus({ status: 200 }, 200).status, 200);
    assert.equal(assertEqual("a", "a"), "a");
    assert.deepEqual(assertTruthy([1]), [1]);
    assert.throws(() => assertStatus({ status: 500, body: { error: { code: "NO" } } }, 200), IntegrationAssertionError);
    assert.throws(() => assertEqual(1, 2), IntegrationAssertionError);
    assert.throws(() => assertTruthy(false), IntegrationAssertionError);
});

test("integration cleanup runs in reverse registration order and can be cancelled", async () => {
    const cleanup = new CleanupStack();
    const order = [];
    cleanup.add("first", async () => order.push("first"));
    const cancel = cleanup.add("cancelled", async () => order.push("cancelled"));
    cleanup.add("last", async () => order.push("last"));
    cancel();

    assert.equal(cleanup.size, 2);
    assert.deepEqual(await cleanup.run(), []);
    assert.deepEqual(order, ["last", "first"]);
    assert.equal(cleanup.size, 0);
});

test("integration cleanup continues after a cleanup failure", async () => {
    const cleanup = new CleanupStack();
    const order = [];
    cleanup.add("survivor", async () => order.push("survivor"));
    cleanup.add("failure", async () => { throw new Error("cleanup failed"); });

    const failures = await cleanup.run();
    assert.equal(failures.length, 1);
    assert.equal(failures[0].label, "failure");
    assert.deepEqual(order, ["survivor"]);
});

test("integration run IDs include time and fresh entropy", () => {
    let value = 0;
    const random = () => Buffer.alloc(4, value++);
    const now = new Date("2026-09-23T12:34:56.789Z");
    const first = generateRunId(now, random);
    const second = generateRunId(now, random);

    assert.match(first, /^it-20260923123456789-[0-9a-f]{8}$/);
    assert.notEqual(first, second);
});

test("integration CLI parsing defaults to read-only and validates modes", () => {
    assert.deepEqual(parseMode([]), { mode: "read-only", confirmDev: false });
    assert.deepEqual(parseMode(["--read-only"]), { mode: "read-only", confirmDev: false });
    assert.deepEqual(parseMode(["--full", "--confirm-dev"]), { mode: "full", confirmDev: true });
    assert.throws(() => parseMode(["--full", "--read-only"]), /either/);
    assert.throws(() => parseMode(["--production"]), /Unknown argument/);
});

test("integration stack output parsing maps CloudFormation outputs", () => {
    const outputs = parseStackOutputs(JSON.stringify([
        { OutputKey: "DevApiUrl", OutputValue: devTarget.apiUrl },
        { OutputKey: "DevTableName", OutputValue: devTarget.tableName },
        { OutputKey: "IgnoredWithoutValue" }
    ]));
    assert.deepEqual(outputs, {
        DevApiUrl: devTarget.apiUrl,
        DevTableName: devTarget.tableName
    });
    assert.throws(() => parseStackOutputs({}), /must be an array/);
});
