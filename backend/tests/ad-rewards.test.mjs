import test from "node:test";
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

function fixture({ env = "dev", enabled = "true", timeZone = "America/New_York" } = {}) {
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
  const handler = load("index", imports, ["handler"], FixedDate,
    { TABLE_NAME: "local", ENVIRONMENT_NAME: env, DEV_REWARDED_ADS_ENABLED: enabled }).handler;
  const f = { items, calls, writes, addProfile, setNow: value => { now = value; }, beforeCommit: fn => { beforeTransaction = fn; },
    loseResponse: () => { failAfterCommit = true; }, setPremium: (id = "tester") => items.set(`USER#${id}/ENTITLEMENTS`,
      { PK: { S: `USER#${id}` }, SK: { S: "ENTITLEMENTS" }, plan: { S: "PREMIUM" }, subscriptionStatus: { S: "ACTIVE" } }),
    async call(method = "GET", body, userId = "tester", path = "/ads/reward") {
      const result = await handler({ requestContext: { http: { method }, authorizer: { jwt: { claims: { sub: userId } } } },
        rawPath: path, body: body === undefined ? undefined : JSON.stringify(body) });
      return { status: result.statusCode, data: JSON.parse(result.body) };
    },
    async prepare(id = "tester") { return this.call("POST", {}, id, "/ads/reward/prepare"); },
    async reward(eventId, id = "tester") { return this.call("POST", { providerEventId: eventId, rewardType: "COINS" }, id); }
  };
  return f;
}

test("FREE verified DEV completions grant exactly 10 coins three times; fourth grants nothing", async () => {
  const f = fixture();
  const before = structuredClone(f.items.get("USER#tester/PROFILE"));
  const tickets = await Promise.all([f.prepare(), f.prepare(), f.prepare(), f.prepare()]);
  for (let index = 0; index < 3; index++) {
    const result = await f.reward(tickets[index].data.providerEventId);
    assert.equal(result.status, 200); assert.equal(result.data.rewardCoins, 10);
    assert.equal(result.data.coins, 110 + index * 10); assert.equal(result.data.rewardedAdsUsedToday, index + 1);
    assert.equal(result.data.rewardedAdsRemainingToday, 2 - index);
  }
  const fourth = await f.reward(tickets[3].data.providerEventId);
  assert.equal(fourth.status, 429); assert.equal(fourth.data.error.code, "AD_DAILY_LIMIT");
  assert.equal((await f.prepare()).status, 429);
  assert.equal((await f.call()).data.coins, 130);
  for (const field of ["xp", "worldPoints"]) assert.deepEqual(f.items.get("USER#tester/PROFILE")[field], before[field]);
});

test("duplicate event is durable across retries and day rollover without another grant", async () => {
  const f = fixture(), ticket = (await f.prepare()).data.providerEventId;
  await f.reward(ticket); const writes = f.writes.length;
  assert.equal((await f.reward(ticket)).data.duplicate, true);
  assert.equal(f.writes.length, writes); assert.equal((await f.call()).data.coins, 110);
  f.setNow("2026-10-09T16:00:00Z");
  const replay = await f.reward(ticket); assert.equal(replay.data.duplicate, true);
  assert.equal(replay.data.rewardedAdsRemainingToday, 3); assert.equal(replay.data.originalGrantDate, "2026-10-08");
});

test("concurrent duplicate submissions grant once; concurrent distinct submissions cannot exceed the daily cap", async () => {
  const f = fixture(), ticket = (await f.prepare()).data.providerEventId;
  const results = await Promise.all([f.reward(ticket), f.reward(ticket), f.reward(ticket)]);
  assert.equal(results.filter(r => r.data.duplicate === false).length, 1);
  assert.equal((await f.call()).data.coins, 110);
  const tickets = await Promise.all([f.prepare(), f.prepare(), f.prepare()]);
  const more = await Promise.all(tickets.map(r => f.reward(r.data.providerEventId)));
  assert.equal(more.filter(r => r.status === 200).length, 2); assert.equal(more.filter(r => r.status === 429).length, 1);
  assert.equal((await f.call()).data.coins, 130);
});

test("lost transaction response retries the same receipt, never the coin grant", async t => {
  const f = fixture(), ticket = (await f.prepare()).data.providerEventId;
  const logs = []; t.mock.method(console, "error", value => logs.push(value));
  f.loseResponse(); assert.equal((await f.reward(ticket)).status, 500);
  const replay = await f.reward(ticket); assert.equal(replay.status, 200); assert.equal(replay.data.duplicate, true);
  assert.equal(replay.data.coins, 110); assert.ok(!JSON.stringify(logs).includes(ticket));
});

test("PREMIUM is denied and a concurrent subscription change invalidates the FREE transaction", async () => {
  const f = fixture(), ticket = (await f.prepare()).data.providerEventId;
  f.setPremium(); assert.equal((await f.reward(ticket)).status, 403); assert.equal((await f.prepare()).status, 403);
  assert.equal((await f.call()).status, 403);
  const g = fixture(), otherTicket = (await g.prepare()).data.providerEventId;
  g.beforeCommit(() => g.setPremium()); assert.equal((await g.reward(otherTicket)).status, 403);
  assert.equal(g.items.get("USER#tester/PROFILE").coins.N, "100");
});

test("production and disabled DEV verification fail closed even with a seeded DEV receipt", async () => {
  for (const options of [{ env: "prod" }, { env: "production" }, { env: "dev", enabled: "false" }, { env: "test" }]) {
    const f = fixture(options);
    assert.equal((await f.call()).data.available, false); assert.equal((await f.prepare()).status, 503);
    const eventId = "dev:seeded", key = crypto.createHash("sha256").update(eventId).digest("hex");
    f.items.set(`USER#tester/AD_RECEIPT#${key}`, { PK: { S: "USER#tester" }, SK: { S: `AD_RECEIPT#${key}` },
      providerEventId: { S: eventId }, provider: { S: "DEV_TEST" }, status: { S: "READY" }, expiresAt: { S: "2099-01-01" } });
    assert.equal((await f.reward(eventId)).status, 503); assert.equal(f.writes.length, 0);
  }
});

test("malformed, fabricated, expired, other-user and client-controlled coin requests are rejected", async () => {
  const f = fixture(); f.addProfile("other");
  const ticket = (await f.prepare()).data.providerEventId;
  for (const body of [{ providerEventId: ticket, rewardType: "COINS", coins: 10 }, { providerEventId: ticket, rewardType: "XP" },
    { providerEventId: "", rewardType: "COINS" }, { rewardType: "COINS" }]) assert.equal((await f.call("POST", body)).status, 400);
  assert.equal((await f.reward("dev:fabricated")).status, 403);
  assert.equal((await f.reward(ticket, "other")).status, 403);
  f.setNow("2026-10-08T16:11:00Z"); assert.equal((await f.reward(ticket)).status, 403);
  assert.equal((await f.call()).data.coins, 100);
});

test("profile timezone midnight, not UTC midnight, resets allowance; timezone changes reuse date buckets", async () => {
  const f = fixture(); f.setNow("2026-10-09T03:59:00Z");
  for (let i = 0; i < 3; i++) await f.reward((await f.prepare()).data.providerEventId);
  assert.equal((await f.call()).data.date, "2026-10-08"); assert.equal((await f.call()).data.rewardedAdsRemainingToday, 0);
  f.setNow("2026-10-09T04:00:00Z"); assert.equal((await f.call()).data.rewardedAdsRemainingToday, 3);
  await f.reward((await f.prepare()).data.providerEventId);
  f.items.get("USER#tester/PROFILE").timeZone.S = "America/Los_Angeles";
  assert.equal((await f.call()).data.date, "2026-10-08"); assert.equal((await f.call()).data.rewardedAdsRemainingToday, 0);
});

test("DST rollover and authoritative positive-offset calendar dates remain consistent", async () => {
  const f = fixture(); f.setNow("2026-11-01T05:30:00Z");
  await f.reward((await f.prepare()).data.providerEventId);
  f.setNow("2026-11-01T06:30:00Z"); assert.equal((await f.call()).data.rewardedAdsUsedToday, 1);
  f.setNow("2026-11-02T05:00:00Z"); assert.equal((await f.call()).data.rewardedAdsUsedToday, 0);
  f.items.get("USER#tester/PROFILE").timeZone.S = "Pacific/Kiritimati";
  f.setNow("2026-10-08T12:00:00Z"); assert.equal((await f.call()).data.date, "2026-10-09");
});

test("authentication, onboarding and account deletion remain protected; no orphan reward can recreate a profile", async () => {
  const f = fixture(); assert.equal((await f.call("GET", undefined, null)).status, 401);
  f.items.get("USER#tester/PROFILE").onboardingCompleted.BOOL = false; assert.equal((await f.prepare()).status, 403);
  f.items.get("USER#tester/PROFILE").onboardingCompleted.BOOL = true;
  const ticket = (await f.prepare()).data.providerEventId;
  f.beforeCommit(() => f.items.delete("USER#tester/PROFILE"));
  assert.equal((await f.reward(ticket)).status, 403); assert.equal(f.items.has("USER#tester/PROFILE"), false);
});

test("SAM exposes JWT-only status/prepare/claim routes with bounded permissions and disabled defaults", () => {
  const template = readFileSync(new URL("../template.yaml", import.meta.url), "utf8");
  const block = template.split("  AdRewardsFunction:\n")[1].split("  GetPreferencesFunction:\n")[0];
  assert.equal((block.match(/Authorizer: EvrenthiaCognito/g) ?? []).length, 3);
  assert.match(block, /Path: \/ads\/reward\/prepare/); assert.match(block, /Ref: ApiSharedLayer/);
  assert.doesNotMatch(block, /dynamodb:(?:Scan|DeleteItem|\*)/);
  assert.match(template, /DevRewardedAdsEnabled:[\s\S]*?Default: "false"/);
});
