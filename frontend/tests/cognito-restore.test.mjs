import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";

function authFixture(tokens) {
  const calls = [], exports = {};
  const source = ts.transpileModule(readFileSync(new URL("../src/auth/cognito.ts", import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS }
  }).outputText;
  const imports = { "aws-amplify": { Amplify: { configure() {} } }, "../config/environment": { environment: {} },
    "aws-amplify/auth": { fetchAuthSession: async options => { calls.push(options); return { tokens }; },
      fetchUserAttributes: () => assert.fail("Attributes must not add a network dependency to restore"),
      getCurrentUser: () => assert.fail("The restored token already supplies the account subject") } };
  new Function("require", "exports", source)(id => imports[id], exports);
  return { auth: exports.cognitoAuth, calls };
}

test("Cognito restore uses Amplify's ID-token subject/email without an attributes network request", async () => {
  const f = authFixture({ idToken: { payload: { sub: "alice", email: "alice@example.test" }, toString: () => "sdk-token" } });
  assert.deepEqual(await f.auth.getSession(), { userId: "alice", email: "alice@example.test", token: "sdk-token" });
  assert.deepEqual(f.calls, [{ forceRefresh: false }]);
  await f.auth.getSession(true); assert.deepEqual(f.calls[1], { forceRefresh: true });
});

test("missing tokens/subjects never establish an account and missing email does not block restore", async () => {
  for (const tokens of [undefined, {}, { idToken: { payload: {} } }, { idToken: { payload: { sub: "" } } }]) assert.equal(await authFixture(tokens).auth.getSession(), null);
  const f = authFixture({ idToken: { payload: { sub: "bob" }, toString: () => "sdk-token" } });
  assert.equal((await f.auth.getSession()).email, "");
});
