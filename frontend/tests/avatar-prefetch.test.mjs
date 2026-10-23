import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import * as inventory from "../src/avatar/inventory.ts";
import * as appearance from "../src/avatar/appearance.ts";
import { memoryCache, profile, inventory as emptyInventory } from "./cache-test-support.mjs";

function harness() {
  const calls = [], equipped = []; let fail = false;
  const source = ts.transpileModule(readFileSync(new URL("../src/avatar/prefetch.ts", import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  const home = {};
  const homeSource = ts.transpileModule(readFileSync(new URL("../src/home/avatar.ts", import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  new Function("exports", "require", homeSource)(home, () => inventory);
  const imports = {
    "../home/avatar": home, "./appearance": appearance,
    "react-native": { Image: { resolveAssetSource: source => ({ uri: typeof source === "string" ? source : `bundle:${source}` }),
      prefetch: async uri => { calls.push(["sprite", uri]); if (fail) throw Error("offline"); return true; } } },
    "expo-image": { Image: { prefetch: async (uri, options) => { calls.push(["thumbnail", uri, options]); return !fail; } } },
    "./inventory": inventory, "./scene": { getAvatarSceneSource: () => "garden" },
    "./assetRegistry": { getCosmeticPreviewSource: item => item.imageUrl,
      getEquippedCharacterSprites: (_items, id, type) => { equipped.push([id, type]); return id ? [{ source: `${type}:${id}` }] : []; },
      getBaseBodySprites: (body, clothing) => { assert.equal(body, "GIRL"); assert.equal(clothing.length, 3); return [{ source: "base" }]; },
      resolveSpriteSet: (_key, sprites) => sprites,
      getEquippedSceneSource: (_items, id, type) => id ? `${type}:${id}` : undefined },
  };
  const exports = {}; new Function("exports", "require", source)(exports, id => { assert.ok(id in imports); return imports[id]; });
  return { ...exports, calls, equipped, fail: value => { fail = value; } };
}

test("equipped sprite prefetch follows the renderer's actual body, clothing, hair, hat and scene resolvers", async () => {
  const h = harness(); const avatar = { bodyType: "GIRL", equippedHairId: "hair", equippedHatId: "hat", equippedTopId: "top",
    equippedBottomId: "bottom", equippedBootsId: "boots", equippedBackgroundId: null, equippedPetId: "pet", equippedAuraId: "aura" };
  await h.prefetchAvatarAssets(avatar, []);
  assert.deepEqual(h.equipped, [["bottom", "BOTTOM"], ["boots", "BOOTS"], ["top", "TOP"], ["hair", "HAIR"], ["hat", "HAT"]]);
  assert.deepEqual(h.calls.map(call => call[1]), ["BOTTOM:bottom", "BOOTS:boots", "TOP:top", "HAIR:hair", "HAT:hat", "base", "garden", "PET:pet", "AURA:aura"]);
  await h.prefetchAvatarAssets(avatar, []); assert.equal(h.calls.length, 9, "same URI work is deduplicated");
});

test("visible Shop and wardrobe thumbnails use the shared asset mapping and memory/disk image cache", async () => {
  const h = harness();
  await h.prefetchShopThumbnails([{ itemId: "top", category: "tunic", assetKey: "forest-tunic.png" }, { itemId: "unknown", category: "unknown", assetKey: "missing" }]);
  await h.prefetchWardrobeThumbnails([{ imageUrl: "avatar-v2/tops/forest-ranger" }, { imageUrl: "avatar-v2/hats/hat" }]);
  assert.deepEqual(h.calls, [["thumbnail", "avatar-v2/tops/forest-ranger", { cachePolicy: "memory-disk" }],
    ["thumbnail", "avatar-v2/hats/hat", { cachePolicy: "memory-disk" }]]);
});

test("prefetch is best effort; failed requests are retryable and cannot reject a data refresh", async () => {
  const h = harness(); h.fail(true);
  await h.prefetchWardrobeThumbnails([{ imageUrl: "hat" }]); h.fail(false);
  await h.prefetchWardrobeThumbnails([{ imageUrl: "hat" }]); assert.equal(h.calls.length, 2);
});

test("account hydration prefetch resolves the persisted equipped snapshot before Avatar mounts", async () => {
  const h = harness(), first = memoryCache();
  const equipped = { ...emptyInventory.equipped, tunic: "top", pants: "bottom", boots: "boots", hat: "hat", pet: "pet", aura: "aura", background: "garden" };
  first.cache.set("alice", "profile", { ...profile, ...appearance.DEFAULT_APPEARANCE, bodyType: "GIRL" });
  first.cache.set("alice", "inventory", { equipped, items: [] }); await new Promise(setImmediate);
  const cache = memoryCache("test", first.values).cache; await cache.hydrateUser("alice");
  await h.prefetchCachedAvatar(cache, "alice");
  assert.deepEqual(h.equipped, [["bottom", "BOTTOM"], ["boots", "BOOTS"], ["top", "TOP"], [appearance.DEFAULT_APPEARANCE.hairId, "HAIR"], ["hat", "HAT"]]);
  assert.deepEqual(h.calls.map(call => call[1]), ["BOTTOM:bottom", "BOOTS:boots", "TOP:top", `HAIR:${appearance.DEFAULT_APPEARANCE.hairId}`,
    "HAT:hat", "base", "garden", "PET:pet", "AURA:aura"]);
  const calls = h.calls.length;
  await h.prefetchCachedAvatar(cache, "bob"); assert.equal(h.calls.length, calls, "never use another account's equipment");
});
