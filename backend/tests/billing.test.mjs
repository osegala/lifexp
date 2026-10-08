import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as crypto from "node:crypto";
import * as http from "../layers/api-shared/nodejs/http.mjs";
import * as entitlements from "../layers/api-shared/nodejs/entitlements.mjs";

const userId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", otherId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const now = Date.parse("2026-10-08T16:00:00Z"), expiry = now + 30 * 86400_000;
const env = { TABLE_NAME: "local", ENVIRONMENT_NAME: "dev", REVENUECAT_SECRET_API_KEY: "sk_test_fixture_only",
  REVENUECAT_WEBHOOK_AUTHORIZATION: "fixture-webhook-authorization-not-a-real-secret",
  REVENUECAT_PROJECT_ID: "project", REVENUECAT_ENTITLEMENT_ID: "ent_premium", REVENUECAT_ENVIRONMENT: "sandbox",
  REVENUECAT_PRODUCTS: JSON.stringify([{ id: "monthly", appId: "app_ios", storeIdentifier: "premium.monthly", store: "app_store" }]) };
const entitlement = { id: "ent_premium", lookup_key: "premium", project_id: "project", state: "active" };
const subscription = (id = userId) => ({ customer_id: id, product_id: "monthly", store: "app_store", environment: "sandbox",
  gives_access: true, status: "active", auto_renewal_status: "will_renew", current_period_ends_at: expiry,
  entitlements: { items: [entitlement] } });

function load(file, imports, exports, request) {
  const source = readFileSync(new URL(`../functions/billing/${file}.mjs`, import.meta.url), "utf8")
    .replace(/import\s*\{([^}]+)\}\s*from\s*"([^"]+)";/g, (_, members, path) => `const {${members}} = imports[${JSON.stringify(path)}];`)
    .replace(/export /g, "");
  class FixedDate extends Date { constructor(value) { super(value ?? now); } static now() { return now; } }
  return new Function("imports", "process", "Date", "fetch", `${source}\nreturn {${exports.join(",")}};`)(imports, { env: imports.env ?? env }, FixedDate, request);
}

function fixture(options = {}) {
  const items = new Map(), calls = [], writes = []; let beforeCommit, requestHook;
  const key = i => `${i.PK.S}/${i.SK.S}`;
  for (const id of [userId, otherId]) items.set(`USER#${id}/PROFILE`, { PK: { S: `USER#${id}` }, SK: { S: "PROFILE" }, coins: { N: "100" } });
  const f = { items, calls, writes, subscriptions: [subscription()], customer: { id: userId, project_id: "project" },
    product: { id: "monthly", type: "subscription", app_id: "app_ios", store_identifier: "premium.monthly" },
    beforeCommit(fn) { beforeCommit = fn; }, onRequest(fn) { requestHook = fn; }, status: 200 };
  const request = async (url, config) => {
    calls.push({ url, config }); if (requestHook) await requestHook(url);
    const data = url.includes("/entitlements/") ? entitlement : url.includes("/subscriptions?")
      ? { items: f.subscriptions } : url.includes("/products/") ? f.product : f.customer;
    return { ok: f.status === 200, status: f.status, json: async () => structuredClone(data) };
  };
  class GetItemCommand { constructor(input) { this.input = input; } }
  class TransactWriteItemsCommand extends GetItemCommand {}
  class DynamoDBClient {
    async send(command) {
      const i = command.input;
      if (!(command instanceof TransactWriteItemsCommand)) return { Item: structuredClone(items.get(key(i.Key))) };
      if (beforeCommit) { const fn = beforeCommit; beforeCommit = null; fn(); }
      const pass = i.TransactItems.every(entry => {
        const op = entry.ConditionCheck ?? entry.Put, current = items.get(key(op.Key ?? op.Item));
        if (op.ConditionExpression === "attribute_exists(PK)") return !!current;
        if (op.ConditionExpression === "attribute_not_exists(PK)") return !current;
        if (op.ConditionExpression === "attribute_not_exists(#revision)") return !current?.billingRevision;
        return JSON.stringify(current?.billingRevision) === JSON.stringify(op.ExpressionAttributeValues[":revision"]);
      });
      if (!pass) throw Object.assign(new Error("conflict"), { name: "TransactionCanceledException" });
      for (const entry of i.TransactItems) if (entry.Put) items.set(key(entry.Put.Item), structuredClone(entry.Put.Item));
      writes.push(i); return {};
    }
  }
  const imports = { env: { ...env, ...options }, "node:crypto": crypto, "/opt/nodejs/http.mjs": http,
    "/opt/nodejs/entitlements.mjs": entitlements, "@aws-sdk/client-dynamodb": { DynamoDBClient, GetItemCommand, TransactWriteItemsCommand } };
  const logic = load("revenuecat", imports, ["verifyCustomer", "revenueCatConfig", "billingEventKey", "entitlementWrite", "webhookAuthorized"], request);
  imports["./revenuecat.mjs"] = logic;
  const handler = load("index", imports, ["handler"], request).handler;
  f.call = async (body = {}, id = userId) => {
    const r = await handler({ rawPath: "/billing/sync", body: JSON.stringify(body),
      requestContext: { http: { method: "POST" }, authorizer: { jwt: { claims: { sub: id } } } } });
    return { status: r.statusCode, data: JSON.parse(r.body) };
  };
  f.webhook = async (overrides = {}, authorization = env.REVENUECAT_WEBHOOK_AUTHORIZATION) => {
    const event = { id: "event1", event_timestamp_ms: now, type: "RENEWAL", app_user_id: userId,
      app_id: "app_ios", environment: "SANDBOX", ...overrides };
    const r = await handler({ rawPath: "/webhooks/revenuecat", headers: { authorization }, body: JSON.stringify({ event }),
      requestContext: { http: { method: "POST" } } });
    return { status: r.statusCode, data: JSON.parse(r.body) };
  };
  f.logic = logic; return f;
}

test("authenticated billing sync writes verified Premium, exact customer, app/product and existing canonical record only", async () => {
  const f = fixture(), result = await f.call();
  assert.equal(result.status, 200); assert.equal(result.data.premium, true); assert.equal(result.data.source, "APPLE");
  assert.equal(result.data.adsEnabled, false); assert.equal(result.data.expiresAt, new Date(expiry).toISOString());
  assert.equal(f.items.get(`USER#${userId}/ENTITLEMENTS`).billingRevision.N, "1");
  assert.ok(f.calls.every(c => c.config.headers.Authorization === `Bearer ${env.REVENUECAT_SECRET_API_KEY}`));
  assert.ok(f.calls.some(c => c.url.includes(`/customers/${userId}`)));
  assert.equal(f.items.get(`USER#${otherId}/ENTITLEMENTS`), undefined);
});

test("FREE, expired, refunded/revoked, pending, wrong product and sandbox in production cannot grant Premium", async () => {
  for (const patch of [{ gives_access: false }, { current_period_ends_at: now - 1 }, { pending_payment: true, gives_access: false },
    { product_id: "unapproved" }, { environment: "production" }, { entitlements: { items: [] } }]) {
    const f = fixture(); f.subscriptions = [{ ...subscription(), ...patch }];
    assert.equal((await f.call()).data.premium, false); assert.equal(f.items.get(`USER#${userId}/PROFILE`).coins.N, "100");
  }
  const empty = fixture(); empty.subscriptions = []; assert.equal((await empty.call()).data.plan, "FREE");
});

test("canceled paid-through and provider-verified grace remain Premium; no unknown grace expiry is invented", async () => {
  const f = fixture(); f.subscriptions[0].auto_renewal_status = "will_not_renew";
  const canceled = (await f.call()).data; assert.equal(canceled.premium, true); assert.equal(canceled.subscriptionStatus, "CANCELED"); assert.equal(canceled.autoRenew, false);
  f.subscriptions[0].status = "in_grace_period"; f.subscriptions[0].current_period_ends_at = now - 1;
  assert.equal((await f.call()).status, 503);
  f.customer.active_entitlements = { items: [{ entitlement_id: "ent_premium", expires_at: now + 86400_000 }] };
  assert.equal((await f.call()).data.subscriptionStatus, "GRACE_PERIOD");
});

test("client cannot submit premium/expiration/product/platform/other identity and missing JWT is rejected", async () => {
  const f = fixture();
  for (const body of [{ premium: true }, { expiresAt: "2099-01-01" }, { productId: "monthly" }, { platform: "IOS" }, { userId: otherId }]) assert.equal((await f.call(body)).status, 400);
  assert.equal((await f.call({}, null)).status, 401); assert.equal(f.writes.length, 0); assert.equal(f.calls.length, 0);
});

test("wrong RevenueCat customer/subscription/app/product and unavailable/missing verification fail closed", async () => {
  for (const mutate of [f => { f.customer.id = otherId; }, f => { f.subscriptions[0].customer_id = otherId; },
    f => { f.product.app_id = "wrong"; }, f => { f.product.store_identifier = "wrong"; }, f => { f.status = 503; }]) {
    const f = fixture(); mutate(f); assert.equal((await f.call()).status, 503); assert.equal(f.writes.length, 0);
  }
  for (const options of [{ REVENUECAT_SECRET_API_KEY: "" }, { REVENUECAT_PRODUCTS: "[]" }, { ENVIRONMENT_NAME: "prod" }]) assert.equal((await fixture(options).call()).status, 503);
});

test("webhook authorization is mandatory before any provider/database mutation, even with valid-looking events", async () => {
  const f = fixture(); for (const secret of [undefined, "", "wrong"]) assert.equal((await f.webhook({}, secret ?? "")).status, 401);
  assert.equal(f.writes.length, 0); assert.equal(f.calls.length, 0);
  assert.equal((await f.webhook({ environment: "PRODUCTION" })).status, 400);
  assert.equal((await f.webhook({ app_id: "wrong" })).status, 400);
});

test("valid lifecycle webhooks refetch authoritative state; duplicate and older events never regress it", async () => {
  const f = fixture(); assert.equal((await f.webhook()).status, 200); const calls = f.calls.length;
  assert.equal((await f.webhook()).status, 200); assert.equal(f.calls.length, calls); assert.equal(f.writes.length, 1);
  f.subscriptions = [];
  assert.equal((await f.webhook({ id: "stale", event_timestamp_ms: now - 100 })).status, 200);
  assert.equal(f.items.get(`USER#${userId}/ENTITLEMENTS`).plan.S, "PREMIUM");
  assert.equal((await f.webhook({ id: "refund", type: "CANCELLATION", event_timestamp_ms: now + 1 })).status, 200);
  assert.equal(f.items.get(`USER#${userId}/ENTITLEMENTS`).plan.S, "FREE");
});

test("concurrent sync cannot overwrite a newer webhook snapshot; it re-reads provider state", async () => {
  const f = fixture();
  f.beforeCommit(() => {
    f.items.set(`USER#${userId}/ENTITLEMENTS`, { PK: { S: `USER#${userId}` }, SK: { S: "ENTITLEMENTS" },
      billingRevision: { N: "1" }, plan: { S: "FREE" }, lastRevenueCatEventAt: { N: String(now) } });
    f.subscriptions = [];
  });
  assert.equal((await f.call()).data.premium, false); assert.equal(f.items.get(`USER#${userId}/ENTITLEMENTS`).billingRevision.N, "2");
});

test("transfer refreshes both existing identities; late events cannot recreate deleted profiles or touch inventory", async () => {
  const f = fixture();
  f.items.set(`USER#${userId}/INV#item`, { owned: { BOOL: true } });
  f.subscriptions = []; f.customer = { id: userId, project_id: "project" };
  f.onRequest(url => { if (url.includes(`/customers/${otherId}`)) f.customer = { id: otherId, project_id: "project" }; });
  assert.equal((await f.webhook({ type: "TRANSFER", environment: undefined, transferred_from: [userId], transferred_to: [otherId] })).status, 200);
  assert.equal((await f.webhook({ type: "TRANSFER", transferred_from: "bad", transferred_to: [otherId] })).status, 400);
  assert.equal(f.items.get(`USER#${userId}/ENTITLEMENTS`).plan.S, "FREE");
  assert.equal(f.items.get(`USER#${otherId}/ENTITLEMENTS`).plan.S, "FREE");
  assert.equal(f.items.get(`USER#${userId}/INV#item`).owned.BOOL, true);
  f.items.delete(`USER#${userId}/PROFILE`);
  assert.equal((await f.webhook({ id: "after-delete" })).status, 200);
  assert.equal(f.items.has(`USER#${userId}/PROFILE`), false);
});

test("billing endpoints use JWT only for sync; backend secrets are NoEcho and never frontend config", () => {
  const template = readFileSync(new URL("../template.yaml", import.meta.url), "utf8");
  const block = template.split("  BillingFunction:\n")[1].split("  GetPreferencesFunction:\n")[0];
  assert.match(block, /Path: \/billing\/sync\n\s+Method: POST\n\s+Auth:\n\s+Authorizer: EvrenthiaCognito/);
  assert.match(block, /Path: \/webhooks\/revenuecat\n\s+Method: POST\n\s+Auth:\n\s+Authorizer: NONE/);
  assert.match(template, /RevenueCatSecretApiKey:\n\s+Type: String\n\s+NoEcho: true/);
  assert.doesNotMatch(block, /dynamodb:(?:DeleteItem|Scan|\*)/);
});
