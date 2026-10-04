import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

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
// Exercise the real registry without loading native UI or decoding PNG imports.
const registry = {};
new Function("exports", "require", ts.transpileModule(read("../src/avatar/assetRegistry.ts"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
}).outputText)(registry, (path) => path.endsWith(".json")
  ? JSON.parse(read(`../src/avatar/${path}`)) : path);
const equipment = {
  tunic: "tunic-1", pants: "pants-1", boots: "boots-1", hat: "hat-1",
  hair: null, pet: "pet-1", aura: "aura-1", background: "background-1",
};
const inventory = { equipped: equipment, items: [] };

test("curated appearance palettes expose 20 styles, 16 skin tones, 20 hair colors, and 12 eye colors", () => {
  assert.equal(HAIR_STYLE_IDS.length, 20);
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
  assert.deepEqual(avatarTintMatrix("hair", "#804020").slice(15), [0, 0, 0, 1, 0]);
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
      assert.deepEqual(avatarTintMatrix("eyes", color, space), grayscaleTintMatrix(color));
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
  assert.match(layers, /FeColorMatrix in="SourceGraphic" type="saturate" values=\{\[0\]\}/);
  assert.match(layers, /neutralDetails \? `url\(#\$\{id\}-neutral-details\)`/);
});

test("original hairstyles retain their neutral sources and Twin Braids bows remain untinted", () => {
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

test("GIRL body selection follows rendered clothing without changing BOY", () => {
  const { BASE_BODY_SPRITES, getBaseBodySprites } = registry;
  for (const clothing of [[], [{ layer: "upperBody" }], [{ layer: "bottoms" }], [{ fullOutfit: true }]]) {
    assert.equal(getBaseBodySprites("BOY", clothing), BASE_BODY_SPRITES.BOY);
  }
  assert.equal(getBaseBodySprites("GIRL", [{ fullOutfit: true }]), BASE_BODY_SPRITES.GIRL);
  const bare = getBaseBodySprites("GIRL", []);
  assert.notEqual(bare, BASE_BODY_SPRITES.GIRL);
  for (const part of bare) {
    assert.equal(part.fullOutfit, undefined);
    if (!["torso", "upperArmLeft", "upperArmRight", "upperLegLeft", "upperLegRight"].includes(part.region)) {
      assert.equal(part, BASE_BODY_SPRITES.GIRL.find(({ id }) => id === part.id));
    }
  }
  const renderer = read("../src/components/AvatarRenderer.tsx");
  assert.match(renderer, /getBaseBodySprites\(bodyType, clothingSprites\)/);
  assert.match(renderer, /const clothingSprites =[\s\S]*registration-default[\s\S]*getEquippedCharacterSprites\(cosmetics, bottomId/);
});

test("GIRL skin and details share corrected limb frames without changing crops or ground height", () => {
  const { BASE_BODY_SPRITES, getBaseBodySprites } = registry;
  const bare = getBaseBodySprites("GIRL", []);
  for (const side of ["left", "right"]) {
    const skin = bare.find(({ id }) => id === `${side}-arm-0-skin`);
    const detail = bare.find(({ id }) => id === `${side}-arm-3-details`);
    const original = BASE_BODY_SPRITES.GIRL.find(({ id }) => id === skin.id);
    assert.deepEqual(skin.frame, detail.frame);
    assert.equal(skin.frame.crop, original.frame.crop);
    assert.equal(skin.frame.sourceClipPath, original.frame.sourceClipPath);
    assert.equal(skin.frame.destination.y, original.frame.destination.y - 15);
    assert.equal(skin.frame.destination.height, original.frame.destination.height + 15);
    assert.equal(skin.frame.destination.y + skin.frame.destination.height,
      original.frame.destination.y + original.frame.destination.height);
    assert.equal(skin.frame.destination.x, original.frame.destination.x - (side === "left" ? 5 : 0));
    assert.equal(skin.clipPath, undefined, "do not cut actual shoulder skin");
    assert.equal(detail.clipPath, "M0 305H1254V1254H0Z");
    const leg = bare.find(({ id }) => id === `${side}-leg-0-skin`);
    const legDetail = bare.find(({ id }) => id === `${side}-leg-3-details`);
    const oldLeg = BASE_BODY_SPRITES.GIRL.find(({ id }) => id === leg.id);
    assert.deepEqual(leg.frame, legDetail.frame);
    assert.equal(leg.frame.crop, oldLeg.frame.crop);
    assert.equal(leg.frame.sourceClipPath, oldLeg.frame.sourceClipPath);
    assert.equal(leg.frame.destination.y, oldLeg.frame.destination.y);
    assert.equal(leg.frame.destination.height, oldLeg.frame.destination.height);
    assert.equal(leg.frame.destination.width, leg.frame.crop.width * 0.5);
    assert.equal(leg.frame.destination.x, side === "left" ? 661.3 : 435.7);
    assert.equal(leg.frame.shearX, side === "left" ? 0.074 : -0.105);
    assert.equal(leg.clipPath, side === "left" ? "M676 0H1254V1254H0V671H678L676 638Z" : undefined);
    assert.equal(legDetail.clipPath, leg.clipPath, "the shorts seam clips skin and linework together");
  }
  const torso = bare.filter(({ region }) => region === "torso");
  assert.deepEqual(torso[0].frame, torso[1].frame);
  assert.equal(torso[0].frame.destination, BASE_BODY_SPRITES.GIRL.find(({ region }) => region === "torso").frame.destination);
  assert.ok(torso[0].frame.sourceClipPath);
});

test("GIRL upper-eye layers use the crown crop as well as the face crop", () => {
  const { BASE_BODY_SPRITES } = registry;
  for (const section of ["head", "crown"]) {
    const skin = BASE_BODY_SPRITES.GIRL.find(({ id }) => id === `${section}-0-skin`);
    const iris = BASE_BODY_SPRITES.GIRL.find(({ id }) => id === `${section}-1-iris`);
    const eyes = BASE_BODY_SPRITES.GIRL.find(({ id }) => id === `${section}-2-eye-details`);
    assert.equal(iris.frame, skin.frame);
    assert.equal(eyes.frame, skin.frame);
    assert.equal(iris.tint, "eyes");
    assert.equal(eyes.tint, undefined);
    assert.equal(iris.layer, "face");
    assert.equal(eyes.layer, "face");
  }
  const crown = BASE_BODY_SPRITES.GIRL.find(({ id }) => id === "crown-1-iris").frame;
  const head = BASE_BODY_SPRITES.GIRL.find(({ id }) => id === "head-1-iris").frame;
  // Authored eye details start at source Y566, above the face's Y615 boundary.
  assert.ok(crown.crop.y <= 566);
  assert.ok(crown.crop.y + crown.crop.height >= head.crop.y);
  assert.equal(BASE_BODY_SPRITES.BOY.filter(({ tint }) => tint === "eyes").length, 1);
});

test("all dresses retain the original GIRL body and exact finalized dress fit", () => {
  const { BASE_BODY_SPRITES, getBaseBodySprites, getCosmeticAssetIds, getEquippedCharacterSprites } = registry;
  const ids = getCosmeticAssetIds("upperBody").filter(id => id.startsWith("avatar-v2/dresses/"));
  assert.equal(ids.length, 10);
  for (const imageUrl of ids) {
    const sprites = getEquippedCharacterSprites([{ id: "top", type: "TOP", imageUrl }], "top", "TOP");
    assert.equal(getBaseBodySprites("GIRL", sprites), BASE_BODY_SPRITES.GIRL);
    assert.equal(sprites.length, 3);
    for (const [index, part] of sprites.entries()) {
      assert.deepEqual(part.frame.destination, {
        x: 314.775, y: [250, 295, 570][index], width: 624.45, height: [45, 275, 610][index],
      });
    }
  }
});

test("every GIRL tunic keeps clean torso joins and the original garment arm anchors", () => {
  const { BASE_BODY_SPRITES, getBaseBodySprites, getCosmeticAssetIds, getEquippedCharacterSprites } = registry;
  const bare = getBaseBodySprites("GIRL", []);
  const tops = getCosmeticAssetIds("upperBody").filter(id => id.startsWith("avatar-v2/tops/"));
  assert.equal(tops.length, 11);
  for (const imageUrl of tops) {
    const sprites = getEquippedCharacterSprites([{ id: "top", type: "TOP", imageUrl }], "top", "TOP");
    const body = getBaseBodySprites("GIRL", sprites);
    for (const part of body) {
      const original = BASE_BODY_SPRITES.GIRL.find(({ id }) => id === part.id);
      if (["upperArmLeft", "upperArmRight"].includes(part.region)) {
        assert.equal(part.frame, original.frame, `${imageUrl}: no arm repositioning under tunics`);
        assert.equal(part.clipPath, part.tint === "skin" ? undefined : "M0 305H1254V1254H0Z");
      } else {
        assert.equal(part, bare.find(({ id }) => id === part.id));
      }
    }
    assert.ok(body.find(({ region }) => region === "torso").frame.sourceClipPath);
  }
});

test("all GIRL trousers cover legs with or without boots, preserving exposed ankles", () => {
  const { BASE_BODY_SPRITES, getBaseBodySprites, getCosmeticAssetIds, getEquippedCharacterSprites, resolveSpriteSet, DEFAULT_CHARACTER_SPRITES } = registry;
  const bottoms = getCosmeticAssetIds("bottoms");
  const boots = getCosmeticAssetIds("boots");
  assert.equal(bottoms.length, 11);
  assert.equal(boots.length, 11);
  for (const imageUrl of bottoms) {
    const pants = getEquippedCharacterSprites([{ id: "pants", type: "BOTTOM", imageUrl }], "pants", "BOTTOM");
    const expectedClip = imageUrl.endsWith("traveler-trousers") ? "M0 993H1254V1254H0Z" : "M0 1096H1254V1254H0Z";
    for (const boot of [undefined, ...boots]) {
      const shoes = boot ? getEquippedCharacterSprites([{ id: "boots", type: "BOOTS", imageUrl: boot }], "boots", "BOOTS") : [];
      const outfit = [...pants, ...shoes];
      assert.equal(getBaseBodySprites("BOY", outfit), BASE_BODY_SPRITES.BOY);
      const body = getBaseBodySprites("GIRL", outfit);
      const legs = body.filter(({ region }) => ["upperLegLeft", "upperLegRight"].includes(region));
      assert.equal(legs.length, 4);
      for (const leg of legs) assert.equal(leg.clipPath, expectedClip, `${imageUrl} / ${boot ?? "barefoot"}`);
      const bare = getBaseBodySprites("GIRL", []);
      for (const part of body.filter(({ region }) => !region.startsWith("upperLeg"))) {
        assert.equal(part, bare.find(({ id }) => id === part.id), "pants must not affect shoulders/head");
      }
    }
  }
  const registration = getBaseBodySprites("GIRL", resolveSpriteSet("defaults", DEFAULT_CHARACTER_SPRITES));
  assert.equal(registration.find(({ region }) => region === "upperLegLeft").clipPath, "M0 993H1254V1254H0Z");
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
