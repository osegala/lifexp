import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildShopItems } from "../functions/get-shop/logic.mjs";
import { planPurchase } from "../functions/purchase-item/logic.mjs";
import { buildInventory } from "../functions/get-inventory/logic.mjs";
import { planEquip } from "../functions/equip-item/logic.mjs";
const catalog = JSON.parse(readFileSync(new URL("../seeds/cosmetics.json", import.meta.url)));
const premium = catalog.filter(item => item.requiresPremium);

test("the 34 launch Premium seeds have deterministic unique IDs, zero prices and the existing equipment categories", () => {
  assert.equal(premium.length, 34); assert.equal(new Set(catalog.map(item => item.itemId)).size, catalog.length);
  assert.equal(premium.filter(item => item.assetKey.includes("/dresses/")).length, 5);
  assert.deepEqual(Object.fromEntries(Object.entries(Object.groupBy(premium, item => item.category)).map(([key, rows]) => [key, rows.length])),
    { tunic: 10, pants: 5, hat: 5, boots: 5, background: 3, aura: 3, pet: 3 });
  for (const item of premium) { assert.equal(item.price, 0); assert.equal(item.requiredLevel, 1); assert.equal(item.requiredAchievement, null); assert.equal(item.SK, `ITEM#${item.itemId}`); }
});

test("the server permits zero-coin Premium claims for active subscribers and locks unowned releases for Free users", () => {
  const active = buildShopItems(premium, new Set(), new Set(), 0, 1, new Map(), true);
  const free = buildShopItems(premium, new Set(), new Set(), 0, 1, new Map(), false);
  assert.ok(active.every(item => item.canPurchase && item.premiumRequirementSatisfied && item.effectivePrice === 0));
  assert.ok(free.every(item => !item.canPurchase && !item.premiumRequirementSatisfied && item.status === "LOCKED"));
  for (const item of premium) assert.equal(planPurchase(item, { coins: 73, level: 1 }).remainingCoins, 73);
});

test("claimed Premium inventory keeps ordinary permanent ownership and equip semantics after expiry and across devices", () => {
  const owned = premium.map(item => ({ itemId: item.itemId, purchasePrice: 0, purchasedAt: "2026-10-22" }));
  const inventory = buildInventory(owned, new Map(premium.map(item => [item.itemId, item])));
  assert.equal(inventory.items.length, 34);
  for (const item of premium) {
    assert.throws(() => planEquip(null, item), error => error.code === "ITEM_NOT_OWNED");
    const plan = planEquip(owned.find(row => row.itemId === item.itemId), item);
    assert.equal(plan.equipment[plan.slot], item.itemId);
  }
  const shop = buildShopItems(premium, new Set(owned.map(item => item.itemId)), new Set(), 0, 1, new Map(), false);
  assert.ok(shop.every(item => item.owned && item.premiumRequirementSatisfied && item.status === "OWNED"));
  assert.ok(shop.every(item => !item.canPurchase));
});
