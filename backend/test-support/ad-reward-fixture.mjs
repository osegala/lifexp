import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as crypto from "node:crypto";
import * as http from "../layers/api-shared/nodejs/http.mjs";
import * as dates from "../layers/api-shared/nodejs/dates.mjs";
import * as entitlements from "../layers/api-shared/nodejs/entitlements.mjs";
import * as logic from "../functions/ad-rewards/logic.mjs";

function load(file, imports, exports, DateClass = Date, env = {}) {
  const source = readFileSync(new URL(`../functions/ad-rewards/${file}.mjs`, import.meta.url), "utf8")
    .replace(/import\s*\{([^}]+)\}\s*from\s*"([^"]+)";/g, (_, members, path) => `const {${members}} = imports[${JSON.stringify(path)}];`)
    .replace(/export /g, "");
  return new Function("imports", "process", "Date", `${source}\nreturn {${exports.join(",")}};`)(imports, { env }, DateClass);
}

export function fixture({ env = "dev", enabled = "true", timeZone = "America/New_York", envVars = {}, request = async () => { throw new Error("Unexpected network request"); } } = {}) {
  const items = new Map(), writes = [], calls = [];
  let now = "2026-10-08T16:00:00.000Z", beforeTransaction, failAfterCommit = false;
  const key = item => `${item.PK.S}/${item.SK.S}`;
  const addProfile = (id, zone = timeZone) => items.set(`USER#${id}/PROFILE`, { PK: { S: `USER#${id}` }, SK: { S: "PROFILE" },
    coins: { N: "100" }, xp: { N: "350" }, worldPoints: { N: "412" }, timeZone: { S: zone }, onboardingCompleted: { BOOL: true } });
  addProfile("tester");
  class FixedDate extends Date { constructor(value) { super(value ?? now); } }
  class GetItemCommand { constructor(input) { this.input = input; } }
  class TransactWriteItemsCommand extends GetItemCommand {}
  function condition(operation) {
    const existing = items.get(key(operation.Key ?? operation.Item));
    const names = operation.ExpressionAttributeNames ?? {}, values = operation.ExpressionAttributeValues ?? {};
    const expression = operation.ConditionExpression;
    if (expression === "attribute_not_exists(PK)" || expression === "attribute_not_exists(PK) AND attribute_not_exists(SK)") return !existing;
    if (expression === "attribute_exists(PK)") return Boolean(existing);
    if (!existing) return false;
    return expression.split(" AND ").every(part => {
      if (part === "attribute_exists(PK)") return true;
      const absent = part.match(/^attribute_not_exists\((#[a-zA-Z]+)\)$/);
      if (absent) return !existing[names[absent[1]]];
      const comparison = part.match(/^(#[a-zA-Z]+) (=|<|>) (:[a-zA-Z]+)$/);
      assert.ok(comparison, `Unimplemented condition: ${part}`);
      const a = existing[names[comparison[1]]], b = values[comparison[3]];
      if (!a || !b) return false;
      if (comparison[2] === "=") return JSON.stringify(a) === JSON.stringify(b);
      const av = a.N == null ? a.S : Number(a.N), bv = b.N == null ? b.S : Number(b.N);
      return comparison[2] === "<" ? av < bv : av > bv;
    });
  }
  class DynamoDBClient {
    async send(command) {
      const input = command.input; calls.push(input);
      if (!(command instanceof TransactWriteItemsCommand)) {
        assert.equal(input.ConsistentRead, true); return { Item: structuredClone(items.get(key(input.Key))) };
      }
      if (beforeTransaction) { const fn = beforeTransaction; beforeTransaction = null; fn(); }
      const operations = input.TransactItems.map(x => x.ConditionCheck ?? x.Update ?? x.Put);
      if (!operations.every(condition)) throw Object.assign(new Error("conditional conflict"), { name: "TransactionCanceledException" });
      for (const entry of input.TransactItems) {
        if (entry.Put) items.set(key(entry.Put.Item), structuredClone(entry.Put.Item));
        if (entry.Update) {
          const i = entry.Update, storedKey = key(i.Key), current = items.get(storedKey) ?? structuredClone(i.Key);
          for (const assignment of i.UpdateExpression.slice(4).split(", ")) {
            const [name, value] = assignment.split(" = ");
            current[i.ExpressionAttributeNames[name]] = structuredClone(i.ExpressionAttributeValues[value]);
          }
          items.set(storedKey, current);
        }
      }
      writes.push(input);
      if (failAfterCommit) { failAfterCommit = false; throw new Error("ambiguous transport timeout"); }
      return {};
    }
  }
  const imports = { "node:crypto": crypto, "/opt/nodejs/http.mjs": http, "/opt/nodejs/dates.mjs": dates,
    "/opt/nodejs/entitlements.mjs": entitlements, "./logic.mjs": logic,
    "@aws-sdk/client-dynamodb": { DynamoDBClient, GetItemCommand, TransactWriteItemsCommand } };
  imports["./verification.mjs"] = load("verification", imports, ["receiptKey", "rewardVerifier"], FixedDate);
  const admob = load("admob", imports, ["admobVerifier", "transactionKey"], FixedDate);
  imports["./admob.mjs"] = { ...admob, admobVerifier: env => admob.admobVerifier(env, request) };
  const handler = load("index", imports, ["handler"], FixedDate,
    { TABLE_NAME: "local", ENVIRONMENT_NAME: env, DEV_REWARDED_ADS_ENABLED: enabled, ...envVars }).handler;
  const f = { items, calls, writes, addProfile, setNow: value => { now = value; }, beforeCommit: fn => { beforeTransaction = fn; },
    loseResponse: () => { failAfterCommit = true; }, setPremium: (id = "tester") => items.set(`USER#${id}/ENTITLEMENTS`,
      { PK: { S: `USER#${id}` }, SK: { S: "ENTITLEMENTS" }, plan: { S: "PREMIUM" }, subscriptionStatus: { S: "ACTIVE" } }),
    async call(method = "GET", body, userId = "tester", path = "/ads/reward", queryStringParameters, rawQueryString) {
      const result = await handler({ requestContext: { http: { method }, authorizer: { jwt: { claims: { sub: userId } } } },
        rawPath: path, queryStringParameters, rawQueryString, body: body === undefined ? undefined : JSON.stringify(body) });
      return { status: result.statusCode, data: JSON.parse(result.body) };
    },
    async prepare(id = "tester") { return this.call("POST", {}, id, "/ads/reward/prepare"); },
    async reward(eventId, id = "tester") { return this.call("POST", { providerEventId: eventId, rewardType: "COINS" }, id); }
  };
  return f;
}

