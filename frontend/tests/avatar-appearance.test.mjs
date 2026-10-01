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
import { avatarTintMatrix, grayscaleTintMatrix, skinTintMatrix, skinToneRamp } from "../src/avatar/colorize.ts";
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
  assert.ok(skinMatrix.every((value) => value >= 0), "skin tint must not clamp negative channels into red fringes");
  assert.equal(skinMatrix[3], 0);
  assert.equal(skinMatrix[8], 0);
  assert.equal(skinMatrix[13], 0);
  assert.equal(skinMatrix[4], 0);
  assert.equal(skinMatrix[9], 0);
  assert.equal(skinMatrix[14], 0);
  assert.equal(skinMatrix[18], 1);
  const ramp = skinToneRamp("#804020");
  const applySkinMatrix = (gray, alpha = 1) => [0, 5, 10].map((offset) => (
    skinMatrix[offset] * gray + skinMatrix[offset + 1] * gray
      + skinMatrix[offset + 2] * gray + skinMatrix[offset + 3] * alpha
      + skinMatrix[offset + 4]
  ));
  for (const [gray, target] of [[0.6, ramp.shadow], [0.78, ramp.midtone], [0.9, ramp.highlight]]) {
    applySkinMatrix(gray).forEach((value, index) => {
      assert.ok(Math.abs(value - target[index]) < 1e-12);
    });
  }
  assert.deepEqual(applySkinMatrix(0, 0), [0, 0, 0], "transparent pixels must remain colorless");
  assert.deepEqual(avatarTintMatrix("hair", "#804020"), grayscaleTintMatrix("#804020"));
  assert.deepEqual(avatarTintMatrix("eyes", "#804020"), grayscaleTintMatrix("#804020"));
  const layers = read("../src/components/CharacterSpriteLayers.tsx");
  assert.match(layers, /values=\{avatarTintMatrix\(channel as "skin" \| "hair" \| "eyes", color, FILTER_COLOR_SPACE\)\}/);
  assert.match(layers, /filter=\{tint \? `url\(#\$\{id\}-tint-\$\{tint\}\)`/);
});

test("skin swatches survive native linear-RGB filtering without washing out or changing hair/eyes", () => {
  const linear = (value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  const srgb = (value) => value <= 0.0031308 ? value * 12.92 : 1.055 * value ** (1 / 2.4) - 0.055;
  for (const { color } of SKIN_COLORS) {
    const target = [1, 3, 5].map(offset => Number.parseInt(color.slice(offset, offset + 2), 16) / 255);
    for (const space of ["sRGB", "linearRGB"]) {
      const matrix = avatarTintMatrix("skin", color, space);
      const render = (gray) => [0, 5, 10].map(offset => {
        const input = space === "linearRGB" ? linear(gray) : gray;
        const output = input * (matrix[offset] + matrix[offset + 1] + matrix[offset + 2]);
        return Math.min(1, space === "linearRGB" ? srgb(output) : output);
      });
      render(0.78).forEach((value, index) => assert.ok(Math.abs(value - target[index]) < 1e-12));
      const shadow = render(0.6), midtone = render(0.78), highlight = render(0.9);
      for (const tone of [shadow, midtone, highlight]) assert.ok(tone[0] > tone[1] && tone[1] > tone[2]);
      for (let index = 0; index < 3; index++) {
        assert.ok(shadow[index] < midtone[index] && midtone[index] <= highlight[index]);
      }
      // No alpha or bias terms to contaminate translucent skin edges.
      for (const offset of [3, 4, 8, 9, 13, 14, 15, 16, 17, 19]) assert.equal(matrix[offset], 0);
      assert.equal(matrix[18], 1);
      assert.deepEqual(render(0), [0, 0, 0]);
      for (const channel of ["hair", "eyes"]) {
        assert.deepEqual(avatarTintMatrix(channel, color, space), grayscaleTintMatrix(color));
      }
    }
  }
  assert.match(read("../src/components/CharacterSpriteLayers.tsx"), /Platform\.OS === "android" \? "sRGB" : "linearRGB"/);
});

test("all skin presets produce warm shadow, midtone, and highlight ramps", () => {
  for (const { color } of SKIN_COLORS) {
    const red = Number.parseInt(color.slice(1, 3), 16);
    const green = Number.parseInt(color.slice(3, 5), 16);
    const blue = Number.parseInt(color.slice(5, 7), 16);
    assert.ok(red > green && green > blue, `${color} should retain a warm undertone`);
    const ramp = skinToneRamp(color);
    for (const [name, tone] of Object.entries(ramp)) {
      assert.ok(tone[0] > tone[1] && tone[1] > tone[2], `${color} ${name} should stay warm`);
      assert.ok(tone.every((channel) => channel >= 0 && channel <= 1), `${color} ${name} should be display-safe`);
    }
    for (let channel = 0; channel < 3; channel += 1) {
      assert.ok(ramp.shadow[channel] < ramp.midtone[channel]);
      assert.ok(ramp.midtone[channel] <= ramp.highlight[channel]);
    }
  }
});

test("neutral skin, iris, and detail layers are independently registered", () => {
  const registry = read("../src/avatar/assetRegistry.ts");
  assert.match(registry, /appearance\/skin\/boy\/head-neutral\.png/);
  assert.match(registry, /appearance\/skin\/girl\/head-neutral\.png/);
  assert.match(registry, /appearance\/eyes\/boy\/iris-mask\.png/);
  assert.match(registry, /appearance\/eyes\/girl\/eye-details\.png/);
  assert.match(registry, /tint: "skin"/);
  assert.match(registry, /tint: "eyes"/);
  assert.match(registry, /neutralDetails: true/);
  assert.match(registry, /HEAD_DETAIL_CLIP/);
  assert.match(registry, /CROWN_DETAIL_CLIP/);
  assert.match(registry, /skinPair\("head", BOY_SKIN\.head[\s\S]*?HEAD_DETAIL_CLIP\)/);
  assert.match(registry, /skinPair\("crown", GIRL_SKIN\.head[\s\S]*?CROWN_DETAIL_CLIP\)/);
  const layers = read("../src/components/CharacterSpriteLayers.tsx");
  assert.match(layers, /FeColorMatrix type="saturate" values=\{\[0\]\}/);
  assert.match(layers, /neutralDetails \? `url\(#\$\{id\}-neutral-details\)`/);
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

test("base body and starter tunic never opt into outfit clipping", () => {
  const registry = read("../src/avatar/assetRegistry.ts");
  const layers = read("../src/components/CharacterSpriteLayers.tsx");
  assert.match(registry, /sprite\("vest", "upperBody", GUILD_TUNIC\)/);
  assert.doesNotMatch(registry, /coversShoulderCaps|armholeOcclusion|dressClipPath/);
  assert.doesNotMatch(layers, /covered-shoulders|coversShoulderCaps/);
  assert.equal((registry.match(/fullOutfit: true/g) ?? []).length, 1);
});

test("dress body clipping is scoped to equipped full-outfit sprites", () => {
  const registry = read("../src/avatar/assetRegistry.ts");
  const layers = read("../src/components/CharacterSpriteLayers.tsx");
  assert.match(registry, /id, layer: "upperBody", source, fullOutfit: true/);
  assert.match(layers, /const fullOutfit = sprites\.some\(sprite => sprite\.fullOutfit\)/);
  assert.match(layers, /fullOutfit && \(region === "torso" \|\| region === "neck"\)/);
  assert.match(layers, /fullOutfit && isLeg/);
});

test("dress replacements keep one shared sprite and require no renderer-specific rig", () => {
  const registry = read("../src/avatar/assetRegistry.ts");
  const renderer = read("../src/components/AvatarRenderer.tsx");
  const catalog = read("../src/avatar/cosmeticCatalog.ts");
  const contract = read("../assets/avatar/v2/dresses/REPLACEMENT_SPEC.md");
  assert.doesNotMatch(registry, /bodyType\?: BodyType/);
  assert.doesNotMatch(registry, /definition\.bodyType/);
  assert.match(renderer, /getEquippedCharacterSprites\(cosmetics, topId, "TOP"\)/);
  assert.doesNotMatch(catalog, /clothingBack/);
  assert.doesNotMatch(registry, /DressArmholeOcclusion|dressClipPath|armholeOcclusion/);
  assert.match(contract, /corrected artwork at the existing\s+production paths/);
  assert.match(contract, /No runtime armhole mask/);
  assert.doesNotMatch(contract, /aligned\/boy|aligned\/girl|-front\.png|-back\.png/);
});

test("all ten dresses share the narrower centered fit without moving vertical anchors", () => {
  const registry = read("../src/avatar/assetRegistry.ts");
  assert.equal((registry.match(/"avatar-v2\/dresses\/[^"]+": dressAsset\(/g) ?? []).length, 10);
  const destination = registry.match(/\[([\d.]+), y, ([\d.]+), height\]/);
  assert.ok(destination);
  const [, x, width] = destination.map(Number);
  assert.equal(x + width / 2, 627);
  assert.ok(Math.abs(width / 1086 - 0.575) < 1e-12);
  assert.match(registry, /from: top - 4, to: shoulderY, y: 250, height: 45/);
  assert.match(registry, /from: shoulderY, to: waistY, y: 295, height: 275/);
  assert.match(registry, /from: waistY, to: bottom \+ 4, y: 570, height: 610/);
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
