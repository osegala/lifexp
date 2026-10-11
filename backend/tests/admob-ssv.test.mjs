import test from "node:test";
import assert from "node:assert/strict";
import { createCipheriv, createDecipheriv, generateKeyPairSync, sign, verify } from "node:crypto";
import { fixture } from "../test-support/ad-reward-fixture.mjs";
import { diagnosticReason } from "../functions/ad-rewards/diagnostics.mjs";

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
    const content = Object.entries(fields).filter(([, value]) => value !== undefined).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&");
    return `${content}&signature=${sign("sha256", Buffer.from(decodeURIComponent(content), "utf8"), { key: privateKey, dsaEncoding: "der" }).toString("base64url")}&key_id=123`;
  };
  return f;
}

// Google's reference verifier signs the percent-decoded query (URI.getQuery()), in original order.
// Use an AdMob-shaped callback and a local P-256 key, not a captured Google callback.
function signedCallback(ticket, encoding = "der") {
  const customData = encodeURIComponent(ticket.providerEventId).replace("adm%3A", "%61%64%6d%3a");
  const content = `ad_network=5450213213286189855&ad_unit=${unit.split("/")[1]}&custom_data=${customData}`
    + `&reward_amount=10&reward_item=coins&timestamp=${now}&transaction_id=18fa792de1bca816048293fc71035638&user_id=${ticket.binding}`;
  const decodedContent = decodeURIComponent(content);
  const signature = sign("sha256", Buffer.from(decodedContent, "utf8"), { key: privateKey, dsaEncoding: encoding });
  // Percent-encode the signature itself too, including base64url padding when present.
  const encodedSignature = [...signature.toString("base64").replace(/\+/g, "-").replace(/\//g, "_")]
    .map(c => `%${c.charCodeAt(0).toString(16)}`).join("");
  return { content, decodedContent, signature, raw: `${content}&signature=${encodedSignature}&key_id=123` };
}

function encryptedClaim(plaintext, aad = "EVRENTHIA_ADMOB_COINS_V1") {
  const iv = Buffer.alloc(12, 9), cipher = createCipheriv("aes-256-gcm", Buffer.from(envVars.ADMOB_CLAIM_SECRET, "base64"), iv);
  cipher.setAAD(Buffer.from(aad));
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return `adm:${Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64url")}`;
}

test("API Gateway v2 query is percent-decoded once for SHA-256/DER; parsed parameters never supply the signed payload", async t => {
  captureDiagnostics(t);
  const verified = [], f = setup({ verifySignature: (...args) => { verified.push(args); return verify(...args); } });
  const ticket = (await f.prepareNative()).data, signed = signedCallback(ticket);
  const parsed = { ...Object.fromEntries(new URLSearchParams(signed.raw)), custom_data: "invalid-claim", signature: "invalid", key_id: "999" };
  const result = await f.call("GET", undefined, null, "/webhooks/admob/reward", parsed, signed.raw);
  assert.equal(result.status, 200); assert.equal(result.data.coins, 110);
  assert.equal(verified.length, 1);
  const [algorithm, bytes, options, signature] = verified[0];
  assert.equal(algorithm, "sha256"); assert.equal(options.dsaEncoding, "der"); assert.ok(options.key.equals(publicKey));
  assert.deepEqual(bytes, Buffer.from(signed.decodedContent, "utf8")); assert.deepEqual(signature, signed.signature);
  assert.match(bytes.toString("utf8"), /custom_data=adm:/);
  assert.doesNotMatch(bytes.toString("utf8"), /&signature=|&key_id=/);
  const g = setup();
  assert.equal((await g.call("GET", undefined, null, "/webhooks/admob/reward", Object.fromEntries(new URLSearchParams(signed.raw)))).status, 403);
  assert.equal(g.keyCalls.length, 0); assert.equal(g.calls.length, 0); // No raw query, no fallback or reward reads.
});

test("reordered and decoded/re-encoded-but-reordered signed content fail ECDSA without touching rewards", async t => {
  const logs = captureDiagnostics(t), f = setup(), ticket = (await f.prepareNative()).data, signed = signedCallback(ticket);
  const trailer = signed.raw.slice(signed.content.length), before = structuredClone([...f.items]), calls = f.calls.length;
  for (const content of [signed.content.split("&").reverse().join("&"),
    new URLSearchParams([...new URLSearchParams(signed.content)].reverse()).toString()]) {
    assert.notEqual(content, signed.content); logs.length = 0;
    assert.equal((await f.callback(content + trailer)).status, 403);
    assert.equal(logs.find(log => log.event === "admob_ssv.signature_failed").reason, "ECDSA_INVALID");
    assert.deepEqual(logs, [{ event: "admob_ssv.signature_failed", reason: "ECDSA_INVALID" }]);
  }
  assert.deepEqual([...f.items], before); assert.equal(f.calls.length, calls);
  assert.equal((await f.callback(signed.raw)).data.coins, 110);
});

test("raw percent-escaped signature fails after exactly one verification attempt, with no fallback or reward effects", async t => {
  const logs = captureDiagnostics(t), verified = [];
  const f = setup({ verifySignature: (...args) => { verified.push(args); return verify(...args); } });
  const ticket = (await f.prepareNative()).data, signed = signedCallback(ticket);
  const rawSignature = sign("sha256", Buffer.from(signed.content, "utf8"), { key: privateKey, dsaEncoding: "der" });
  const raw = `${signed.content}&signature=${rawSignature.toString("base64url")}&key_id=123`;
  const before = structuredClone([...f.items]), calls = f.calls.length, writes = f.writes.length;
  logs.length = 0;
  assert.notEqual(signed.content, signed.decodedContent);
  assert.equal((await f.callback(raw)).status, 403);
  assert.equal(verified.length, 1);
  assert.deepEqual(verified[0][1], Buffer.from(signed.decodedContent, "utf8"));
  assert.equal(logs.find(log => log.event === "admob_ssv.signature_failed").reason, "ECDSA_INVALID");
  assert.deepEqual(logs, [{ event: "admob_ssv.signature_failed", reason: "ECDSA_INVALID" }]);
  assert.deepEqual([...f.items], before); assert.equal(f.calls.length, calls); assert.equal(f.writes.length, writes);
});

test("percent decoding preserves literal plus and decodes nested percent escapes only once", async t => {
  captureDiagnostics(t);
  const verified = [], f = setup({ verifySignature: (...args) => { verified.push(args); return verify(...args); } });
  const ticket = (await f.prepareNative()).data;
  const raw = f.query(ticket, { ad_network: "reference+value %2F" }).replace("reference%2Bvalue", "reference+value");
  assert.equal((await f.callback(raw)).data.coins, 110);
  assert.equal(verified.length, 1);
  assert.match(verified[0][1].toString("utf8"), /ad_network=reference\+value %2F&/);
});

test("signature and key_id must be the final two parameters; malformed signature escaping fails closed", async t => {
  captureDiagnostics(t);
  const f = setup(), ticket = (await f.prepareNative()).data, signed = signedCallback(ticket), before = structuredClone([...f.items]);
  const trailer = signed.raw.slice(signed.content.length + 1).split("&");
  for (const raw of [`${signed.content}&${trailer.reverse().join("&")}`, `${signed.raw}&extra=1`,
    signed.raw.replace("&key_id=123", "&signature=duplicate&key_id=123"),
    signed.raw.replace(/signature=[^&]+/, "signature=%ZZ")]) assert.equal((await f.callback(raw)).status, 403);
  assert.deepEqual([...f.items], before);
});

test("Google-format PEM/SPKI keys are selected by exact key_id, not key order; non-DER signatures fail", async t => {
  const logs = captureDiagnostics(t), wrong = generateKeyPairSync("ec", { namedCurve: "prime256v1" }).publicKey;
  const f = setup({ request: async () => ({ ok: true, json: async () => ({ keys: [
    { keyId: 456, pem: wrong.export({ type: "spki", format: "pem" }), base64: wrong.export({ type: "spki", format: "der" }).toString("base64") },
    { keyId: 123, pem: publicPem, base64: publicKey.export({ type: "spki", format: "der" }).toString("base64") },
  ] }) }) });
  const ticket = (await f.prepareNative()).data, signed = signedCallback(ticket);
  assert.equal((await f.callback(signedCallback(ticket, "ieee-p1363").raw)).status, 403);
  assert.equal(logs.find(log => log.event === "admob_ssv.signature_failed").reason, "ECDSA_INVALID");
  logs.length = 0;
  assert.equal((await f.callback(signed.raw.replace("key_id=123", "key_id=999"))).status, 403);
  assert.equal(logs.find(log => log.event === "admob_ssv.signature_failed").reason, "KEY_ID_UNKNOWN");
  assert.equal((await f.callback(signed.raw.replace("key_id=123", "key_id=456"))).status, 403);
  assert.equal((await f.callback(signed.raw)).data.coins, 110);
});

test("DEV verification logs only reward outcomes or safe failure reasons, never signed values", async t => {
  const logs = captureDiagnostics(t), f = setup(), ticket = (await f.prepareNative()).data, signed = signedCallback(ticket);
  logs.length = 0; assert.equal((await f.callback(signed.raw)).status, 200);
  assert.deepEqual(logs, [{ event: "reward_transaction.success", remaining: 2 }]);
  logs.length = 0;
  assert.equal((await f.callback(signed.raw.replace("reward_amount=10", "reward_amount=99"))).status, 403);
  assert.deepEqual(logs, [{ event: "admob_ssv.signature_failed", reason: "ECDSA_INVALID" }]);
  for (const secret of [signed.raw, signed.content, signed.decodedContent, signed.signature.toString("base64url"), ticket.providerEventId, ticket.binding,
    "18fa792de1bca816048293fc71035638", "tester", envVars.ADMOB_CLAIM_SECRET]) assert.equal(JSON.stringify(logs).includes(secret), false);
  logs.length = 0; assert.equal((await f.callback(undefined)).status, 403);
  assert.deepEqual(logs, [{ event: "admob_ssv.signature_failed", reason: "CALLBACK_FORMAT_INVALID" }]);
});

test("valid signed probe without custom_data or user_id returns 200 without accessing player data", async () => {
  const f = setup(), before = structuredClone([...f.items]);
  const raw = f.query({}, { custom_data: undefined, user_id: undefined, transaction_id: "probe" });
  assert.equal(new URLSearchParams(raw).has("custom_data"), false);
  assert.deepEqual(await f.callback(raw), { status: 200, data: { received: true } });
  assert.deepEqual([...f.items], before); assert.equal(f.items.get("USER#tester/PROFILE").coins.N, "100");
  assert.equal(f.calls.length, 0); assert.equal(f.writes.length, 0); assert.equal(f.keyCalls.length, 1);
  f.items.clear(); assert.equal((await f.callback(raw)).status, 200);
  assert.equal(f.items.size, 0); assert.equal(f.calls.length, 0);
});

test("valid signed probe with exactly empty custom_data returns 200 and changes no rewards or coins", async () => {
  const f = setup(), before = structuredClone([...f.items]);
  const raw = f.query({}, { custom_data: "", user_id: "", transaction_id: "blank-probe" });
  assert.equal(new URLSearchParams(raw).get("custom_data"), "");
  assert.deepEqual(await f.callback(raw), { status: 200, data: { received: true } });
  assert.deepEqual([...f.items], before); assert.equal(f.calls.length, 0); assert.equal(f.writes.length, 0);
});

test("unsigned or invalidly signed callbacks without custom_data are rejected, never accepted as probes", async () => {
  const f = setup(), before = structuredClone([...f.items]);
  const raw = f.query({}, { custom_data: undefined, user_id: undefined, transaction_id: "probe" });
  for (const invalid of [raw.replace(/signature=[^&]+/, "signature=invalid"), raw.split("&signature=")[0],
    raw.replace("reward_amount=10", "reward_amount=99"), raw.replace("key_id=123", "key_id=999"),
    raw.replace("&signature=", "&custom_data=&custom_data=&signature=")]) {
    const result = await f.callback(invalid);
    assert.equal(result.status, 403); assert.equal(result.data.error.code, "AD_COMPLETION_UNVERIFIED");
  }
  assert.deepEqual([...f.items], before); assert.equal(f.calls.length, 0); assert.equal(f.writes.length, 0);
});

test("signed non-empty malformed custom_data is rejected instead of falling back to a probe", async () => {
  const f = setup(), ticket = (await f.prepareNative()).data, before = structuredClone([...f.items]);
  const calls = f.calls.length, writes = f.writes.length;
  for (const custom_data of ["not-a-claim", " ", "adm:garbage", ticket.providerEventId.slice(0, -3) + "bad"]) {
    const result = await f.callback(f.query(ticket, { custom_data }));
    assert.equal(result.status, 403); assert.equal(result.data.error.code, "AD_COMPLETION_UNVERIFIED");
  }
  assert.deepEqual([...f.items], before); assert.equal(f.calls.length, calls); assert.equal(f.writes.length, writes);
});

test("a signed real claim still requires its matching user_id binding", async () => {
  const f = setup(), ticket = (await f.prepareNative()).data, before = structuredClone([...f.items]);
  for (const user_id of [undefined, ""]) {
    const result = await f.callback(f.query(ticket, { user_id }));
    assert.equal(result.status, 403); assert.equal(result.data.error.code, "AD_COMPLETION_UNVERIFIED");
  }
  assert.deepEqual([...f.items], before);
});

test("signed probes before and after real rewards never consume the three-per-local-day allowance", async () => {
  const f = setup(), tickets = await Promise.all(Array.from({ length: 4 }, () => f.prepareNative()));
  const probe = f.query({}, { custom_data: undefined, user_id: undefined, transaction_id: "daily-probe" });
  const before = structuredClone([...f.items]), calls = f.calls.length, writes = f.writes.length;
  for (let i = 0; i < 4; i++) assert.equal((await f.callback(probe)).status, 200);
  assert.deepEqual([...f.items], before); assert.equal(f.calls.length, calls); assert.equal(f.writes.length, writes);
  assert.equal((await f.statusNative()).data.rewardedAdsRemainingToday, 3);
  for (let i = 0; i < 3; i++) {
    const result = await f.callback(f.query(tickets[i].data));
    assert.equal(result.status, 200); assert.equal(result.data.coins, 110 + i * 10);
  }
  const exhausted = structuredClone([...f.items]);
  assert.equal((await f.callback(probe)).status, 200); assert.deepEqual([...f.items], exhausted);
  const fourth = await f.callback(f.query(tickets[3].data));
  assert.equal(fourth.status, 429); assert.equal(fourth.data.error.code, "AD_DAILY_LIMIT");
  assert.equal(f.items.get("USER#tester/PROFILE").coins.N, "130");
});

test("a probe creates no successful receipt or transaction marker that could block a later real claim", async () => {
  const f = setup(), ticket = (await f.prepareNative()).data, before = structuredClone([...f.items]);
  const calls = f.calls.length, writes = f.writes.length;
  const probe = f.query(ticket, { custom_data: undefined });
  assert.equal((await f.callback(probe)).status, 200);
  assert.deepEqual([...f.items], before); assert.equal(f.calls.length, calls); assert.equal(f.writes.length, writes);
  const real = f.query(ticket); // Same Google transaction ID as the probe.
  const result = await f.callback(real);
  assert.equal(result.status, 200); assert.equal(result.data.coins, 110); assert.equal(result.data.duplicate, false);
  assert.equal((await f.callback(real)).data.duplicate, true);
  assert.equal(f.items.get("USER#tester/PROFILE").coins.N, "110");
});

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
    raw.replace(/custom_data=[^&]+&/, ""), raw.replace(/custom_data=[^&]+/, "custom_data="),
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

function captureDiagnostics(t) {
  const logs = [];
  t.mock.method(console, "info", (...values) => { assert.equal(values.length, 1); logs.push(values[0]); });
  return logs;
}

test("DEV logs concise prepare/reward outcomes while polling stays quiet and sensitive values stay private", async t => {
  const logs = captureDiagnostics(t), f = setup(), privateUser = "private-user-sentinel";
  f.addProfile(privateUser);
  const ticket = (await f.prepareNative(privateUser)).data;
  assert.deepEqual(logs, [{ event: "reward_prepare.success" }]);
  logs.length = 0;
  assert.equal((await f.statusNative(ticket.providerEventId, privateUser)).data.claimStatus, "READY");
  assert.deepEqual(logs, []);
  logs.length = 0;
  const raw = f.query(ticket, { transaction_id: "private-transaction-sentinel", token: "private-token-sentinel", secret: "private-secret-sentinel" });
  assert.equal((await f.callback(raw)).data.coins, 110);
  assert.deepEqual(logs, [{ event: "reward_transaction.success", remaining: 2 }]);
  await f.callback(raw);
  assert.deepEqual(logs, [{ event: "reward_transaction.success", remaining: 2 }, { event: "reward_transaction.duplicate", remaining: 2 }]);
  await f.statusNative(ticket.providerEventId, privateUser);
  assert.equal(logs.length, 2);
  const text = JSON.stringify(logs);
  for (const sensitive of [ticket.providerEventId, ticket.binding, privateUser, unit, raw, envVars.ADMOB_CLAIM_SECRET,
    new URLSearchParams(raw).get("signature"), "private-transaction-sentinel", "private-token-sentinel", "private-secret-sentinel"]) {
    assert.equal(text.includes(sensitive), false, "Diagnostics must not include sensitive or raw request values");
  }
  for (const log of logs) {
    assert.equal(typeof log.event, "string");
    for (const [key, value] of Object.entries(log)) {
      assert.ok(value === null || ["boolean", "number", "string"].includes(typeof value));
      assert.equal(["custom_data", "user_id", "transaction_id", "signature", "token", "secret", "binding", "PK", "SK"].includes(key), false);
    }
  }
});

test("DEV distinguishes signature failure, signed probes, malformed claims, binding failure, unit mismatch and expiry", async t => {
  const logs = captureDiagnostics(t), f = setup(), ticket = (await f.prepareNative()).data;
  logs.length = 0;
  const raw = f.query(ticket).replace(/signature=[^&]+/, "signature=invalid");
  assert.equal((await f.callback(raw)).status, 403);
  assert.ok(logs.some(log => log.event === "admob_ssv.signature_failed" && log.reason === "ECDSA_INVALID"));
  assert.deepEqual(logs, [{ event: "admob_ssv.signature_failed", reason: "ECDSA_INVALID" }]);
  for (const custom_data of [undefined, ""]) {
    logs.length = 0;
    assert.equal((await f.callback(f.query(ticket, { custom_data }))).status, 200);
    assert.deepEqual(logs, []);
  }
  for (const [overrides, stage, reason] of [
    [{ custom_data: "private-invalid-custom-data-sentinel" }, "decode", "CLAIM_FORMAT_INVALID"],
    [{ user_id: "private-invalid-binding-sentinel" }, "callback", "CLAIM_BINDING_INVALID"],
    [{ ad_unit: "ca-app-pub-0/0" }, "ad-unit", "CLAIM_AD_UNIT_INVALID"]
  ]) {
    logs.length = 0;
    assert.equal((await f.callback(f.query(ticket, overrides))).status, 403);
    assert.deepEqual(logs, [{ event: "admob_ssv.claim_rejected", stage, reason }]);
    assert.doesNotMatch(JSON.stringify(logs), /private-invalid/);
  }
  const [receiptKey, receipt] = [...f.items].find(([, item]) => item.providerEventId?.S === ticket.providerEventId);
  f.items.delete(receiptKey); logs.length = 0;
  assert.equal((await f.callback(f.query(ticket))).status, 403);
  assert.deepEqual(logs, [{ event: "admob_ssv.claim_rejected", stage: "receipt", reason: "CLAIM_RECEIPT_MISSING" }]);
  f.items.set(receiptKey, receipt);
  f.setNow(new Date(now + 11 * 60_000).toISOString()); logs.length = 0;
  assert.equal((await f.callback(f.query(ticket, { timestamp: String(now + 11 * 60_000) }))).status, 403);
  assert.deepEqual(logs, [{ event: "admob_ssv.claim_rejected", stage: "receipt", reason: "CLAIM_EXPIRED" }]);
  assert.equal(f.items.get("USER#tester/PROFILE").coins.N, "100");
});

test("DEV observes transaction conflicts, ambiguous failures and durable duplicates without leaking receipts", async t => {
  const logs = captureDiagnostics(t); t.mock.method(console, "error", log => logs.push(log));
  const f = setup(), ticket = (await f.prepareNative()).data, raw = f.query(ticket);
  logs.length = 0; f.loseResponse();
  assert.equal((await f.callback(raw)).status, 500);
  assert.ok(logs.some(log => log.event === "reward_transaction.failed" && log.reason === "INTERNAL_ERROR"));
  assert.equal(logs.some(log => log.event === "reward_transaction.success"), false);
  assert.equal((await f.callback(raw)).data.duplicate, true);
  assert.equal(f.items.get("USER#tester/PROFILE").coins.N, "110");
  const g = setup(), second = (await g.prepareNative()).data;
  logs.length = 0; g.beforeCommit(() => g.setPremium());
  assert.equal((await g.callback(g.query(second))).status, 403);
  assert.ok(logs.some(log => log.event === "reward_transaction.failed" && log.reason === "TransactionCanceledException"));
  assert.ok(logs.some(log => log.event === "admob_ssv.failed" && log.reason === "REWARDED_AD_FREE_ONLY"));
  for (const sensitive of [ticket.providerEventId, ticket.binding, second.providerEventId, second.binding, raw]) assert.equal(JSON.stringify(logs).includes(sensitive), false);
  assert.equal(diagnosticReason({ code: "private-token-sentinel", name: "private-binding-sentinel", message: raw }), "INTERNAL_ERROR");
});

test("PROD, other environments and missing ENVIRONMENT_NAME emit no DEV diagnostics even for successful native rewards", async t => {
  const logs = captureDiagnostics(t);
  for (const environment of ["prod", "production", "test", "DEV", undefined]) {
    const f = setup({ envVars: { ...envVars, ADMOB_LIVE_ENABLED: "true", ENVIRONMENT_NAME: environment } });
    const ticket = (await f.prepareNative()).data;
    assert.equal((await f.statusNative(ticket.providerEventId)).data.claimStatus, "READY");
    const raw = f.query(ticket);
    assert.equal((await f.callback(raw)).data.coins, 110);
    assert.equal((await f.callback(raw)).data.duplicate, true);
    assert.equal((await f.callback(raw.replace(/signature=[^&]+/, "signature=invalid"))).status, 403);
    for (const overrides of [{ custom_data: "private-invalid-claim-sentinel" },
      { custom_data: encryptedClaim("private-invalid-json-sentinel") },
      { custom_data: encryptedClaim(JSON.stringify({ userId: "tester", binding: ticket.binding, expires: now + 10 * 60_000 }), "WRONG_AAD") },
      { reward_amount: "1" }, { reward_item: "Coins" }, { ad_unit: "ca-app-pub-0/0" }]) {
      assert.equal((await f.callback(f.query(ticket, overrides))).status, 403);
    }
    const receipt = [...f.items.values()].find(item => item.providerEventId?.S === ticket.providerEventId);
    receipt.binding.S = "private-other-binding-sentinel";
    assert.equal((await f.callback(raw)).status, 403);
    await f.reward(ticket.providerEventId);
  }
  assert.deepEqual(logs, []);
});

test("DEV status polling and unrelated requests stay quiet, including failed or unauthorized polls", async t => {
  const logs = captureDiagnostics(t), f = setup();
  assert.equal((await f.call("GET", undefined, null)).status, 401);
  await f.call("POST", {}, "tester");
  await f.call("GET", undefined, "tester", "/private-user-sentinel?token=private-token-sentinel");
  await f.call("private-token-sentinel", undefined, null);
  assert.deepEqual(logs, []);
  const ticket = (await f.prepareNative()).data;
  logs.length = 0;
  assert.equal((await f.statusNative("private-invalid-claim-sentinel")).status, 403);
  for (let poll = 0; poll < 12; poll++) assert.equal((await f.statusNative(ticket.providerEventId)).data.claimStatus, "READY");
  assert.deepEqual(logs, []);
  logs.length = 0; f.setPremium();
  assert.equal((await f.prepareNative()).status, 403);
  assert.deepEqual(logs.at(-1), { event: "reward_prepare.failed", reason: "REWARDED_AD_FREE_ONLY" });
  assert.equal(logs.some(log => log.event === "reward_prepare.success"), false);
  assert.equal(JSON.stringify(logs).includes(ticket.providerEventId), false);
});

test("prepared AES-GCM claim survives exactly one custom_data decode, matches its receipt and authenticates the V1 context", async t => {
  const logs = captureDiagnostics(t), f = setup(), ticket = (await f.prepareNative()).data;
  const bytes = Buffer.from(ticket.providerEventId.slice(4), "base64url");
  const decipher = createDecipheriv("aes-256-gcm", Buffer.from(envVars.ADMOB_CLAIM_SECRET, "base64"), bytes.subarray(0, 12));
  decipher.setAAD(Buffer.from("EVRENTHIA_ADMOB_COINS_V1")); decipher.setAuthTag(bytes.subarray(12, 28));
  assert.deepEqual(JSON.parse(Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString()),
    { userId: "tester", binding: ticket.binding, expires: now + 10 * 60_000 });
  const signed = signedCallback(ticket);
  assert.equal(new URLSearchParams(signed.raw).get("custom_data"), ticket.providerEventId);
  assert.equal((await f.callback(signed.raw)).data.coins, 110);
  assert.equal([...f.items.values()].find(item => item.providerEventId?.S === ticket.providerEventId).status.S, "GRANTED");
  logs.length = 0;
  assert.equal((await f.callback(f.query(ticket, { custom_data: encodeURIComponent(ticket.providerEventId) }))).status, 403);
  assert.deepEqual(logs.find(log => log.event === "admob_ssv.claim_rejected"),
    { event: "admob_ssv.claim_rejected", stage: "decode", reason: "CLAIM_FORMAT_INVALID" });
  assert.equal(f.items.get("USER#tester/PROFILE").coins.N, "110");
});

test("DEV identifies every post-decryption callback gate, including binding-valid failures, without accessing rewards on retries", async t => {
  const logs = captureDiagnostics(t), f = setup(), ticket = (await f.prepareNative()).data;
  const before = structuredClone([...f.items]), calls = f.calls.length, writes = f.writes.length;
  for (const [overrides, reason] of [
    [{ user_id: "private-binding-sentinel" }, "CLAIM_BINDING_INVALID"],
    [{ reward_amount: "1" }, "REWARD_AMOUNT_INVALID"],
    [{ reward_amount: "10.0" }, "REWARD_AMOUNT_INVALID"],
    [{ reward_item: "Coins" }, "REWARD_ITEM_INVALID"],
    [{ reward_item: "private-reward-sentinel" }, "REWARD_ITEM_INVALID"],
    [{ transaction_id: "x".repeat(201) }, "TRANSACTION_ID_INVALID"]
  ]) {
    const raw = f.query(ticket, overrides);
    for (let retry = 0; retry < 2; retry++) {
      logs.length = 0;
      assert.equal((await f.callback(raw)).status, 403);
      assert.deepEqual(logs, [{ event: "admob_ssv.claim_rejected", stage: "callback", reason }]);
      for (const sensitive of [ticket.providerEventId, ticket.binding, raw, "private-binding-sentinel", "private-reward-sentinel", "x".repeat(201)])
        assert.equal(JSON.stringify(logs).includes(sensitive), false);
    }
  }
  assert.deepEqual([...f.items], before); assert.equal(f.calls.length, calls); assert.equal(f.writes.length, writes);
  assert.equal((await f.statusNative()).data.rewardedAdsRemainingToday, 3);
  assert.equal((await f.callback(f.query(ticket, { transaction_id: "x".repeat(200) }))).data.coins, 110);
});

test("DEV distinguishes format, GCM authentication, JSON, required-field and timestamp rejection branches without logging claim data", async t => {
  const logs = captureDiagnostics(t), f = setup(), ticket = (await f.prepareNative()).data;
  const claim = { userId: "tester", binding: ticket.binding, expires: now + 10 * 60_000 };
  const bytes = Buffer.from(ticket.providerEventId.slice(4), "base64url"); bytes[12] ^= 1;
  const cases = [
    ["private-invalid-claim-sentinel", "CLAIM_FORMAT_INVALID"],
    [`adm:${bytes.toString("base64url")}`, "CLAIM_AUTH_FAILED"],
    [encryptedClaim(JSON.stringify(claim), "EVRENTHIA_ADMOB_COINS_V2"), "CLAIM_AUTH_FAILED"],
    [encryptedClaim("private-invalid-json-sentinel"), "CLAIM_JSON_INVALID"],
    ...[null, [], { ...claim, userId: undefined }, { ...claim, userId: "" }, { ...claim, userId: 42 },
      { ...claim, binding: undefined }, { ...claim, binding: 42 }].map(value =>
      [encryptedClaim(JSON.stringify(value)), "CLAIM_REQUIRED_FIELD_MISSING"]),
    ...[undefined, "1760000000000", 1.5, null].map(expires =>
      [encryptedClaim(JSON.stringify({ ...claim, expires })), "CLAIM_TIMESTAMP_INVALID"])
  ];
  const before = structuredClone([...f.items]), calls = f.calls.length, writes = f.writes.length;
  for (const [custom_data, reason] of cases) {
    logs.length = 0;
    const raw = f.query(ticket, { custom_data });
    assert.equal((await f.callback(raw)).status, 403);
    assert.deepEqual(logs, [{ event: "admob_ssv.claim_rejected", stage: "decode", reason }]);
    for (const sensitive of [custom_data, ticket.binding, JSON.stringify(claim), envVars.ADMOB_CLAIM_SECRET, raw,
      "private-invalid-json-sentinel", "private-invalid-claim-sentinel"]) assert.equal(JSON.stringify(logs).includes(sensitive), false);
  }
  assert.deepEqual([...f.items], before); assert.equal(f.calls.length, calls); assert.equal(f.writes.length, writes);
});

test("DEV identifies each prepared receipt rejection without changing stored rewards", async t => {
  const logs = captureDiagnostics(t);
  for (const [mutate, reason] of [
    [() => null, "CLAIM_RECEIPT_MISSING"],
    [receipt => ({ ...receipt, PK: { S: "USER#private-other-sentinel" } }), "CLAIM_USER_INVALID"],
    [receipt => ({ ...receipt, providerEventId: { S: "private-other-event-sentinel" } }), "CLAIM_EVENT_INVALID"],
    [receipt => ({ ...receipt, provider: { S: "DEV_TEST" } }), "CLAIM_PROVIDER_INVALID"],
    [receipt => ({ ...receipt, binding: { S: "private-other-binding-sentinel" } }), "CLAIM_BINDING_INVALID"],
    [receipt => ({ ...receipt, status: { S: "INVALID" } }), "CLAIM_STATUS_INVALID"],
    [receipt => ({ ...receipt, expiresAt: { S: new Date(now - 1).toISOString() } }), "CLAIM_EXPIRED"]
  ]) {
    const f = setup(), ticket = (await f.prepareNative()).data;
    const [key, receipt] = [...f.items].find(([, item]) => item.providerEventId?.S === ticket.providerEventId);
    const changed = mutate(receipt);
    if (changed) f.items.set(key, changed); else f.items.delete(key);
    const before = structuredClone([...f.items]), writes = f.writes.length;
    logs.length = 0;
    assert.equal((await f.callback(f.query(ticket))).status, 403);
    assert.deepEqual(logs, [{ event: "admob_ssv.claim_rejected", stage: "receipt", reason }]);
    assert.deepEqual([...f.items], before); assert.equal(f.writes.length, writes);
    for (const sensitive of [key, ticket.providerEventId, ticket.binding, "private-other"])
      assert.equal(JSON.stringify(logs).includes(sensitive), false);
  }
});

test("claim expiry rejects READY receipts but GRANTED replay remains idempotent after expiry", async t => {
  const logs = captureDiagnostics(t), f = setup(), ticket = (await f.prepareNative()).data;
  // Leave the stored receipt unexpired to isolate the encrypted claim's expiry branch.
  const receipt = [...f.items.values()].find(item => item.providerEventId?.S === ticket.providerEventId);
  receipt.expiresAt.S = new Date(now + 20 * 60_000).toISOString();
  f.setNow(new Date(now + 10 * 60_000).toISOString()); logs.length = 0;
  assert.equal((await f.callback(f.query(ticket, { timestamp: String(now + 10 * 60_000) }))).status, 403);
  assert.deepEqual(logs.find(log => log.event === "admob_ssv.claim_rejected"),
    { event: "admob_ssv.claim_rejected", stage: "receipt", reason: "CLAIM_EXPIRED" });
  assert.equal(f.items.get("USER#tester/PROFILE").coins.N, "100");
  const g = setup(), granted = (await g.prepareNative()).data;
  assert.equal((await g.callback(g.query(granted))).data.coins, 110);
  g.setNow(new Date(now + 11 * 60_000).toISOString()); logs.length = 0;
  assert.equal((await g.callback(g.query(granted, { timestamp: String(now + 11 * 60_000) }))).data.duplicate, true);
  assert.deepEqual(logs, [{ event: "reward_transaction.duplicate", remaining: 2 }]);
  assert.equal(g.items.get("USER#tester/PROFILE").coins.N, "110");
});

test("platform is inferred from the prepared unit and iOS callbacks cannot substitute an Android unit", async t => {
  const logs = captureDiagnostics(t), iosUnit = "ca-app-pub-3940256099942544/1712485313";
  const f = setup({ envVars: { ...envVars, ADMOB_IOS_REWARDED_UNIT_ID: iosUnit } });
  const ticket = (await f.call("POST", { provider: "ADMOB", platform: "IOS" }, "tester", "/ads/reward/prepare")).data;
  assert.equal(ticket.adUnitId, iosUnit); logs.length = 0;
  assert.equal((await f.callback(f.query(ticket))).status, 403);
  assert.deepEqual(logs.find(log => log.event === "admob_ssv.claim_rejected"),
    { event: "admob_ssv.claim_rejected", stage: "ad-unit", reason: "CLAIM_AD_UNIT_INVALID" });
  assert.equal((await f.callback(f.query(ticket, { ad_unit: iosUnit.split("/")[1] }))).data.coins, 110);
});
