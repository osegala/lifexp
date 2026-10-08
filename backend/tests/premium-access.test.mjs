import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as entitlements from "../layers/api-shared/nodejs/entitlements.mjs";
import * as http from "../layers/api-shared/nodejs/http.mjs";
import * as leveling from "../layers/api-shared/nodejs/leveling.mjs";
import * as achievements from "../layers/progression-shared/nodejs/achievements.mjs";
import * as effects from "../layers/progression-shared/nodejs/building-effects.mjs";
import * as purchase from "../functions/purchase-item/logic.mjs";
import * as equip from "../functions/equip-item/logic.mjs";
import * as unequip from "../functions/unequip-item/logic.mjs";
import * as inventory from "../functions/get-inventory/logic.mjs";
import { buildShopItems } from "../functions/get-shop/logic.mjs";
import { validateProfilePatch } from "../functions/update-me/logic.mjs";
import { deleteUserPartition } from "../functions/delete-account/logic.mjs";

const premium = { PK: { S: "USER#tester" }, SK: { S: "ENTITLEMENTS" }, plan: { S: "PREMIUM" },
  subscriptionStatus: { S: "ACTIVE" }, expiresAt: { S: "2099-01-01T00:00:00.000Z" }, provider: { S: "APPLE" } };
function fixture({ gated = false, entitlement, owned = false } = {}) {
  const calls = [], writes = [];
  const ownedItems = new Map(owned ? [["test-hat", { PK: { S: "USER#tester" }, SK: { S: "ITEM#test-hat" }, itemId: { S: "test-hat" }, category: { S: "hats" } }]] : []);
  const equipment = {};
  const f = { entitlement, coins: 100 };
  const catalogItem = itemId => ({ PK: { S: "CATALOG#COSMETICS" }, SK: { S: `ITEM#${itemId}` }, itemId: { S: itemId },
    category: { S: "hats" }, name: { S: "Test hat" }, price: { N: "25" }, requiresPremium: { BOOL: gated } });
  class GetItemCommand { constructor(input) { this.input = input; } }
  class QueryCommand extends GetItemCommand {}
  class UpdateItemCommand extends GetItemCommand {}
  class TransactWriteItemsCommand extends GetItemCommand {}
  class DynamoDBClient {
    async send(command) {
      const i = command.input; calls.push(i);
      if (command instanceof TransactWriteItemsCommand) {
        writes.push(i);
        for (const write of i.TransactItems) {
          if (write.Put?.Item.SK.S.startsWith("ITEM#")) ownedItems.set(write.Put.Item.itemId.S, write.Put.Item);
          if (write.Update) f.coins += Number(write.Update.ExpressionAttributeValues[":negativePrice"].N);
        }
        return {};
      }
      if (command instanceof UpdateItemCommand) {
        writes.push(i);
        const slot = i.ExpressionAttributeNames["#slot"];
        if (i.UpdateExpression.includes("REMOVE #slot")) delete equipment[slot];
        else equipment[slot] = i.ExpressionAttributeValues[":itemId"];
        return { Attributes: { ...equipment } };
      }
      if (command instanceof QueryCommand) return { Items: i.ExpressionAttributeValues[":prefix"].S !== "ITEM#" ? []
        : i.ExpressionAttributeValues[":pk"].S === "CATALOG#COSMETICS" ? [catalogItem("test-hat")] : [...ownedItems.values()] };
      assert.equal(i.ConsistentRead, true);
      const sk = i.Key.SK.S;
      return { Item: sk === "PROFILE" ? { PK: i.Key.PK, SK: i.Key.SK, xp: { N: "0" }, coins: { N: String(f.coins) } }
        : sk === "ENTITLEMENTS" ? f.entitlement
        : sk === "EQUIPMENT" ? { ...equipment }
        : i.Key.PK.S === "CATALOG#COSMETICS" ? catalogItem(sk.slice("ITEM#".length))
        : ownedItems.get(sk.slice("ITEM#".length)) };
    }
  }
  const imports = { "@aws-sdk/client-dynamodb": { DynamoDBClient, GetItemCommand, QueryCommand, UpdateItemCommand, TransactWriteItemsCommand },
    "/opt/nodejs/http.mjs": http, "/opt/nodejs/leveling.mjs": leveling, "/opt/nodejs/entitlements.mjs": entitlements,
    "/opt/nodejs/achievements.mjs": achievements, "/opt/nodejs/building-effects.mjs": effects };
  f.call = async (name, body = { itemId: "test-hat" }) => {
    const source = readFileSync(new URL(`../functions/${name}/index.mjs`, import.meta.url), "utf8")
      .replace(/import\s*\{([^}]+)\}\s*from\s*"([^"]+)";/g, (_, members, path) => `const {${members.replace(/\bas\b/g, ":")}} = imports[${JSON.stringify(path)}];`)
      .replace(/export const handler\s*=/, "const handler =");
    const handler = new Function("imports", "process", `${source}\nreturn handler;`)(
      { ...imports, "./logic.mjs": { "purchase-item": purchase, "equip-item": equip, "unequip-item": unequip, "get-inventory": inventory }[name] }, { env: { TABLE_NAME: "local" } });
    const r = await handler({ requestContext: { authorizer: { jwt: { claims: { sub: "tester" } } } }, body: JSON.stringify(body) });
    return { status: r.statusCode, data: JSON.parse(r.body) };
  };
  return { ...f, calls, writes, ownedItems, setEntitlement: value => { f.entitlement = value; } };
}

test("trusted writer's active premium fixture exposes canonical source without transaction secrets", () => {
  const e = entitlements.effectiveEntitlement(entitlements.entitlementFromItem(premium));
  assert.equal(e.source, "APPLE"); assert.equal(entitlements.isPremium(e), true); assert.equal(entitlements.shouldShowAds(e), false);
  assert.equal(entitlements.effectiveEntitlement({ plan: "PREMIUM", subscriptionStatus: "ACTIVE", source: "DEVELOPMENT" }).source, "TEST");
  assert.equal(entitlements.isPremium(entitlements.effectiveEntitlement(null)), false);
});

test("normal profile update cannot grant or modify entitlements", () => {
  for (const field of ["plan", "premium", "premiumActive", "adsEnabled", "source", "expiresAt", "subscriptionStatus", "autoRenew", "entitlements"]) {
    assert.throws(() => validateProfilePatch({ [field]: true }), e => e.code === "VALIDATION_ERROR");
  }
});

for (const action of ["purchase-item", "equip-item"]) {
  test(`${action}: free catalog item remains usable without an entitlement read`, async () => {
    const f = fixture({ owned: action === "equip-item" }); assert.equal((await f.call(action)).status, 200); assert.equal(f.writes.length, 1);
    assert.ok(!f.calls.some(i => i.Key?.SK.S === "ENTITLEMENTS"));
  });
  if (action === "purchase-item") test(`${action}: premium catalog gate reads freshly and rejects missing, expired and malformed records before writes`, async () => {
    const f = fixture({ gated: true, entitlement: premium });
    assert.equal((await f.call(action)).status, 200);
    for (const entitlement of [undefined, { ...premium, expiresAt: { S: "2000-01-01" } }, { ...premium, subscriptionStatus: { S: "UNKNOWN" } }]) {
      f.setEntitlement(entitlement);
      const r = await f.call(action, { itemId: "new-hat" }); assert.equal(r.status, 403); assert.equal(r.data.error.code, "PREMIUM_REQUIRED");
    }
    assert.equal(f.writes.length, 1, "a previously confirmed premium result cannot authorize later actions");
    const reads = f.calls.filter(i => i.Key?.SK.S === "ENTITLEMENTS");
    assert.equal(reads.length, 4); assert.ok(reads.every(i => i.Key.PK.S === "USER#tester" && i.ConsistentRead));
  });
  test(`${action}: client flags cannot bypass catalog or ownership checks`, async () => {
    const f = fixture({ gated: true, entitlement: premium, owned: false });
    for (const field of ["premium", "requiresPremium", "plan"]) assert.equal((await f.call(action, { itemId: "test-hat", [field]: true })).status, 400);
    if (action === "equip-item") assert.equal((await f.call(action)).status, 403);
    assert.equal(f.writes.length, 0);
  });
}

const expired = { ...premium, expiresAt: { S: "2000-01-01T00:00:00.000Z" } };
test("Premium purchase stores permanent ownership, not subscription-linked or expiring inventory", async () => {
  const f = fixture({ gated: true, entitlement: premium });
  assert.equal((await f.call("purchase-item")).status, 200);
  const stored = f.ownedItems.get("test-hat");
  assert.equal(stored.itemId.S, "test-hat");
  assert.ok(stored.purchasedAt.S);
  assert.equal(stored.purchasePrice.N, "25");
  assert.equal(stored.expiresAt, undefined);
  assert.equal(stored.ttl, undefined);
  assert.equal((await f.call("get-inventory")).data.items[0].itemId, "test-hat");
});

test("Premium expiry leaves purchased inventory and current equipment unchanged", async () => {
  const f = fixture({ gated: true, entitlement: premium });
  await f.call("purchase-item"); await f.call("equip-item");
  const before = (await f.call("get-inventory")).data;
  const writes = f.writes.length;
  f.setEntitlement(expired);
  assert.equal(entitlements.isPremium(entitlements.effectiveEntitlement(entitlements.entitlementFromItem(expired))), false);
  assert.deepEqual((await f.call("get-inventory")).data, before);
  assert.equal(f.writes.length, writes, "expiry must not delete inventory or auto-unequip");
});

test("FREE and expired users can equip owned Premium cosmetics without reading entitlements", async () => {
  for (const entitlement of [undefined, expired]) {
    const f = fixture({ gated: true, owned: true, entitlement });
    const result = await f.call("equip-item");
    assert.equal(result.status, 200); assert.equal(result.data.equipment.hat, "test-hat");
    assert.ok(!f.calls.some(i => i.Key?.SK.S === "ENTITLEMENTS"));
  }
});

test("FREE and expired users can unequip and re-equip permanently owned Premium cosmetics", async () => {
  for (const entitlement of [undefined, expired]) {
    const f = fixture({ gated: true, owned: true, entitlement });
    await f.call("equip-item");
    const removed = await f.call("unequip-item"); assert.equal(removed.status, 200); assert.equal(removed.data.equipment.hat, null);
    const restored = await f.call("equip-item"); assert.equal(restored.status, 200); assert.equal(restored.data.equipment.hat, "test-hat");
    assert.equal(f.ownedItems.size, 1);
    assert.ok(!f.calls.some(i => i.Key?.SK.S === "ENTITLEMENTS"));
  }
});

test("FREE cannot purchase unowned Premium cosmetics and owned retries preserve normal conflict behavior", async () => {
  const f = fixture({ gated: true, owned: true });
  const denied = await f.call("purchase-item", { itemId: "new-hat" });
  assert.equal(denied.status, 403); assert.equal(denied.data.error.code, "PREMIUM_REQUIRED");
  const owned = await f.call("purchase-item"); assert.equal(owned.status, 409); assert.equal(owned.data.error.code, "ITEM_ALREADY_OWNED");
  assert.equal(f.writes.length, 0); assert.equal(f.ownedItems.size, 1);
});

test("resubscribing allows new Premium releases while retaining the previous purchase", async () => {
  const f = fixture({ gated: true, entitlement: premium });
  assert.equal((await f.call("purchase-item")).status, 200);
  f.setEntitlement(expired);
  assert.equal((await f.call("purchase-item", { itemId: "new-hat" })).status, 403);
  f.setEntitlement(premium);
  assert.equal((await f.call("purchase-item", { itemId: "new-hat" })).status, 200);
  assert.deepEqual((await f.call("get-inventory")).data.items.map(i => i.itemId), ["test-hat", "new-hat"]);
});

test("shop premium metadata adds only the optional gate; level, achievement, affordability and ownership stay authoritative", () => {
  const catalog = [{ itemId: "free", price: 5 }, { itemId: "premium", price: 5, requiresPremium: true }];
  const free = buildShopItems(catalog, new Set(), new Set(), 10, 1);
  assert.equal(free[0].canPurchase, true); assert.equal(free[1].canPurchase, false); assert.deepEqual(free[1].lockReasons, [{ type: "PREMIUM" }]);
  assert.equal(buildShopItems(catalog, new Set(), new Set(), 10, 1, new Map(), true)[1].canPurchase, true);
  assert.equal(buildShopItems([{ ...catalog[1], requiredLevel: 10 }], new Set(), new Set(), 10, 1, new Map(), true)[0].canPurchase, false);
  const owned = buildShopItems(catalog, new Set(["premium"]), new Set(), 10, 1)[1];
  assert.equal(owned.owned, true); assert.equal(owned.status, "OWNED"); assert.equal(owned.premiumRequirementSatisfied, true);
  assert.ok(!owned.lockReasons.some(reason => reason.type === "PREMIUM")); assert.equal(owned.canPurchase, false);
});

test("account partition deletion includes ENTITLEMENTS without deleting another user's state", async () => {
  const records = ["PROFILE", "ENTITLEMENTS", "DEVICE#one"].map(sk => ({ PK: { S: "USER#tester" }, SK: { S: sk } }));
  const deleted = [];
  const count = await deleteUserPartition({ tableName: "local", userId: "tester", queryPage: async i => {
    assert.deepEqual(i.ExpressionAttributeValues[":pk"], { S: "USER#tester" }); return { Items: records };
  }, writeBatch: async i => { deleted.push(...i.RequestItems.local.map(x => x.DeleteRequest.Key.SK.S)); return {}; }, sleep: async () => {} });
  assert.equal(count, 3); assert.ok(deleted.includes("ENTITLEMENTS"));
});
