import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { buildShopItems } from "../../backend/functions/get-shop/logic.mjs";
import { wardrobeCosmetics, catalogCosmeticReference, avatarFromInventory } from "../src/avatar/inventory.ts";
import { DEFAULT_APPEARANCE, normalizeAppearance } from "../src/avatar/appearance.ts";
import { memoryCache, inventory as emptyInventory, profile } from "./cache-test-support.mjs";
const root = fileURLToPath(new URL("..", import.meta.url));
const assets = path.join(root, "assets/avatar/v2");
const manifest = JSON.parse(readFileSync(path.join(assets, "premium-collection.json")));
const catalog = JSON.parse(readFileSync(new URL("../../backend/seeds/cosmetics.json", import.meta.url)));
const releases = catalog.filter(item => item.itemId.startsWith("premium_"));
const registry = {};
new Function("exports", "require", ts.transpileModule(readFileSync(path.join(root, "src/avatar/assetRegistry.ts"), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText)(registry, id => {
  const file = path.resolve(root, "src/avatar", id); assert.ok(existsSync(file), `missing ${file}`);
  return id.endsWith(".json") ? JSON.parse(readFileSync(file)) : file;
});
const serverShop = (premium, owned = new Set()) => ({ player: { coins: 12, level: 1 }, items: buildShopItems(releases, owned, new Set(), 12, 1, new Map(), premium) });

test("the launch collection contains exactly 34 unique Premium entries with the requested category counts", () => {
  assert.equal(manifest.length, 34); assert.equal(releases.length, 34);
  assert.equal(new Set(catalog.map(item => item.itemId)).size, catalog.length);
  assert.equal(new Set(manifest.map(item => item.assetKey)).size, 34);
  assert.deepEqual(Object.fromEntries(Object.entries(Object.groupBy(manifest, item => item.kind)).map(([key, rows]) => [key, rows.length])),
    { tops: 5, dresses: 5, bottoms: 5, hats: 5, boots: 5, backgrounds: 3, auras: 3, pets: 3 });
  for (const item of manifest) {
    const record = releases.find(row => row.itemId === item.itemId);
    assert.equal(record.requiresPremium, true); assert.equal(record.price, 0); assert.equal(record.requiredLevel, 1);
    assert.equal(record.requiredAchievement, null); assert.equal(record.assetKey, item.assetKey); assert.equal(record.category, item.category);
    assert.equal(record.SK, `ITEM#${item.itemId}`); assert.equal(record.name, item.name);
  }
});

test("each coordinated family contains one top, dress, bottom, hat and pair of boots", () => {
  const families = Object.groupBy(manifest.filter(item => item.set), item => item.set);
  assert.equal(Object.keys(families).length, 5);
  for (const items of Object.values(families)) assert.deepEqual(items.map(item => item.kind).sort(), ["boots", "bottoms", "dresses", "hats", "tops"]);
});

test("every imported PNG is byte-identical to its recorded original and retains its authored canvas and alpha", () => {
  for (const item of manifest) {
    const bytes = readFileSync(path.join(assets, item.file));
    assert.equal(createHash("sha256").update(bytes).digest("hex"), item.sha256, item.file);
    assert.deepEqual([bytes.readUInt32BE(16), bytes.readUInt32BE(20)], item.canvas);
    assert.equal(bytes[25], item.kind === "backgrounds" ? 2 : 6, "opaque scenes and transparent wearables/pets/auras stay unchanged");
    assert.equal(registry.isCosmeticAssetRegistered(item.assetKey), true);
    const reference = catalogCosmeticReference(item);
    assert.ok(registry.getCosmeticPreviewSource(reference));
    assert.equal(registry.getCosmeticAssetMetadata(item.assetKey).fullOutfit, item.kind === "dresses");
  }
});

test("Premium activation changes server claim flags, never local wardrobe ownership; expiry retains owned gear", () => {
  for (const premium of [false, true]) {
    const shop = serverShop(premium);
    const wardrobe = wardrobeCosmetics(shop, emptyInventory, [], null, registry.getCosmeticAssetMetadata);
    assert.equal(wardrobe.length, 34);
    assert.ok(wardrobe.every(item => !item.owned && !item.unlocked && item.claimable === premium && item.requiresPremium));
  }
  const ids = new Set(releases.map(item => item.itemId)); const shop = serverShop(false, ids);
  const inv = { ...emptyInventory, items: releases.map(item => ({ ...item, equipped: false })) };
  const wardrobe = wardrobeCosmetics(shop, inv, [], null, registry.getCosmeticAssetMetadata);
  assert.ok(wardrobe.every(item => item.owned && item.unlocked && !item.claimable));
  assert.ok(shop.items.every(item => item.owned && item.premiumRequirementSatisfied && !item.canPurchase));
});

test("Premium dresses use the existing full-outfit bands and original body selection without sleeve/armhole metadata", () => {
  for (const item of manifest.filter(item => item.kind === "dresses")) {
    const parts = registry.getEquippedCharacterSprites([catalogCosmeticReference(item)], item.itemId, "TOP");
    assert.deepEqual(parts.map(part => part.key.split(":").at(-1)), ["collar", "bodice", "skirt"]);
    assert.deepEqual(parts.map(part => [part.frame.destination.y, part.frame.destination.height]), [[250, 45], [295, 275], [570, 610]]);
    for (const part of parts) {
      assert.equal(part.layer, "upperBody"); assert.equal(part.fullOutfit, true); assert.equal(part.source, path.join(assets, item.file));
      assert.deepEqual([part.frame.crop.sourceWidth, part.frame.crop.sourceHeight], [1254, 1254]);
      assert.equal(part.frame.destination.x + part.frame.destination.width / 2, 627);
      assert.equal(part.clipPath, undefined); assert.equal(part.frame.sourceClipPath, undefined); assert.equal(part.frame.shearX, undefined);
      assert.equal(part.hairClip, undefined); assert.deepEqual(part.covers, []);
    }
    for (const body of ["BOY", "GIRL"]) assert.equal(registry.getBaseBodySprites(body, parts), registry.BASE_BODY_SPRITES[body]);
  }
});

test("Premium tops retain the complete source canvas and existing clothing/boot layers resolve without new masks", () => {
  for (const item of manifest.filter(item => ["tops", "bottoms", "boots", "hats"].includes(item.kind))) {
    const reference = catalogCosmeticReference(item), parts = registry.getEquippedCharacterSprites([reference], item.itemId, reference.type);
    assert.ok(parts.length > 0);
    assert.ok(parts.every(part => part.source === path.join(assets, item.file)));
    if (item.kind === "tops") {
      assert.equal(parts.length, 1); assert.equal(parts[0].layer, "upperBody"); assert.equal(parts[0].fullOutfit, undefined);
      assert.deepEqual(parts[0].frame.crop, { x: 0, y: 0, width: 1254, height: 1254, sourceWidth: 1254, sourceHeight: 1254 });
      assert.equal(parts[0].clipPath, undefined); assert.equal(parts[0].frame.sourceClipPath, undefined);
    }
    if (item.kind === "boots") {
      assert.equal(parts.length, 2); assert.ok(parts.every(part => part.layer === "boots" && part.bootCuff.width === 110));
    }
  }
});

test("Premium equipment and Shop snapshots hydrate across instances, remain visible during refresh, and stay account scoped", async () => {
  const first = memoryCache(); const shop = serverShop(true, new Set(releases.map(item => item.itemId)));
  const equipped = { ...emptyInventory.equipped, tunic: "premium_rose_bard_dress", hat: "premium_rose_bard_hat", boots: "premium_rose_bard_boots",
    pants: "premium_rose_bard_trousers", background: "premium_aurora_springs", aura: "premium_lunar_veil", pet: "premium_lotus_otter" };
  const inv = { equipped, items: shop.items.map(item => ({ ...item, equipped: Object.values(equipped).includes(item.itemId) })) };
  first.cache.set("alice", "profile", profile); first.cache.set("alice", "inventory", inv); first.cache.set("alice", "shop", shop);
  await new Promise(setImmediate); const second = memoryCache("test", first.values); await second.cache.hydrateUser("alice");
  assert.equal(second.cache.peek("alice", "shop").items.length, 34);
  const saved = second.cache.peek("alice", "inventory");
  assert.equal(avatarFromInventory(saved, DEFAULT_APPEARANCE).equippedTopId, "premium_rose_bard_dress");
  const wardrobe = wardrobeCosmetics(shop, saved, [], null, registry.getCosmeticAssetMetadata);
  for (const [slot, type] of [["background", "BACKGROUND"], ["aura", "AURA"], ["pet", "PET"]]) {
    assert.ok(registry.getEquippedSceneSource(wardrobe, equipped[slot], type));
  }
  let finish; const refresh = second.cache.refresh("alice", "inventory", () => new Promise(resolve => { finish = resolve; }));
  assert.equal(second.cache.peek("alice", "inventory"), saved); finish(inv); await refresh;
  await second.cache.hydrateUser("bob"); assert.equal(second.cache.peek("bob", "inventory"), null); assert.equal(second.cache.peek("bob", "shop"), null);
});

test("equipped and visible Premium art uses bounded prefetch without eagerly loading the collection", async () => {
  const requests = [], exports = {};
  const source = ts.transpileModule(readFileSync(path.join(root, "src/avatar/prefetch.ts"), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  new Function("exports", "require", source)(exports, id => {
    if (id === "react-native") return { Image: { resolveAssetSource: source => ({ uri: source }), prefetch: async uri => { requests.push(uri); return true; } } };
    if (id === "expo-image") return { Image: { prefetch: async uri => { requests.push(uri); return true; } } };
    if (id === "./assetRegistry") return registry;
    if (id === "./inventory") return { catalogCosmeticReference };
    if (id === "./appearance") return { normalizeAppearance };
    if (id === "../home/avatar") return { homeAvatarFromInventory: (inv, appearance) => ({ avatar: avatarFromInventory(inv, appearance),
      cosmetics: inv.items.filter(item => Object.values(inv.equipped).includes(item.itemId)).flatMap(item => {
        const reference = catalogCosmeticReference(item); return reference ? [{ ...reference, name: item.name, equipped: true }] : [];
      }) }) };
    if (id === "./scene") return { getAvatarSceneSource: (items, id) => registry.getEquippedSceneSource(items, id, "BACKGROUND") };
    throw Error(`Unexpected import ${id}`);
  });
  assert.deepEqual(requests, [], "importing the manifest/prefetcher does not preload the collection");
  const shop = serverShop(true, new Set(releases.map(item => item.itemId)));
  const equipped = { ...emptyInventory.equipped, tunic: "premium_rose_bard_dress", hat: "premium_rose_bard_hat", boots: "premium_rose_bard_boots",
    background: "premium_rose_palace", aura: "premium_prismatic_crown", pet: "premium_starlight_moth" };
  const inv = { equipped, items: shop.items.map(item => ({ ...item, equipped: Object.values(equipped).includes(item.itemId) })) };
  const cosmetics = wardrobeCosmetics(shop, inv, [], null, registry.getCosmeticAssetMetadata);
  await exports.prefetchAvatarAssets(avatarFromInventory(inv, DEFAULT_APPEARANCE), cosmetics);
  assert.ok(requests.some(uri => uri.endsWith("/dresses/premium-rose-bard-dress.png")));
  assert.ok(requests.some(uri => uri.endsWith("/backgrounds/premium-rose-palace.png")));
  assert.ok(!requests.some(uri => uri.includes("premium-verdant")));
  const first = memoryCache(); first.cache.set("alice", "profile", { ...profile, ...DEFAULT_APPEARANCE }); first.cache.set("alice", "inventory", inv);
  await exports.prefetchCachedAvatar(first.cache, "alice");
  assert.ok(!requests.some(uri => uri.includes("premium-verdant")), "startup warms equipped items, not the whole Premium catalog");
  requests.length = 0; await exports.prefetchShopThumbnails(shop.items.slice(0, 6));
  assert.equal(requests.length, 6); requests.length = 0;
  await exports.prefetchWardrobeThumbnails(cosmetics.filter(item => item.type === "TOP").slice(0, 8));
  assert.equal(requests.length, 2, "previously prefetched previews are deduplicated");
});
