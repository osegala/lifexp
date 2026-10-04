import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import { PNG } from "pngjs";
import ts from "typescript";

import * as appearance from "../src/avatar/appearance.ts";
import { avatarTintMatrix, grayscaleTintMatrix } from "../src/avatar/colorize.ts";

const originals = [
  ["close-waves", "cadad82945dd866a329321cf28284d1785b086e52862d63de2f32d2c892471f1"],
  ["tapered-coils", "ce343b93c65f3c4f07637023adba5d182aa018cc3f539ce1235eb835f21e6980"],
  ["cornrows", "a6756641f093a0f9c347ff64d2c0e6d089aa2a40981c58d1a6ebdb42b0bae25f"],
  ["loc-updo", "5992c5bb2c77c2fb256f44993169331acb2071313d5133791dd18dd49ae0b39c"],
  ["two-strand-twists", "d95e5e817c2c8c857a50a2ee36f498cd7a6109de1a862b8dcc9f9f8af4eaae48"],
  ["rounded-curls", "d3e218ae9102ebdf2f04c9cc03c9b806ea785b1ba3079268dc4174e9dccba87d"],
  ["box-braids", "012ab2a572002e95a42b4a70643c71026f7aaad535d0e08e9af0c5aea2d59918"],
  ["twin-puffs", "e13be1b48fa0b6cbff698e9b24e9582db6be477fc562299f075bc3a2a458b249"],
  ["bantu-knots", "147552ac3d21f54b9a3a8b9bec6107bd129c154c40fc1e2f93cfbe697f2be9a1"],
  ["half-up-twists", "0f0b8c44a3b7c7929453ef0c465189371a899e419a3ba2c8a99834ebd4e142d8"],
];
const read = relative => readFileSync(new URL(relative, import.meta.url), "utf8");
const require = createRequire(import.meta.url);
function load(relative, require) {
  const exports = {};
  new Function("exports", "require", "__DEV__", ts.transpileModule(read(relative), {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText)(exports, require, false);
  return exports;
}
const registry = load("../src/avatar/assetRegistry.ts", path => path.endsWith(".json")
  ? JSON.parse(read(`../src/avatar/${path}`)) : path);
const apply = (matrix, pixel) => [0, 5, 10, 15].map(offset => pixel.reduce(
  (sum, value, index) => sum + value * matrix[offset + index], matrix[offset + 4],
));

test("new hairstyle PNGs are byte-identical imports with full-canvas RGBA and preserved alpha", () => {
  assert.deepEqual(appearance.HAIR_STYLE_IDS.slice(10), originals.map(([slug]) => `avatar-v2/hair/${slug}`));
  for (const [slug, hash] of originals) {
    const buffer = readFileSync(new URL(`../assets/avatar/v2/hair/${slug}.png`, import.meta.url));
    assert.equal(createHash("sha256").update(buffer).digest("hex"), hash, slug);
    assert.equal(buffer[25], 6, "RGBA PNG, not a flattened background");
    const png = PNG.sync.read(buffer);
    assert.equal(png.width, 1254);
    assert.equal(png.height, 1254);
    assert.ok(png.data.some((value, index) => index % 4 === 3 && value === 0));
    assert.ok(png.data.some((value, index) => index % 4 === 3 && value > 0 && value < 255));
  }
});

test("all 20 built-in styles resolve to assets, with existing hat clipping retained", () => {
  assert.equal(appearance.DEFAULT_APPEARANCE.hairId, "avatar-v2/hair/windblown-layers");
  assert.deepEqual(registry.getCosmeticAssetIds("hair"), [...appearance.HAIR_STYLE_IDS]);
  for (const hairId of appearance.HAIR_STYLE_IDS) {
    const resolved = registry.getEquippedCharacterSprites([], hairId, "HAIR");
    assert.ok(resolved.length > 0, hairId);
    assert.ok(resolved.some(sprite => sprite.layer === "hairFront"));
    for (const sprite of resolved) {
      assert.ok(readFileSync(new URL(`../src/avatar/${sprite.source}`, import.meta.url)).length > 0);
      assert.equal(sprite.tint, sprite.key.endsWith("-details") ? undefined : "hair");
      assert.equal(sprite.fullOutfit, undefined);
      if (sprite.frame) {
        assert.ok(sprite.frame.destination.width > 0 && sprite.frame.destination.height > 0);
        assert.equal(sprite.frame.crop.sourceWidth, 1254);
        assert.equal(sprite.frame.crop.sourceHeight, 1254);
      }
    }
  }
  for (const hat of ["starlight-hat", "frostbound-hat", "celestial-acolyte-hat"]) {
    const parts = registry.getEquippedCharacterSprites([
      { id: hat, type: "HAT", imageUrl: `avatar-v2/hats/${hat}` },
    ], hat, "HAT");
    assert.ok(parts.length > 0);
    assert.equal(Boolean(parts[0].hairClip), hat !== "celestial-acolyte-hat");
  }
});

test("AvatarRenderer includes every hairstyle on both bodies without changing body sprites", () => {
  const imports = {
    "react/jsx-runtime": require("react/jsx-runtime"),
    "react-native": { View: "View", Text: "Text", Image: "Image", StyleSheet: { create: value => value } },
    "../avatar/assetRegistry": registry,
    "../avatar/cosmeticCatalog": load("../src/avatar/cosmeticCatalog.ts", require),
    "../avatar/appearance": appearance,
    "../theme/theme": load("../src/theme/theme.ts", require),
    "./CharacterSpriteLayers": { default: "CharacterSpriteLayers", __esModule: true },
  };
  const Avatar = load("../src/components/AvatarRenderer.tsx", id => {
    assert.ok(id in imports, `Unexpected renderer import: ${id}`);
    return imports[id];
  }).default;
  const nodes = tree => Array.isArray(tree) ? tree.flatMap(nodes)
    : tree?.props ? [tree, ...nodes(tree.props.children)] : [];
  for (const bodyType of ["BOY", "GIRL"]) {
    let baselineBody;
    for (const hairId of appearance.HAIR_STYLE_IDS) {
      const tree = Avatar({ bodyType, hairId, cosmetics: [], hairColorId: "purple" });
      const { sprites, tintColors } = nodes(tree).find(node => node.type === "CharacterSpriteLayers").props;
      const hair = sprites.filter(sprite => sprite.layer.startsWith("hair"));
      assert.deepEqual(hair.map(sprite => sprite.key).sort(),
        registry.getEquippedCharacterSprites([], hairId, "HAIR").map(sprite => sprite.key).sort());
      const body = sprites.filter(sprite => sprite.key.startsWith(`base-body:${bodyType}`));
      assert.ok(body.length > 0, bodyType);
      baselineBody ??= body;
      assert.deepEqual(body, baselineBody, "a hairstyle must not move or clip the body");
      assert.equal(tintColors.hair, appearance.HAIR_COLORS.find(color => color.id === "purple").color);
    }
  }
});

test("close-fitting styles shrink around their hairlines; Box Braids preserves the complete source silhouette", () => {
  const fitting = [
    ["close-waves", 674, 0.196, 0.15],
    ["tapered-coils", 725, 0.18816, 0.15936],
    ["cornrows", 529, 0.2352, 0.17472],
    ["bantu-knots", 518, 0.3, 0.243],
  ];
  for (const [slug, anchorY, sx, sy] of fitting) {
    const parts = registry.getEquippedCharacterSprites([], `avatar-v2/hair/${slug}`, "HAIR");
    for (const { frame } of parts) {
      assert.deepEqual(frame.crop, { x: 0, y: 0, width: 1254, height: 1254, sourceWidth: 1254, sourceHeight: 1254 });
      assert.deepEqual(frame.destination, {
        x: 627 - 628 * sx, y: 110 - anchorY * sy, width: 1254 * sx, height: 1254 * sy,
      });
    }
  }
  const genericFringe = "M0 -64H1254V158H708Q702 168 695 200H559Q552 168 546 158H0Z";
  for (const hairId of appearance.HAIR_STYLE_IDS.slice(10)) {
    const parts = registry.getEquippedCharacterSprites([], hairId, "HAIR");
    const front = parts.find(part => part.layer === "hairFront");
    const drape = parts.find(part => part.layer === "hairDrape");
    if (hairId.endsWith("/box-braids")) {
      assert.equal(parts.length, 1, "do not double-composite or hide braids behind the face");
      assert.equal(front.clipPath, undefined, "no custom fringe boundary may cut the authored strands");
      assert.equal(front.frame.sourceClipPath, undefined);
      assert.deepEqual(front.frame.crop, { x: 0, y: 0, width: 1254, height: 1254, sourceWidth: 1254, sourceHeight: 1254 });
      assert.deepEqual(front.frame.destination, { x: 375.8, y: -2.4, width: 501.6, height: 501.6 });
      assert.equal(front.frame.destination.width / front.frame.crop.width,
        front.frame.destination.height / front.frame.crop.height, "never stretch Box Braids wider than it is tall");
    } else {
      assert.equal(drape.clipPath, undefined, "long hanging hair remains intact behind the head");
      assert.equal(front.clipPath, genericFringe, hairId);
    }
  }
});

test("Long Shag and High Ponytail lift all pieces eight units without resizing or recropping", () => {
  for (const [slug, x, y, width, height, ax, ay, sx, sy, oldTargetY] of [
    ["high-ponytail", 194, 42, 953, 1171, 577, 680, 0.33, 0.285, 187],
    ["long-shag", 175, 61, 901, 1111, 630, 700, 0.30, 0.255, 188],
  ]) {
    const parts = registry.getEquippedCharacterSprites([], `avatar-v2/hair/${slug}`, "HAIR");
    assert.equal(parts.length, slug === "high-ponytail" ? 3 : 2);
    for (const { frame } of parts) {
      assert.deepEqual(frame.crop, { x, y, width, height, sourceWidth: 1254, sourceHeight: 1254 });
      assert.deepEqual(frame.destination, {
        x: 627 + (x - ax) * sx, y: oldTargetY - 8 + (y - ay) * sy,
        width: width * sx, height: height * sy,
      });
    }
    if (slug === "high-ponytail") assert.equal(parts.find(part => part.hairPart === "ponytail").layer, "hairBack");
  }
});

test("hair neutralization preserves existing grayscale output, eye output, contrast, and alpha for every swatch", () => {
  for (const { color } of appearance.HAIR_COLORS) {
    const matrix = avatarTintMatrix("hair", color), old = grayscaleTintMatrix(color);
    assert.deepEqual(matrix.slice(15), [0, 0, 0, 1, 0]);
    for (let gray = 0; gray <= 255; gray++) {
      const pixel = [gray / 255, gray / 255, gray / 255, gray / 255];
      apply(matrix, pixel).forEach((value, index) => assert.ok(Math.abs(value - apply(old, pixel)[index]) < 1e-12));
    }
    const shadow = apply(matrix, [0.1, 0.07, 0.04, 0.25]);
    const highlight = apply(matrix, [0.8, 0.6, 0.4, 0.75]);
    assert.equal(shadow[3], 0.25);
    assert.equal(highlight[3], 0.75);
    highlight.slice(0, 3).forEach((value, index) => assert.ok(value > shadow[index]));
    // White is the upper bound: black hair cannot acquire washed-out white highlights.
    assert.deepEqual(apply(matrix, [1, 1, 1, 1]).map(v => Math.round(v * 255)),
      apply(old, [1, 1, 1, 1]).map(v => Math.round(v * 255)));
  }
  for (const { color } of appearance.EYE_COLORS) assert.deepEqual(avatarTintMatrix("eyes", color), grayscaleTintMatrix(color));
});

test("new IDs survive per-user cache reload, logout/cache-clear, and server login normalization", async () => {
  const store = new Map();
  const storage = {
    getItemAsync: async key => store.get(key) ?? null,
    setItemAsync: async (key, value) => { store.set(key, value); },
    deleteItemAsync: async key => { store.delete(key); },
  };
  const reload = () => load("../src/avatar/localAppearance.ts", id => ({
    "expo-secure-store": storage, "react-native": { Platform: { OS: "ios" } }, "./appearance": appearance,
  })[id]);
  for (const hairId of appearance.HAIR_STYLE_IDS) {
    const saved = { ...appearance.DEFAULT_APPEARANCE, bodyType: "GIRL", hairId };
    await reload().setLocalAppearance("alice", saved);
    assert.deepEqual(await reload().getLocalAppearance("alice"), saved);
    assert.deepEqual(await reload().getLocalAppearance("bob"), appearance.DEFAULT_APPEARANCE);
    await reload().clearLocalAppearance("alice");
    const restored = await appearance.loadPreferredAppearance(async () => saved,
      () => reload().getLocalAppearance("alice"), value => reload().setLocalAppearance("alice", value));
    assert.deepEqual(restored, saved);
    assert.deepEqual(await reload().getLocalAppearance("alice"), saved);
  }
});
