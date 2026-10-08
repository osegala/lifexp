import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as crypto from "node:crypto";

import { fixture } from "../test-support/ad-reward-fixture.mjs";

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
  const block = template.split("  AdRewardsFunction:\n")[1].split("  BillingFunction:\n")[0];
  assert.equal((block.match(/Authorizer: EvrenthiaCognito/g) ?? []).length, 3);
  assert.match(block, /Path: \/ads\/reward\/prepare/); assert.match(block, /Ref: ApiSharedLayer/);
  assert.doesNotMatch(block, /dynamodb:(?:Scan|DeleteItem|\*)/);
  assert.match(template, /DevRewardedAdsEnabled:[\s\S]*?Default: "false"/);
  assert.match(block, /Path: \/webhooks\/admob\/reward\n\s+Method: GET\n\s+Auth:\n\s+Authorizer: NONE/);
});
