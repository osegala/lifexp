import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  avatarFromInventory,
  inventoryCosmetics,
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
const starter = {
  itemId: "starter_tunic",
  name: "Starter Tunic",
  category: "tunic",
  assetKey: "starter-tunic.png",
  purchasedAt: null,
  purchasePrice: 25,
  equipped: false,
};

test("owned Starter Tunic resolves into the TOP wardrobe group", () => {
  const wardrobe = wardrobeCosmetics(
    { equipped: equipment, items: [starter] },
    hairIds,
    null,
  );
  assert.equal(wardrobe.filter((item) => item.type === "HAIR").length, 10);
  assert.equal(wardrobe.filter((item) => item.type === "TOP").length, 1);
  const item = wardrobe.find((cosmetic) => cosmetic.type === "TOP");
  assert.ok(item);
  assert.deepEqual(
    { id: item.id, type: item.type, imageUrl: item.imageUrl, equipped: item.equipped },
    { id: "starter_tunic", type: "TOP", imageUrl: "avatar-v2/tops/guild-tunic", equipped: false },
  );
});

test("backend equipment remains authoritative for owned cosmetics", () => {
  const inventory = {
    equipped: { ...equipment, tunic: "starter_tunic" },
    items: [{ ...starter, equipped: true }],
  };
  assert.equal(inventoryCosmetics(inventory)[0].equipped, true);
  assert.equal(avatarFromInventory(inventory).equippedTopId, "starter_tunic");
});

test("all registered built-in hairstyles appear without backend ownership", () => {
  const registry = readFileSync(new URL("../src/avatar/assetRegistry.ts", import.meta.url), "utf8");
  const avatarScreen = readFileSync(new URL("../app/(tabs)/avatar.tsx", import.meta.url), "utf8");
  const registeredHairIds = [...registry.matchAll(/^  "(avatar-v2\/hair\/[^"]+)":/gm)]
    .map((match) => match[1]);
  assert.deepEqual(registeredHairIds, hairIds);
  assert.match(registry, /export function getCosmeticAssetIds[\s\S]*definition\.slot === slot/);
  assert.match(avatarScreen, /getCosmeticAssetIds\("hair"\)/);
  const wardrobe = wardrobeCosmetics(
    { equipped: equipment, items: [] },
    hairIds,
    hairIds[3],
  );
  assert.deepEqual(wardrobe.map((item) => item.id), hairIds);
  assert.equal(wardrobe.filter((item) => item.equipped).length, 1);
  assert.equal(avatarFromInventory({ equipped: equipment, items: [] }, "BOY", hairIds[3]).equippedHairId, hairIds[3]);
});

test("optional local appearance failures retain inventory and built-in hair", async () => {
  const appearance = await loadOptionalAppearance(
    async () => { throw new Error("body storage unavailable"); },
    async () => { throw new Error("hair storage unavailable"); },
  );
  const wardrobe = wardrobeCosmetics(
    { equipped: equipment, items: [starter] },
    hairIds,
    appearance.hairId,
  );
  assert.deepEqual(appearance, { bodyType: "BOY", hairId: null });
  assert.equal(wardrobe.length, 11);
  assert.equal(avatarFromInventory(
    { equipped: equipment, items: [starter] },
    appearance.bodyType,
    appearance.hairId,
  ).bodyType, "BOY");
});

test("appearance storage uses web localStorage, native SecureStore, and safe fallbacks", () => {
  const source = readFileSync(new URL("../src/avatar/localAppearance.ts", import.meta.url), "utf8");
  assert.match(source, /Platform\.OS === "web"/);
  assert.match(source, /globalThis\.localStorage\?\.getItem/);
  assert.match(source, /globalThis\.localStorage\?\.setItem/);
  assert.match(source, /SecureStore\.getItemAsync/);
  assert.match(source, /catch \(error\)[\s\S]*return null/);
});

test("unowned local gear is not exposed and backend hair cannot replace built-ins", () => {
  const wardrobe = wardrobeCosmetics(
    { equipped: equipment, items: [{ ...starter, itemId: "legacy_hair", category: "hair" }] },
    hairIds,
    null,
  );
  assert.equal(wardrobe.length, hairIds.length);
  assert.ok(wardrobe.every((item) => item.type === "HAIR"));
});

test("unknown asset keys are reported and retained for the safe placeholder", () => {
  const unresolved = [];
  const [item] = inventoryCosmetics(
    { equipped: equipment, items: [{ ...starter, assetKey: "missing.png" }] },
    () => false,
    (itemId, assetKey) => unresolved.push([itemId, assetKey]),
  );
  assert.equal(item.imageUrl, "missing.png");
  assert.deepEqual(unresolved, [["starter_tunic", "missing.png"]]);
});

test("a catalog dress sharing the tunic category stays in TOP", () => {
  const [dress] = inventoryCosmetics({
    equipped: equipment,
    items: [{ ...starter, itemId: "forestbound_dress", name: "Forestbound Dress", assetKey: "avatar-v2/dresses/forest-ranger" }],
  });
  assert.equal(dress.type, "TOP");
  assert.equal(dress.imageUrl, "avatar-v2/dresses/forest-ranger");
});

test("an owned achievement cosmetic remains in the mapped wardrobe", () => {
  const achievementHat = {
    ...starter,
    itemId: "achievement_hat",
    name: "Achievement Hat",
    category: "hat",
    assetKey: "avatar-v2/hats/azure-feather-cap",
  };
  const wardrobe = wardrobeCosmetics(
    { equipped: equipment, items: [achievementHat] },
    hairIds,
    null,
  );
  assert.ok(wardrobe.some((item) =>
    item.id === "achievement_hat" && item.type === "HAT"));
});

test("retired equipment concepts are absent from active types and rendering", () => {
  const activeSources = [
    "../src/types/avatar.ts",
    "../src/avatar/cosmeticCatalog.ts",
    "../src/avatar/assetRegistry.ts",
    "../src/avatar/inventory.ts",
    "../src/components/AvatarRenderer.tsx",
    "../app/(tabs)/avatar.tsx",
  ].map((path) => readFileSync(new URL(path, import.meta.url), "utf8"));
  const term = (...parts) => parts.join("");
  const retiredTerms = [
    term("CA", "PE"), term("WEA", "PON"), term("SHI", "ELD"),
    term("ca", "pe", "Id"), term("wea", "pon", "Id"), term("shi", "eld", "Id"),
    term("equipped", "Ca", "peId"), term("equipped", "Wea", "ponId"),
    term("equipped", "Shi", "eldId"),
  ];
  for (const term of retiredTerms) {
    assert.ok(activeSources.every((source) => !source.includes(term)), term);
  }
});

test("hair persistence is local while hats retain existing clipping metadata", () => {
  const avatarScreen = readFileSync(new URL("../app/(tabs)/avatar.tsx", import.meta.url), "utf8");
  const registry = readFileSync(new URL("../src/avatar/assetRegistry.ts", import.meta.url), "utf8");
  assert.match(avatarScreen, /cosmetic\.type === "HAIR"[\s\S]*?setLocalHairId/);
  assert.match(avatarScreen, /setAvatar\(\(current\)[\s\S]*equippedHairId/);
  assert.match(avatarScreen, /inventoryEquip[\s\S]*?itemId: String\(cosmetic\.id\)/);
  assert.match(registry, /hairClip/);
  assert.match(registry, /headClip/);
  assert.match(registry, /tuckPonytail/);
});
