import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as crypto from "node:crypto";
import * as profileLogic from "../functions/update-me/logic.mjs";
import { profilePutRequest } from "../functions/create-profile/logic.mjs";
import * as http from "../layers/api-shared/nodejs/http.mjs";
import * as appearance from "../layers/api-shared/nodejs/appearance.mjs";
import * as leveling from "../layers/api-shared/nodejs/leveling.mjs";
import * as tasks from "../layers/api-shared/nodejs/task-input.mjs";
import * as rewards from "../layers/api-shared/nodejs/task-rewards.mjs";
import * as dates from "../layers/api-shared/nodejs/dates.mjs";

function fixture() {
  const items = new Map(), writes = [];
  const key = item => `${item.PK.S}/${item.SK.S}`;
  class GetItemCommand { constructor(input) { this.input = input; } }
  class PutItemCommand extends GetItemCommand {}
  class UpdateItemCommand extends GetItemCommand {}
  class DynamoDBClient {
    async send(command) {
      const input = command.input;
      if (command instanceof PutItemCommand) {
        if (items.has(key(input.Item))) throw Object.assign(new Error(), { name: "ConditionalCheckFailedException" });
        writes.push(input); items.set(key(input.Item), structuredClone(input.Item)); return {};
      }
      if (command instanceof UpdateItemCommand) {
        const current = items.get(key(input.Key));
        assert.ok(current); assert.match(input.ConditionExpression, /attribute_exists/);
        for (const [field, value] of Object.entries(input.ExpressionAttributeValues)) current[field.slice(1)] = value;
        writes.push(input); return { Attributes: structuredClone(current) };
      }
      return { Item: structuredClone(items.get(key(input.Key))) };
    }
  }
  const sdk = { DynamoDBClient, GetItemCommand, PutItemCommand, UpdateItemCommand };
  const imports = { "node:crypto": crypto, "@aws-sdk/client-dynamodb": sdk,
    "./logic.mjs": profileLogic, "/opt/nodejs/http.mjs": http, "/opt/nodejs/appearance.mjs": appearance,
    "/opt/nodejs/leveling.mjs": leveling, "/opt/nodejs/task-input.mjs": tasks,
    "/opt/nodejs/task-rewards.mjs": rewards, "/opt/nodejs/dates.mjs": dates, "/opt/nodejs/notification-wakeup.mjs": {} };
  const handlers = Object.fromEntries(["get-me", "update-me", "create-task"].map(name => {
    const source = readFileSync(new URL(`../functions/${name}/index.mjs`, import.meta.url), "utf8")
      .replace(/import\s*\{([^}]+)\}\s*from\s*"([^"]+)";/g, (_, members, path) => `const {${members.replace(/\bas\b/g, ":")}} = imports[${JSON.stringify(path)}];`)
      .replace(/export const handler\s*=/, "const handler =");
    return [name, new Function("imports", "process", `${source}\nreturn handler;`)(imports, { env: { TABLE_NAME: "local" } })];
  }));
  function addUser(id, legacy = false) {
    const request = profilePutRequest("local", { request: { userAttributes: { sub: id, email: "same@example.test" } } });
    if (legacy) delete request.Item.onboardingCompleted;
    items.set(key(request.Item), request.Item);
    return request;
  }
  return { items, writes, addUser, async call(name, body, id = "new") {
    const response = await handlers[name]({ requestContext: { authorizer: { jwt: { claims: { sub: id } } } }, body: JSON.stringify(body) });
    return { status: response.statusCode, data: JSON.parse(response.body) };
  } };
}

test("new and recreated Cognito profiles explicitly start incomplete without overwriting a duplicate profile", () => {
  const f = fixture(), original = f.addUser("old-sub"), recreated = f.addUser("new-sub");
  assert.deepEqual(original.Item.onboardingCompleted, { BOOL: false });
  assert.deepEqual(recreated.Item.onboardingCompleted, { BOOL: false });
  assert.notEqual(original.Item.PK.S, recreated.Item.PK.S);
  assert.equal(original.ConditionExpression, "attribute_not_exists(PK) AND attribute_not_exists(SK)");
});

test("real GET me returns false for new users, true for legacy users without mutating legacy data", async () => {
  const f = fixture(); f.addUser("new"); f.addUser("legacy", true);
  assert.equal((await f.call("get-me", undefined)).data.onboardingCompleted, false);
  assert.equal((await f.call("get-me", undefined, "legacy")).data.onboardingCompleted, true);
  assert.equal(f.items.get("USER#legacy/PROFILE").onboardingCompleted, undefined);
  assert.equal(f.writes.length, 0);
});

test("real PATCH me persists a DynamoDB BOOL and GET reflects completion while rewards/appearance remain intact", async () => {
  const f = fixture(); f.addUser("new");
  const before = structuredClone(f.items.get("USER#new/PROFILE"));
  const result = await f.call("update-me", { onboardingCompleted: true });
  assert.equal(result.status, 200); assert.equal(result.data.onboardingCompleted, true);
  assert.deepEqual(f.writes[0].ExpressionAttributeValues[":onboardingCompleted"], { BOOL: true });
  assert.equal((await f.call("get-me", undefined)).data.onboardingCompleted, true);
  for (const field of ["xp", "coins", "worldPoints", "tasksCompleted", ...Object.keys(appearance.APPEARANCE_VALUES)]) {
    assert.deepEqual(f.items.get("USER#new/PROFILE")[field], before[field]);
  }
  f.addUser("legacy", true);
  assert.equal((await f.call("update-me", { displayName: "Hero" }, "legacy")).data.onboardingCompleted, true);
});

test("onboarding patch accepts booleans only and never admits arbitrary profile mutations", async () => {
  const f = fixture(); f.addUser("new");
  for (const onboardingCompleted of [null, "true", "false", 1, 0, {}, []]) {
    const result = await f.call("update-me", { onboardingCompleted });
    assert.equal(result.status, 400); assert.equal(result.data.error.code, "INVALID_ONBOARDING_COMPLETED");
  }
  assert.deepEqual(profileLogic.validateProfilePatch({ onboardingCompleted: false }), { onboardingCompleted: false });
  assert.equal((await f.call("update-me", { onboardingCompleted: true, xp: 1000 })).status, 400);
  assert.equal(f.writes.length, 0);
});

test("task retry after a lost create response reuses the record and preserves later completion/edits", async () => {
  const f = fixture(); f.addUser("new");
  const input = { title: "Read", repeatType: "DAILY", clientRequestId: "setup-stable-retry-key" };
  const created = await f.call("create-task", input);
  assert.equal(created.status, 201);
  const saved = f.items.get(`USER#new/TASK#${created.data.taskId}`);
  saved.completed = { BOOL: true }; saved.title = { S: "Edited later" };
  for (let i = 0; i < 3; i++) {
    const replay = await f.call("create-task", input);
    assert.equal(replay.status, 200); assert.equal(replay.data.taskId, created.data.taskId);
  }
  assert.equal(f.writes.length, 1); assert.equal(saved.completed.BOOL, true); assert.equal(saved.title.S, "Edited later");
  assert.equal((await f.call("create-task", { ...input, title: "Different request" })).status, 409);
});

test("retry keys are user scoped, not title based; distinct confirmed tasks can share a title", async () => {
  const f = fixture(); f.addUser("new"); f.addUser("other");
  const input = { title: "Read", clientRequestId: "setup-stable-retry-key" };
  const first = await f.call("create-task", input);
  const other = await f.call("create-task", input, "other");
  const another = await f.call("create-task", { ...input, clientRequestId: "setup-another-retry-key" });
  assert.equal(new Set([first.data.taskId, other.data.taskId, another.data.taskId]).size, 3);
  assert.equal(f.writes.length, 3);
  for (const clientRequestId of [true, null, "short", "contains.invalid.characters", "x".repeat(81)]) {
    assert.equal((await f.call("create-task", { title: "Read", clientRequestId })).status, 400);
  }
  assert.throws(() => tasks.validateTaskPatch({ clientRequestId: input.clientRequestId }, {}), { code: "VALIDATION_ERROR" });
});
