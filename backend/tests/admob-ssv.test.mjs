import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import { fixture } from "../test-support/ad-reward-fixture.mjs";

const now = Date.parse("2026-10-08T16:00:00Z");
const unit = "ca-app-pub-3940256099942544/5224354917";
const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
const publicPem = publicKey.export({ type: "spki", format: "pem" });
const envVars = { ADMOB_SSV_ENABLED: "true", ADMOB_CLAIM_SECRET: Buffer.alloc(32, 7).toString("base64"), ADMOB_ANDROID_REWARDED_UNIT_ID: unit };

function setup(options = {}) {
  const keyCalls = [];
  const f = fixture({ envVars, request: async url => { keyCalls.push(url); return { ok: true, json: async () => ({ keys: [{ keyId: 123, pem: publicPem }] }) }; }, ...options });
  f.keyCalls = keyCalls;
  f.prepareNative = async id => f.call("POST", { provider: "ADMOB", platform: "ANDROID" }, id ?? "tester", "/ads/reward/prepare");
  f.statusNative = async (claimId, id = "tester") => f.call("GET", undefined, id, "/ads/reward", { provider: "ADMOB", ...(claimId ? { claimId } : {}) });
  f.callback = async raw => f.call("GET", undefined, null, "/webhooks/admob/reward", undefined, raw);
  f.query = (ticket, overrides = {}) => {
    const fields = { ad_network: "fixture", ad_unit: unit, custom_data: ticket.providerEventId, reward_amount: "10", reward_item: "coins",
      timestamp: String(now), transaction_id: `txn:${ticket.binding}`, user_id: ticket.binding, ...overrides };
    const content = Object.entries(fields).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&");
    return `${content}&signature=${sign("sha256", Buffer.from(content), privateKey).toString("base64url")}&key_id=123`;
  };
  return f;
}

test("real ECDSA SSV consumes encrypted prepared claim atomically; client callbacks cannot grant and polling returns server coins", async () => {
  const f = setup(), ticket = (await f.prepareNative()).data;
  assert.equal(ticket.devSimulation, false); assert.equal(ticket.adUnitId, unit);
  assert.ok(!ticket.providerEventId.includes("tester")); assert.ok(!ticket.binding.includes("tester"));
  const before = await f.statusNative(ticket.providerEventId); assert.equal(before.data.claimStatus, "READY"); assert.equal(before.data.coins, 100);
  assert.notEqual((await f.reward(ticket.providerEventId)).status, 200);
  const confirmed = await f.callback(f.query(ticket)); assert.equal(confirmed.status, 200); assert.equal(confirmed.data.coins, 110);
  const after = await f.statusNative(ticket.providerEventId); assert.equal(after.data.claimStatus, "GRANTED"); assert.equal(after.data.coins, 110);
  assert.equal(f.items.get("USER#tester/PROFILE").worldPoints.N, "412");
});

test("invalid signature, altered signed bytes, unknown key, duplicate/malformed parameters are rejected", async () => {
  const f = setup(), ticket = (await f.prepareNative()).data, raw = f.query(ticket);
  for (const invalid of [raw.replace("reward_amount=10", "reward_amount=99"), raw.replace("key_id=123", "key_id=999"),
    raw.replace("&signature=", "&user_id=other&signature="), raw.replace(/signature=[^&]+/, "signature=invalid"), "", "timestamp=1"])
    assert.equal((await f.callback(invalid)).status, 403);
  assert.equal(f.items.get("USER#tester/PROFILE").coins.N, "100");
  assert.equal(f.keyCalls.length, 1); assert.equal(f.keyCalls[0], "https://www.gstatic.com/admob/reward/verifier-keys.json");
});

test("signed wrong unit/reward/binding/time and missing or tampered claims cannot grant", async () => {
  const f = setup(), ticket = (await f.prepareNative()).data;
  for (const fields of [{ ad_unit: "ca-app-pub-0/0" }, { reward_amount: "99" }, { reward_item: "xp" }, { user_id: "other" },
    { timestamp: String(now - 11 * 60_000) }, { timestamp: String(now + 120_000) }, { custom_data: ticket.providerEventId.slice(0, -3) + "bad" }])
    assert.equal((await f.callback(f.query(ticket, fields))).status, 403);
  f.items.clear(); assert.equal((await f.callback(f.query(ticket))).status, 403);
});

test("expired claim and cross-account status lookup fail; a deleted profile is never recreated", async () => {
  const f = setup(), ticket = (await f.prepareNative()).data; f.addProfile("other");
  assert.equal((await f.statusNative(ticket.providerEventId, "other")).status, 403);
  f.setNow(new Date(now + 11 * 60_000).toISOString());
  assert.equal((await f.callback(f.query(ticket, { timestamp: String(now + 11 * 60_000) }))).status, 403);
  const g = setup(), second = (await g.prepareNative()).data;
  g.beforeCommit(() => g.items.delete("USER#tester/PROFILE"));
  assert.equal((await g.callback(g.query(second))).status, 403); assert.equal(g.items.has("USER#tester/PROFILE"), false);
});

test("duplicate transaction and concurrent callbacks grant once; distinct fourth receipt grants zero", async () => {
  const f = setup(), ticket = (await f.prepareNative()).data, raw = f.query(ticket);
  const duplicates = await Promise.all([f.callback(raw), f.callback(raw), f.callback(raw)]);
  assert.ok(duplicates.every(r => r.status === 200)); assert.equal(f.items.get("USER#tester/PROFILE").coins.N, "110");
  const tickets = await Promise.all([f.prepareNative(), f.prepareNative(), f.prepareNative()]);
  const more = await Promise.all(tickets.map(t => f.callback(f.query(t.data))));
  assert.equal(more.filter(r => r.status === 200).length, 2); assert.equal(more.filter(r => r.status === 429).length, 1);
  assert.equal(f.items.get("USER#tester/PROFILE").coins.N, "130");
  const receipt = tickets.find((_, i) => more[i].status === 429).data;
  assert.equal((await f.callback(f.query(receipt, { transaction_id: `txn:${ticket.binding}` }))).data.duplicate, true);
  assert.equal(f.items.get("USER#tester/PROFILE").coins.N, "130");
});

test("Premium blocks prepare and SSV, including a subscription race; unknown/disabled backend fails closed", async () => {
  const f = setup(), ticket = (await f.prepareNative()).data; f.setPremium();
  assert.equal((await f.prepareNative()).status, 403); assert.equal((await f.callback(f.query(ticket))).status, 403);
  const g = setup(), race = (await g.prepareNative()).data; g.beforeCommit(() => g.setPremium());
  assert.equal((await g.callback(g.query(race))).status, 403); assert.equal(g.items.get("USER#tester/PROFILE").coins.N, "100");
  for (const config of [{}, { ADMOB_SSV_ENABLED: "true" }, { ...envVars, ADMOB_CLAIM_SECRET: "bad" }]) {
    const h = setup({ envVars: config }); assert.equal((await h.prepareNative()).status, 503);
  }
  assert.equal((await setup({ env: "prod", envVars }).prepareNative()).status, 503);
});

test("signed callbacks retain authoritative profile-local rollover and provider-key cache expires within 24h", async () => {
  const f = setup(); f.setNow("2026-10-09T03:59:00Z");
  for (let i = 0; i < 3; i++) { const ticket = (await f.prepareNative()).data; assert.equal((await f.callback(f.query(ticket, { timestamp: String(Date.parse("2026-10-09T03:59:00Z")) }))).status, 200); }
  assert.equal((await f.statusNative()).data.rewardedAdsRemainingToday, 0);
  assert.equal(f.keyCalls.length, 1);
  f.setNow("2026-10-09T04:00:00Z"); assert.equal((await f.statusNative()).data.rewardedAdsRemainingToday, 3);
  f.setNow("2026-10-09T10:00:00Z");
  const ticket = (await f.prepareNative()).data;
  assert.equal((await f.callback(f.query(ticket, { timestamp: String(Date.parse("2026-10-09T10:00:00Z")) }))).status, 200);
  assert.equal(f.keyCalls.length, 2);
});

test("provider key fetch failure grants nothing and emits no token/claim to logs", async t => {
  const logs = []; t.mock.method(console, "error", x => logs.push(x));
  const f = setup({ request: async () => { throw new Error("provider failure"); } });
  const ticket = (await f.prepareNative()).data; assert.equal((await f.callback(f.query(ticket))).status, 503);
  assert.equal(f.items.get("USER#tester/PROFILE").coins.N, "100"); assert.equal(logs.length, 0);
});
