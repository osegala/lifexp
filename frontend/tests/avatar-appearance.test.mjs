import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  DEFAULT_APPEARANCE,
  EYE_COLORS,
  HAIR_COLORS,
  HAIR_STYLE_IDS,
  loadPreferredAppearance,
  normalizeAppearance,
  SKIN_COLORS,
} from "../src/avatar/appearance.ts";
import { avatarTintMatrix, grayscaleTintMatrix, skinTintMatrix } from "../src/avatar/colorize.ts";
import { avatarFromInventory } from "../src/avatar/inventory.ts";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const equipment = {
  tunic: "tunic-1", pants: "pants-1", boots: "boots-1", hat: "hat-1",
  hair: null, pet: "pet-1", aura: "aura-1", background: "background-1",
};
const inventory = { equipped: equipment, items: [] };

test("curated appearance palettes expose 10 styles, 16 skin tones, 20 hair colors, and 12 eye colors", () => {
  assert.equal(HAIR_STYLE_IDS.length, 10);
  assert.equal(SKIN_COLORS.length, 16);
  assert.equal(HAIR_COLORS.length, 20);
  assert.equal(EYE_COLORS.length, 12);
  assert.equal(new Set([...SKIN_COLORS, ...HAIR_COLORS, ...EYE_COLORS].map(({ color }) => color)).has(undefined), false);
});

test("server appearance wins and is cached after a successful load", async () => {
  const server = { ...DEFAULT_APPEARANCE, bodyType: "GIRL", skinColorId: "skin_12", eyeColorId: "green" };
  const cached = [];
  const result = await loadPreferredAppearance(
    async () => server,
    async () => ({ ...DEFAULT_APPEARANCE, bodyType: "BOY" }),
    async (appearance) => { cached.push(appearance); },
  );
  assert.deepEqual(result, server);
  assert.deepEqual(cached, [server]);
});

test("local appearance is only an offline fallback", async () => {
  const local = { ...DEFAULT_APPEARANCE, hairColorId: "purple" };
  const result = await loadPreferredAppearance(
    async () => { throw new Error("offline"); },
    async () => local,
  );
  assert.deepEqual(result, local);
});

test("appearance normalization rejects unknown asset IDs and raw colors", () => {
  assert.deepEqual(normalizeAppearance({
    bodyType: "GIRL",
    hairId: "paid-hair",
    skinColorId: "#fff",
    hairColorId: "rainbow",
    eyeColorId: "laser",
  }), { ...DEFAULT_APPEARANCE, bodyType: "GIRL" });
});

test("body switching preserves all equipped cosmetics and appearance colors", () => {
  const before = avatarFromInventory(inventory, { ...DEFAULT_APPEARANCE, bodyType: "BOY" });
  const after = avatarFromInventory(inventory, { ...DEFAULT_APPEARANCE, bodyType: "GIRL" });
  assert.equal(before.bodyType, "BOY");
  assert.equal(after.bodyType, "GIRL");
  for (const field of [
    "equippedHairId", "equippedHatId", "equippedTopId", "equippedBottomId",
    "equippedBootsId", "equippedBackgroundId", "equippedPetId", "equippedAuraId",
    "skinColorId", "hairColorId", "eyeColorId",
  ]) assert.equal(after[field], before[field], field);
});

test("color matrix preserves grayscale luminance and alpha instead of flattening sprites", () => {
  assert.deepEqual(grayscaleTintMatrix("#804020"), [
    128 / 255, 0, 0, 0, 0,
    0, 64 / 255, 0, 0, 0,
    0, 0, 32 / 255, 0, 0,
    0, 0, 0, 1, 0,
  ]);
  const skinMatrix = avatarTintMatrix("skin", "#804020");
  assert.deepEqual(skinMatrix, skinTintMatrix("#804020"));
  assert.equal(skinMatrix[4], (128 / 255) * 0.18 + 0.018);
  assert.equal(skinMatrix[9], (64 / 255) * 0.1);
  assert.equal(skinMatrix[14], (32 / 255) * 0.055);
  assert.equal(skinMatrix[18], 1);
  for (const [offset, target] of [[0, 128 / 255], [5, 64 / 255], [10, 32 / 255]]) {
    const whiteOutput = skinMatrix[offset] + skinMatrix[offset + 1]
      + skinMatrix[offset + 2] + skinMatrix[offset + 4];
    assert.ok(Math.abs(whiteOutput - target) < 1e-12);
  }
  assert.deepEqual(avatarTintMatrix("hair", "#804020"), grayscaleTintMatrix("#804020"));
  const layers = read("../src/components/CharacterSpriteLayers.tsx");
  assert.match(layers, /values=\{avatarTintMatrix\(channel as "skin" \| "hair" \| "eyes", color\)\}/);
  assert.match(layers, /filter=\{tint \? `url\(#\$\{id\}-tint-\$\{tint\}\)`/);
});

test("light skin swatches remain warm and skin shadows retain color", () => {
  for (const { color } of SKIN_COLORS) {
    const red = Number.parseInt(color.slice(1, 3), 16);
    const green = Number.parseInt(color.slice(3, 5), 16);
    const blue = Number.parseInt(color.slice(5, 7), 16);
    assert.ok(red > green && green > blue, `${color} should retain a warm undertone`);
  }

  const paleSkin = avatarTintMatrix("skin", SKIN_COLORS[0].color);
  assert.ok(paleSkin[4] > paleSkin[9] && paleSkin[9] > paleSkin[14]);
  assert.ok(paleSkin[14] > 0, "skin shadows should not collapse to neutral black");
  assert.ok(paleSkin[4] / paleSkin[9] > 2, "skin shadows should retain a warm chromatic bias");
});

test("neutral skin, iris, and detail layers are independently registered", () => {
  const registry = read("../src/avatar/assetRegistry.ts");
  assert.match(registry, /appearance\/skin\/boy\/head-neutral\.png/);
  assert.match(registry, /appearance\/skin\/girl\/head-neutral\.png/);
  assert.match(registry, /appearance\/eyes\/boy\/iris-mask\.png/);
  assert.match(registry, /appearance\/eyes\/girl\/eye-details\.png/);
  assert.match(registry, /tint: "skin"/);
  assert.match(registry, /tint: "eyes"/);
  assert.match(registry, /HEAD_DETAIL_CLIP/);
  assert.match(registry, /CROWN_DETAIL_CLIP/);
  assert.match(registry, /skinPair\("head", BOY_SKIN\.head[\s\S]*?HEAD_DETAIL_CLIP\)/);
  assert.match(registry, /skinPair\("crown", GIRL_SKIN\.head[\s\S]*?CROWN_DETAIL_CLIP\)/);
});

test("all hairstyles use neutral tint sources and Twin Braids bows remain untinted", () => {
  const registry = read("../src/avatar/assetRegistry.ts");
  for (const filename of [
    "windblown-layers-neutral", "side-swept-layers-neutral", "spring-curls-neutral",
    "skyward-spikes-neutral", "tousled-layers-neutral", "curtain-bob-neutral",
    "high-ponytail-neutral", "twin-braids-neutral", "feathered-sweep-neutral", "long-shag-neutral",
  ]) assert.match(registry, new RegExp(filename));
  assert.match(registry, /twin-braids-details\.png/);
  assert.match(registry, /id: `\$\{part\.id\}-details`[\s\S]*?tint: undefined/);
});

test("existing hat clips, ponytail tuck, dress coverage, and paid ownership gates remain active", () => {
  const registry = read("../src/avatar/assetRegistry.ts");
  const layers = read("../src/components/CharacterSpriteLayers.tsx");
  const inventorySource = read("../src/avatar/inventory.ts");
  assert.match(registry, /hairClip/);
  assert.match(registry, /tuckPonytail/);
  assert.match(layers, /tuckPonytail && hairPart === "ponytail"/);
  assert.match(layers, /fullOutfit && layer === "bottoms"/);
  assert.match(inventorySource, /const ownedById = new Map/);
  assert.match(inventorySource, /unlocked: Boolean\(owned\)/);
});

test("starter tunic and normalized dresses opt into shoulder-cap coverage", () => {
  const registry = read("../src/avatar/assetRegistry.ts");
  const layers = read("../src/components/CharacterSpriteLayers.tsx");
  assert.equal((registry.match(/coversShoulderCaps: true/g) ?? []).length, 2);
  assert.match(registry, /sprite\("vest", "upperBody", GUILD_TUNIC\), coversShoulderCaps: true/);
  assert.match(registry, /layer: "upperBody", source, fullOutfit: true, coversShoulderCaps: true/);
  assert.match(layers, /covered-shoulders/);
  assert.match(layers, /region === "torso" \|\| region === "upperArmLeft" \|\| region === "upperArmRight"/);
  assert.match(layers, /fullOutfit && \(region === "torso" \|\| region === "neck"\)/);
  assert.ok(
    layers.indexOf('fullOutfit && (region === "torso" || region === "neck")')
      < layers.indexOf('coveredShoulder ? `${id}-covered-shoulders`'),
    "dress torso clipping must take precedence over shoulder-cap clipping",
  );
});

test("Avatar screen previews drafts and saves all five fields with one PATCH", () => {
  const screen = read("../app/(tabs)/avatar.tsx");
  assert.match(screen, /skinColorId=\{avatar\?\.skinColorId\}/);
  assert.match(screen, /hairColorId=\{avatar\?\.hairColorId\}/);
  assert.match(screen, /eyeColorId=\{avatar\?\.eyeColorId\}/);
  assert.match(screen, /api\.patch<AvatarAppearance>\(apiRoutes\.me, draftAppearance\)/);
  assert.match(screen, /setLocalAppearance\(user\.id, persisted\)/);
  assert.doesNotMatch(screen, /api\.patch[\s\S]{0,120}onSelect/);
});

test("Avatar screen keeps appearance controls in an on-demand modal", () => {
  const screen = read("../app/(tabs)/avatar.tsx");
  assert.match(screen, /<Text style=\{styles\.editAppearanceText\}>Edit Appearance<\/Text>/);
  assert.match(screen, /<Modal[\s\S]*?visible=\{editingAppearance\}[\s\S]*?<AppearanceEditor/);
  assert.ok(screen.indexOf("<Modal") < screen.indexOf("<AppearanceEditor"));
});

test("registration reuses the complete appearance editor and persists one appearance model", () => {
  const register = read("../app/register.tsx");
  assert.match(register, /<AppearanceEditor[\s\S]*?appearance=\{appearance\}[\s\S]*?showSaveButton=\{false\}/);
  assert.match(register, /<AvatarRenderer[\s\S]*?bodyType=\{appearance\.bodyType\}[\s\S]*?eyeColorId=\{appearance\.eyeColorId\}/);
  assert.match(register, /api\.patch\(apiRoutes\.me, appearance\)/);
});

test("appearance cache keys are isolated by authenticated user and account deletion targets that key", () => {
  const storage = read("../src/avatar/localAppearance.ts");
  const cleanup = read("../src/storage/localAccountData.ts");
  assert.match(storage, /evrenthia\.avatar\.\$\{encodeURIComponent\(String\(userId\)\)\}\.appearance/);
  assert.doesNotMatch(storage, /evrenthia\.avatar\.bodyType|evrenthia\.avatar\.hairId/);
  assert.match(cleanup, /clearLocalAppearance\(userId\)/);
});
