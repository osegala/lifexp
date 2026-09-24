import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  AWS_REGION,
  DEV_COGNITO_CLIENT_ID,
  DEV_COGNITO_USER_POOL_ID,
  PROD_API_URL,
  PROD_COGNITO_CLIENT_ID,
  PROD_COGNITO_USER_POOL_ID,
  resolveEnvironment,
} from "../src/config/environment-core.ts";

const frontend = fileURLToPath(new URL("../", import.meta.url));
const read = path => readFileSync(`${frontend}/${path}`, "utf8");

function sourceFiles(directory) {
  return readdirSync(`${frontend}/${directory}`, { recursive: true, withFileTypes: true })
    .filter(entry => entry.isFile() && /\.(?:ts|tsx)$/.test(entry.name))
    .map(entry => readFileSync(`${entry.parentPath}/${entry.name}`, "utf8"))
    .join("\n");
}

const devValues = {
  EXPO_PUBLIC_APP_ENV: "dev",
  EXPO_PUBLIC_AWS_REGION: AWS_REGION,
  EXPO_PUBLIC_API_URL: "https://dev123.execute-api.us-east-2.amazonaws.com",
  EXPO_PUBLIC_COGNITO_USER_POOL_ID: DEV_COGNITO_USER_POOL_ID,
  EXPO_PUBLIC_COGNITO_CLIENT_ID: DEV_COGNITO_CLIENT_ID,
};

const prodValues = {
  EXPO_PUBLIC_APP_ENV: "prod",
  EXPO_PUBLIC_AWS_REGION: AWS_REGION,
  EXPO_PUBLIC_API_URL: PROD_API_URL,
  EXPO_PUBLIC_COGNITO_USER_POOL_ID: PROD_COGNITO_USER_POOL_ID,
  EXPO_PUBLIC_COGNITO_CLIENT_ID: PROD_COGNITO_CLIENT_ID,
};

test("canonical environment configuration loads development without defaulting to production", () => {
  assert.deepEqual(resolveEnvironment(devValues), {
    environment: "dev",
    awsRegion: AWS_REGION,
    apiUrl: devValues.EXPO_PUBLIC_API_URL,
    cognitoUserPoolId: DEV_COGNITO_USER_POOL_ID,
    cognitoClientId: DEV_COGNITO_CLIENT_ID,
  });
  assert.equal(resolveEnvironment({ ...devValues, EXPO_PUBLIC_APP_ENV: undefined }).environment, "dev");
});

test("canonical environment configuration loads the exact production backend", () => {
  assert.deepEqual(resolveEnvironment(prodValues), {
    environment: "prod",
    awsRegion: AWS_REGION,
    apiUrl: PROD_API_URL,
    cognitoUserPoolId: PROD_COGNITO_USER_POOL_ID,
    cognitoClientId: PROD_COGNITO_CLIENT_ID,
  });
});

test("development and production resources cannot be cross-wired", () => {
  for (const override of [
    { EXPO_PUBLIC_API_URL: PROD_API_URL },
    { EXPO_PUBLIC_COGNITO_USER_POOL_ID: PROD_COGNITO_USER_POOL_ID },
    { EXPO_PUBLIC_COGNITO_CLIENT_ID: PROD_COGNITO_CLIENT_ID },
  ]) {
    assert.throws(() => resolveEnvironment({ ...devValues, ...override }), /cross-wired/);
  }
  for (const override of [
    { EXPO_PUBLIC_API_URL: devValues.EXPO_PUBLIC_API_URL },
    { EXPO_PUBLIC_COGNITO_USER_POOL_ID: DEV_COGNITO_USER_POOL_ID },
    { EXPO_PUBLIC_COGNITO_CLIENT_ID: DEV_COGNITO_CLIENT_ID },
  ]) {
    assert.throws(() => resolveEnvironment({ ...prodValues, ...override }), /does not match/);
  }
});

test("missing and malformed production configuration fails fast", () => {
  for (const values of [
    { ...prodValues, EXPO_PUBLIC_API_URL: "http://ifzeath0p5.execute-api.us-east-2.amazonaws.com" },
    { ...prodValues, EXPO_PUBLIC_API_URL: "https://example.com" },
    { ...prodValues, EXPO_PUBLIC_API_URL: "https://REPLACE_WITH_API_ID.execute-api.us-east-2.amazonaws.com" },
    { ...prodValues, EXPO_PUBLIC_COGNITO_USER_POOL_ID: "us-west-2_wrong" },
    { ...prodValues, EXPO_PUBLIC_COGNITO_CLIENT_ID: "" },
    { ...prodValues, EXPO_PUBLIC_AWS_REGION: "us-west-2" },
    { ...prodValues, EXPO_PUBLIC_APP_ENV: "production" },
  ]) assert.throws(() => resolveEnvironment(values));
});

test("auth and API modules consume the one canonical runtime configuration", () => {
  const auth = read("src/auth/cognito.ts");
  const client = read("src/api/client.ts");
  assert.match(auth, /from "\.\.\/config\/environment"/);
  assert.match(auth, /userPoolId: environment\.cognitoUserPoolId/);
  assert.match(auth, /userPoolClientId: environment\.cognitoClientId/);
  assert.match(client, /from "\.\.\/config\/environment"/);
  assert.match(client, /baseURL: API_BASE_URL/);
  assert.match(client, /API_BASE_URL = environment\.apiUrl/);
  assert.doesNotMatch(`${auth}\n${client}`, /process\.env|Constants\.expoConfig/);
});

test("EAS production selects only the approved public production configuration", () => {
  const eas = JSON.parse(read("eas.json"));
  assert.equal(eas.build.development.env.EXPO_PUBLIC_APP_ENV, "dev");
  assert.equal(eas.build.preview.env.EXPO_PUBLIC_APP_ENV, "dev");
  assert.deepEqual(eas.build.production.env, prodValues);
});

test("frontend source embeds no credential variables and makes no LIVE-delivery assumption", () => {
  const source = `${sourceFiles("src")}\n${sourceFiles("app")}`;
  assert.doesNotMatch(source, /AWS_ACCESS_KEY_ID|AWS_SECRET_ACCESS_KEY|EVRENTHIA_(?:PROD_)?TEST_PASSWORD/);
  assert.doesNotMatch(source, /EXPO_PUBLIC_[A-Z_]*(?:PASSWORD|TOKEN|SECRET|ACCESS_KEY)/);
  assert.doesNotMatch(source, /PUSH_DELIVERY_MODE|deliveryMode\s*[:=]\s*["']LIVE["']/);
  assert.doesNotMatch(source, /http:\/\/[^\s"']*:8080/);
});
