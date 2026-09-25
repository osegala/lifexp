import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  avatarFromInventory,
  catalogCosmeticReference,
  loadOptionalAppearance,
  wardrobeCosmetics,
} from "../src/avatar/inventory.ts";

const hairIds = [
  "avatar-v2/hair/windblown-layers",
  "avatar-v2/hair/side-swept-layers",
  "avatar-v2/hair/spring-curls",
  "avatar-v2/hair/skyward-spikes",
  "avatar-v2/hair/tousled-layers",
  "avatar-v2/hair/curtain-bob",
  "avatar-v2/hair/high-ponytail",
  "avatar-v2/hair/twin-braids",
  "avatar-v2/hair/feathered-sweep",
  "avatar-v2/hair/long-shag",
];
const equipment = {
  tunic: null, pants: null, boots: null, hat: null,
  hair: null, pet: null, aura: null, background: null,
};
const starterInventory = {
  itemId: "starter_tunic",
  name: "Starter Tunic",
  category: "tunic",
  assetKey: "starter-tunic.png",
  purchasedAt: null,
  purchasePrice: 25,
  equipped: false,
};

function shopItem(overrides = {}) {
  return {
    itemId: "starter_tunic",
    name: "Starter Tunic",
    category: "tunic",
    price: 25,
    effectivePrice: 25,
    requiredLevel: 1,
    effectiveRequiredLevel: 1,
    requiredAchievement: null,
    achievementRequirement: null,
    requirementSatisfied: true,
    assetKey: "starter-tunic.png",
    owned: false,
    unlocked: true,
    canAfford: true,
    canPurchase: true,
    status: "PURCHASABLE",
    ...overrides,
  };
}

const shop = (items, level = 1) => ({ player: { level, coins: 1_000 }, items });
const metadata = (assetKey) => {
  const group = assetKey.split("/")[1];
  const slot = {
    tops: "upperBody", dresses: "upperBody", bottoms: "bottoms", boots: "boots",
    hats: "head", backgrounds: "scene", pets: "pet", auras: "aura", hair: "hair",
  }[group];
  return slot ? { slot, fullOutfit: group === "dresses" } : null;
};

test("central registry discovery supplies all ten built-in hairstyles", () => {
  const registry = readFileSync(new URL("../src/avatar/assetRegistry.ts", import.meta.url), "utf8");
  const avatarScreen = readFileSync(new URL("../app/(tabs)/avatar.tsx", import.meta.url), "utf8");
  const registeredHairIds = [...registry.matchAll(/^  "(avatar-v2\/hair\/[^"]+)":/gm)]
    .map((match) => match[1]);
  assert.deepEqual(registeredHairIds, hairIds);
  assert.match(registry, /export function getCosmeticAssetIds[\s\S]*definition\.slot === slot/);
  assert.match(avatarScreen, /getCosmeticAssetIds\("hair"\)/);
});

test("catalog and inventory merge shows owned Starter Tunic and locked Forest Tunic", () => {
  const cosmetics = wardrobeCosmetics(
    shop([
      shopItem({ owned: true, status: "OWNED", canPurchase: false }),
      shopItem({
        itemId: "forest_tunic", name: "Forest Tunic", assetKey: "forest-tunic.png",
        price: 250, effectivePrice: 250, requiredLevel: 5, effectiveRequiredLevel: 5,
        unlocked: false, canPurchase: false, status: "LOCKED",
      }),
    ]),
    { equipped: equipment, items: [starterInventory] },
    hairIds,
    null,
    metadata,
  );
  assert.equal(cosmetics.filter((item) => item.type === "HAIR").length, 10);
  const starter = cosmetics.find((item) => item.id === "starter_tunic");
  const forest = cosmetics.find((item) => item.id === "forest_tunic");
  assert.deepEqual(
    { type: starter.type, imageUrl: starter.imageUrl, owned: starter.owned, unlocked: starter.unlocked },
    { type: "TOP", imageUrl: "avatar-v2/tops/guild-tunic", owned: true, unlocked: true },
  );
  assert.deepEqual(
    { imageUrl: forest.imageUrl, owned: forest.owned, unlocked: forest.unlocked, shopStatus: forest.shopStatus, requirementText: forest.requirementText },
    { imageUrl: "avatar-v2/tops/forest-ranger", owned: false, unlocked: false, shopStatus: "LOCKED", requirementText: "Reach level 5" },
  );
});

test("inventory remains authoritative for ownership and equipped state", () => {
  const catalogClaimsOwned = shopItem({ owned: true, status: "OWNED" });
  const [withoutInventory] = wardrobeCosmetics(
    shop([catalogClaimsOwned]), { equipped: equipment, items: [] }, [], null, metadata,
  );
  assert.equal(withoutInventory.unlocked, false);

  const equippedInventory = {
    equipped: { ...equipment, tunic: "starter_tunic" },
    items: [{ ...starterInventory, equipped: true }],
  };
  const [withInventory] = wardrobeCosmetics(
    shop([shopItem()]), equippedInventory, [], null, metadata,
  );
  assert.equal(withInventory.unlocked, true);
  assert.equal(withInventory.equipped, true);
  assert.equal(avatarFromInventory(equippedInventory).equippedTopId, "starter_tunic");
});

test("optional local appearance failures retain the catalog wardrobe", async () => {
  const appearance = await loadOptionalAppearance(
    async () => { throw new Error("body storage unavailable"); },
    async () => { throw new Error("hair storage unavailable"); },
  );
  const cosmetics = wardrobeCosmetics(
    shop([shopItem({ owned: true, status: "OWNED" })]),
    { equipped: equipment, items: [starterInventory] },
    hairIds,
    appearance.hairId,
    metadata,
  );
  assert.deepEqual(appearance, { bodyType: "BOY", hairId: null });
  assert.equal(cosmetics.length, 11);
});

test("appearance storage uses web localStorage, native SecureStore, and safe fallbacks", () => {
  const source = readFileSync(new URL("../src/avatar/localAppearance.ts", import.meta.url), "utf8");
  assert.match(source, /Platform\.OS === "web"/);
  assert.match(source, /globalThis\.localStorage\?\.getItem/);
  assert.match(source, /globalThis\.localStorage\?\.setItem/);
  assert.match(source, /SecureStore\.getItemAsync/);
  assert.match(source, /catch \(error\)[\s\S]*return null/);
});

test("achievement cosmetics are locked until owned and selectable after ownership", () => {
  const achievement = {
    achievementId: "COMPLETE_25_TASKS",
    name: "Forestbound",
    description: "Complete 25 tasks.",
    type: "TASKS_COMPLETED",
    requiredValue: 25,
    currentValue: 10,
    progressPercent: 40,
    satisfied: false,
  };
  const item = shopItem({
    itemId: "forestbound_cap", name: "Forestbound Cap", category: "hat",
    assetKey: "avatar-v2/hats/forest-ranger-hat", requiredAchievement: "COMPLETE_25_TASKS",
    achievementRequirement: achievement, requirementSatisfied: false,
    unlocked: false, canPurchase: false, status: "LOCKED",
  });
  const [locked] = wardrobeCosmetics(shop([item]), { equipped: equipment, items: [] }, [], null, metadata);
  assert.equal(locked.unlocked, false);
  assert.equal(locked.requirementText, "Complete \"Forestbound\"");

  const ownedInventory = {
    equipped: { ...equipment, hat: "forestbound_cap" },
    items: [{ ...starterInventory, itemId: "forestbound_cap", category: "hat", assetKey: item.assetKey, equipped: true }],
  };
  const [owned] = wardrobeCosmetics(shop([{ ...item, owned: true, status: "OWNED" }]), ownedInventory, [], null, metadata);
  assert.equal(owned.unlocked, true);
  assert.equal(owned.equipped, true);
});

test("catalog categories map to every active wardrobe section and dresses stay full outfits", () => {
  const registry = readFileSync(new URL("../src/avatar/assetRegistry.ts", import.meta.url), "utf8");
  assert.match(registry, /getCosmeticAssetMetadata[\s\S]*sprites\?\.some\(\(sprite\) => sprite\.fullOutfit\)/);
  const cases = [
    ["dress", "tunic", "avatar-v2/dresses/frostbound", "TOP", "upperBody", true],
    ["pants", "pants", "avatar-v2/bottoms/traveler-trousers", "BOTTOM", "bottoms", false],
    ["boots", "boots", "avatar-v2/boots/guild-boots", "BOOTS", "boots", false],
    ["hat", "hat", "avatar-v2/hats/azure-feather-cap", "HAT", "head", false],
    ["scene", "background", "avatar-v2/backgrounds/castle-garden", "BACKGROUND", "scene", false],
    ["pet", "pet", "avatar-v2/pets/starlight-cat", "PET", "pet", false],
    ["aura", "aura", "avatar-v2/auras/heartbloom", "AURA", "aura", false],
  ];
  const items = cases.map(([itemId, category, assetKey]) => shopItem({ itemId, category, assetKey }));
  const cosmetics = wardrobeCosmetics(shop(items), { equipped: equipment, items: [] }, [], null, metadata);
  for (const [itemId, , , type, slot, fullOutfit] of cases) {
    const cosmetic = cosmetics.find((item) => item.id === itemId);
    assert.deepEqual([cosmetic.type, cosmetic.slot, cosmetic.fullOutfit], [type, slot, fullOutfit]);
  }
});

test("unowned registry cosmetics do not appear without a shop catalog item", () => {
  const cosmetics = wardrobeCosmetics(shop([]), { equipped: equipment, items: [] }, hairIds, null, metadata);
  assert.deepEqual(cosmetics.map((item) => item.id), hairIds);
});

test("unknown catalog asset keys are reported and retained for the safe placeholder", () => {
  const unresolved = [];
  const [item] = wardrobeCosmetics(
    shop([shopItem({ assetKey: "missing.png" })]),
    { equipped: equipment, items: [] },
    [],
    null,
    metadata,
    (itemId, assetKey) => unresolved.push([itemId, assetKey]),
  );
  assert.equal(item.imageUrl, "missing.png");
  assert.deepEqual(unresolved, [["starter_tunic", "missing.png"]]);
});

test("Shop and Avatar share canonical catalog category and asset mapping", () => {
  assert.deepEqual(catalogCosmeticReference(shopItem()), {
    id: "starter_tunic", type: "TOP", imageUrl: "avatar-v2/tops/guild-tunic",
  });
  const shopScreen = readFileSync(new URL("../app/(tabs)/shop.tsx", import.meta.url), "utf8");
  const avatarScreen = readFileSync(new URL("../app/(tabs)/avatar.tsx", import.meta.url), "utf8");
  assert.match(shopScreen, /catalogCosmeticReference\(item\)/);
  assert.match(avatarScreen, /api\.get<ShopResponse>\(apiRoutes\.shop\)/);
  assert.match(avatarScreen, /api\.get<InventoryResponse>\(apiRoutes\.inventory\)/);
});

test("locked cards cannot equip while owned cards use backend equip endpoints", () => {
  const avatarScreen = readFileSync(new URL("../app/(tabs)/avatar.tsx", import.meta.url), "utf8");
  assert.match(avatarScreen, /if \(!cosmetic\.unlocked\) \{\s*return;/);
  assert.match(avatarScreen, /disabled=\{!cosmetic\.unlocked \|\| loading\}/);
  assert.match(avatarScreen, /inventoryEquip[\s\S]*?itemId: String\(cosmetic\.id\)/);
});

test("retired equipment concepts are absent from active types and rendering", () => {
  const activeSources = [
    "../src/types/avatar.ts", "../src/avatar/cosmeticCatalog.ts",
    "../src/avatar/assetRegistry.ts", "../src/avatar/inventory.ts",
    "../src/components/AvatarRenderer.tsx", "../app/(tabs)/avatar.tsx",
  ].map((path) => readFileSync(new URL(path, import.meta.url), "utf8"));
  const term = (...parts) => parts.join("");
  for (const retired of [
    term("CA", "PE"), term("WEA", "PON"), term("SHI", "ELD"),
    term("ca", "pe", "Id"), term("wea", "pon", "Id"), term("shi", "eld", "Id"),
  ]) assert.ok(activeSources.every((source) => !source.includes(retired)), retired);
});

test("hair remains local while hats retain clipping and ponytail rules", () => {
  const avatarScreen = readFileSync(new URL("../app/(tabs)/avatar.tsx", import.meta.url), "utf8");
  const registry = readFileSync(new URL("../src/avatar/assetRegistry.ts", import.meta.url), "utf8");
  assert.match(avatarScreen, /cosmetic\.type === "HAIR"[\s\S]*?setLocalHairId/);
  assert.match(avatarScreen, /setAvatar\(\(current\)[\s\S]*equippedHairId/);
  assert.match(registry, /hairClip/);
  assert.match(registry, /headClip/);
  assert.match(registry, /tuckPonytail/);
});
