import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";
import * as appearance from "../src/avatar/appearance.ts";
import * as inventory from "../src/avatar/inventory.ts";
import * as theme from "../src/theme/theme.ts";
import { apiError } from "../src/api/errors.ts";
import { apiRoutes } from "../src/api/routes.ts";

const require = createRequire(import.meta.url);
function load(path, imports, dev = false) {
  const exports = {};
  const code = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), { compilerOptions: {
    jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, esModuleInterop: true,
  } }).outputText;
  new Function("require", "exports", "__DEV__", code)(id => {
    if (id === "react/jsx-runtime") return require(id);
    assert.ok(id in imports, `Unexpected import: ${id}`); return imports[id];
  }, exports, dev);
  return Object.assign(exports.default ?? {}, exports);
}
function hooks() {
  let index = 0; const state = [];
  const react = { useState(initial) {
    const i = index++; if (!(i in state)) state[i] = typeof initial === "function" ? initial() : initial;
    return [state[i], value => { state[i] = typeof value === "function" ? value(state[i]) : value; }];
  }, useCallback: fn => fn, useMemo: fn => fn(), memo: fn => fn };
  return { react, render(fn) { index = 0; return fn(); } };
}
const native = { ...Object.fromEntries(["View", "FlatList", "Image", "Modal", "ScrollView", "ActivityIndicator", "Text", "Pressable"].map(n => [n, n])),
  StyleSheet: { create: value => value, absoluteFill: { position: "absolute" } }, Platform: { select: options => options.default } };
const primitives = { ...Object.fromEntries(["UiText", "UiPressable", "SurfaceCard", "EmptyState", "FilterChip", "SectionHeader"].map(n => [n, n])) };
const nodes = tree => Array.isArray(tree) ? tree.flatMap(nodes) : tree?.props ? [tree, ...nodes(tree.props.children)] : [];
const text = tree => Array.isArray(tree) ? tree.map(text).join("") : tree?.props ? text(tree.props.children)
  : typeof tree === "string" || typeof tree === "number" ? String(tree) : "";
const find = (tree, type) => nodes(tree).filter(n => n.type === type);
const tick = () => new Promise(setImmediate);
const profile = { ...appearance.DEFAULT_APPEARANCE, bodyType: "GIRL", skinColorId: "skin_08" };
const gear = (id, category, assetKey, equipped = false) => ({ itemId: id, name: id, category, assetKey, equipped });
const owned = [gear("garden", "background", "avatar-v2/backgrounds/castle-garden", true),
  gear("library", "background", "avatar-v2/backgrounds/grand-library"), gear("top", "tunic", "forest-tunic.png", true),
  gear("pet", "pet", "avatar-v2/pets/moss-golem", true), gear("aura", "aura", "avatar-v2/auras/golden-swirl", true)];
const shop = { player: { coins: 42, level: 6 }, items: [...owned.map(item => ({ ...item, effectiveRequiredLevel: 1, owned: true, status: "OWNED", requiresPremium: item.itemId === "library" })),
  { ...gear("locked", "hat", "avatar-v2/hats/forest-ranger-hat"), effectiveRequiredLevel: 9, owned: false, status: "LOCKED" }] };
const equipped = { background: "garden", tunic: "top", pet: "pet", aura: "aura", pants: null, boots: null, hair: null, hat: null };
const model = { items: owned, equipped };
const cosmetics = inventory.wardrobeCosmetics(shop, model, appearance.HAIR_STYLE_IDS, profile.hairId, () => null);
const avatar = inventory.avatarFromInventory(model, profile);

function content() {
  let dimensions = { width: 390 };
  const mod = load("../src/components/AvatarContent.tsx", { react: { useMemo: fn => fn() },
    "react-native": { ...native, useWindowDimensions: () => dimensions }, "@expo/vector-icons/MaterialCommunityIcons": "Icon",
    "../theme/theme": theme, "../avatar/assetRegistry": { getEquippedSceneSource: (_, id) => id ? { uri: `${id}.png` } : undefined },
    "./AvatarRenderer": "Avatar", "./AppearanceEditor": "Editor", "./WardrobeCard": "WardrobeCard", "./LifeButton": "Button",
    "./ui/Indicators": { BadgePill: "Badge" }, "./ui/Primitives": primitives });
  const defaults = { avatar, cosmetics, username: "Rowan", level: 6, selectedType: "HAIR", loading: false, loadingId: null,
    loadError: "", equipmentError: "", premiumItemIds: ["library"], previewAllCosmetics: false, canPreview: false,
    editingAppearance: false, confirmDiscardAppearance: false, draftAppearance: profile, appearanceDirty: false,
    savingAppearance: false, appearanceSaveError: "", onType() {}, onEquip() {}, onRetry() {}, onEditAppearance() {},
    onCloseAppearance() {}, onKeepEditing() {}, onDiscardAppearance() {}, onChangeAppearance() {}, onSaveAppearance() {}, onTogglePreview() {} };
  return { sections: mod.WARDROBE_SECTIONS, defaults, dimensions: value => { dimensions = value; }, render(patch) {
    const tree = mod.default({ ...defaults, ...patch }); const list = find(tree, "FlatList")[0];
    return { tree, list, header: list.props.ListHeaderComponent, all: [tree, list.props.ListHeaderComponent] };
  } };
}

test("Avatar preserves all eight sections, order, Hair default and exact type filtering", () => {
  const c = content(), selected = [];
  assert.deepEqual(c.sections.map(s => s.title), ["Hair", "Hats", "Tops & Dresses", "Bottoms", "Boots", "Scenes", "Pets", "Auras"]);
  for (const section of c.sections) {
    const ui = c.render({ selectedType: section.type, onType: value => selected.push(value) });
    assert.deepEqual(ui.list.props.data, cosmetics.filter(item => item.type === section.type));
    const chips = find(ui.header, "FilterChip");
    assert.equal(chips.filter(n => n.props.selected).length, 1);
    chips[c.sections.indexOf(section)].props.onPress();
  }
  assert.deepEqual(selected, c.sections.map(s => s.type));
  assert.equal(c.render().list.props.data.length, 20);
});

test("exact renderer props, scene source and preview bounds survive loading/errors; only one composition mounts", () => {
  const c = content(), normal = c.render();
  const renderer = find(normal.all, "Avatar")[0];
  assert.equal(find(normal.all, "Avatar").length, 1); assert.equal(renderer.props.cosmetics, cosmetics);
  assert.deepEqual(renderer.props, { showBackground: false, hairId: avatar.equippedHairId, hatId: avatar.equippedHatId,
    topId: avatar.equippedTopId, bottomId: avatar.equippedBottomId, bootsId: avatar.equippedBootsId,
    backgroundId: "garden", petId: "pet", auraId: "aura", bodyType: "GIRL", skinColorId: "skin_08", hairColorId: profile.hairColorId,
    eyeColorId: profile.eyeColorId, cosmetics });
  const background = find(normal.header, "Image")[0];
  assert.equal(background.props.source.uri, "garden.png"); assert.equal(background.props.resizeMode, "stretch");
  const stage = nodes(normal.header).find(n => Array.isArray(n.props.style) && n.props.style[0]?.height === 440).props.style[0];
  assert.equal(stage.width, 330); assert.equal(stage.maxWidth, "100%"); assert.equal(stage.overflow, "hidden");
  assert.equal(stage.alignItems, "center"); assert.equal(stage.justifyContent, "center");
  assert.deepEqual(find(c.render({ loading: true, loadError: "Offline" }).all, "Avatar")[0].props, renderer.props);
  assert.equal(find(c.render({ editingAppearance: true }).all, "Avatar").length, 1);
  assert.equal(find(c.render({ editingAppearance: true, confirmDiscardAppearance: true }).all, "Avatar").length, 0);
  assert.equal(find(c.render({ avatar: null, draftAppearance: null, loading: true }).all, "Avatar").length, 0);
  assert.equal(find(c.render({ avatar: { ...avatar, equippedBackgroundId: "library" } }).header, "Image")[0].props.source.uri, "library.png");
});

test("wardrobe uses the recovered two-row limits/window with no clipping of the SVG header or eager card map", () => {
  const c = content();
  for (const width of [320, 390, 768, 1024]) {
    c.dimensions({ width }); const { list } = c.render({ loadingId: "library" });
    assert.equal(list.props.initialNumToRender, 2); assert.equal(list.props.maxToRenderPerBatch, 2); assert.equal(list.props.windowSize, 3);
    assert.equal(list.props.removeClippedSubviews, false); assert.equal(list.props.extraData, "library");
    assert.equal(list.props.keyExtractor({ id: 17 }), "17");
    assert.equal(find(list, "WardrobeCard").length, 0);
    const card = list.props.renderItem({ item: cosmetics.find(item => item.id === "library") });
    assert.equal(card.props.premiumOnly, true); assert.equal(card.props.loading, true); assert.equal(card.props.onEquip, c.defaults.onEquip);
  }
});

test("wardrobe actions expose equipped/locked/pending states without changing ownership gates or preview caching", () => {
  let memo = false;
  const Card = load("../src/components/WardrobeCard.tsx", { react: { memo: fn => { memo = true; return fn; } }, "react-native": native,
    "@expo/vector-icons/MaterialCommunityIcons": "Icon", "../theme/theme": theme,
    "../avatar/assetRegistry": { getCosmeticPreviewSource: item => item.imageUrl, getCosmeticPreviewCrop: () => undefined },
    "./CosmeticImage": "Image", "./ui/Indicators": { BadgePill: "Badge" }, "./ui/Primitives": primitives });
  let selected; const render = (cosmetic, patch = {}) => Card({ cosmetic, width: 163, loading: false, previewMode: false, premiumOnly: true,
    onEquip: value => { selected = value; }, ...patch });
  assert.equal(memo, true);
  const owned = cosmetics.find(item => item.id === "garden"), locked = cosmetics.find(item => item.id === "locked");
  const tree = render(owned), action = find(tree, "UiPressable")[0];
  assert.equal(action.props.accessibilityLabel, "Unequip: garden"); assert.equal(action.props["aria-pressed"], true);
  action.props.onPress(); assert.equal(selected, owned);
  assert.equal(find(tree, "Image")[0].props.cached, undefined);
  const restricted = find(render(locked), "UiPressable")[0]; assert.equal(restricted.props.disabled, true); assert.equal(restricted.props.accessibilityLabel, "Locked: locked");
  assert.equal(find(render(locked, { previewMode: true }), "UiPressable")[0].props.disabled, false);
  assert.equal(find(render(owned, { loading: true }), "UiPressable")[0].props.accessibilityState.busy, true);
  assert.equal(find(render(cosmetics[0]), "UiPressable")[0].props.accessibilityLabel.startsWith("Selected:"), true);
});

test("appearance styling is opt-in; all palettes, labels and selected radio IDs remain unchanged", () => {
  const Editor = load("../src/components/AppearanceEditor.tsx", { "react-native": native, "../avatar/appearance": appearance,
    "../theme/theme": theme, "./LifeCard": "Card", "./ui/Primitives": { UiPressable: "Pressable" } });
  const changes = [];
  const legacy = Editor({ appearance: profile, dirty: false, saving: false, onChange() {}, onSave() {} });
  const styled = Editor({ tone: "parchment", appearance: profile, dirty: true, saving: false, onChange: patch => changes.push(patch), onSave() {} });
  assert.equal(legacy.props.tone, "legacy"); assert.equal(styled.props.tone, "parchment");
  for (const [label, palette, key] of [["Skin tone", appearance.SKIN_COLORS, "skinColorId"], ["Hair color", appearance.HAIR_COLORS, "hairColorId"], ["Eye color", appearance.EYE_COLORS, "eyeColorId"]]) {
    const component = nodes(styled).find(n => n.props.label === label), group = component.type(component.props);
    const radios = nodes(group).filter(n => n.props.accessibilityRole === "radio");
    assert.equal(radios.length, palette.length);
    for (const [index, radio] of radios.entries()) {
      assert.equal(radio.props.accessibilityLabel, `${label}: ${palette[index].name}`);
      assert.equal(radio.props["aria-checked"], palette[index].id === profile[key]);
      assert.ok(radio.props.style({ pressed: false })[0].width >= 44);
      radio.props.onPress(); assert.deepEqual(changes.at(-1), { [key]: palette[index].id });
    }
  }
  const save = nodes(styled).find(n => n.props.accessibilityLabel === "Save appearance"); assert.equal(save.props.disabled, false);
});

async function controller({ dev = false, failPost = false, failRead = false } = {}) {
  const h = hooks(), calls = []; let focus;
  let state = { items: owned.map(item => ({ ...item })), equipped: { ...equipped } };
  let blockedRead = failRead;
  const Component = load("../app/(tabs)/avatar.tsx", { react: h.react, "react-native": { Alert: { alert() {} } },
    "expo-router": { useFocusEffect: fn => { focus = fn; } }, "../../src/api/client": { apiError, api: {
      get: async route => { calls.push(["GET", route]); if (blockedRead && route === apiRoutes.inventory) throw new Error("offline"); return { data: route === apiRoutes.shop ? shop : route === apiRoutes.me ? profile : state }; },
      post: async (route, body) => { calls.push(["POST", route, body]); if (failPost) throw new Error("offline");
        state = { ...state, equipped: { ...state.equipped, background: route === apiRoutes.inventoryUnequip ? null : body.itemId },
          items: state.items.map(item => item.category === "background" ? { ...item, equipped: route !== apiRoutes.inventoryUnequip && item.itemId === body.itemId } : item) };
      }, patch: async (route, body) => { calls.push(["PATCH", route, body]); return { data: body }; },
    } }, "../../src/api/routes": { apiRoutes }, "../../src/avatar/inventory": inventory,
    "../../src/avatar/appearance": appearance, "../../src/avatar/localAppearance": { getLocalAppearance: async () => profile, setLocalAppearance: async () => {} },
    "../../src/avatar/assetRegistry": { getCosmeticAssetIds: () => appearance.HAIR_STYLE_IDS, getCosmeticAssetMetadata: () => ({ fullOutfit: false }) },
    "../../src/components/AvatarContent": "Content", "../../src/context/AuthContext": { useAuth: () => ({ user: { id: "local", username: "Rowan", level: 6 } }) },
    "../../src/config/environment": { environment: { environment: "dev" } },
  }, dev);
  const render = () => h.render(Component);
  render(); focus(); await tick();
  return { render, calls, state: () => state, failRead: value => { blockedRead = value; } };
}

test("owned background equip/unequip keeps exact API payloads and propagates the same authoritative scene to Home", async () => {
  const ui = await controller(); const library = ui.render().props.cosmetics.find(item => item.id === "library");
  await ui.render().props.onEquip(library);
  assert.deepEqual(ui.calls.find(([method]) => method === "POST"), ["POST", apiRoutes.inventoryEquip, { itemId: "library" }]);
  assert.equal(ui.render().props.avatar.equippedBackgroundId, "library");
  const home = load("../src/home/avatar.ts", { "../avatar/inventory": inventory });
  assert.equal(home.homeAvatarFromInventory(ui.state(), profile).avatar.equippedBackgroundId, "library");
  await ui.render().props.onEquip(ui.render().props.cosmetics.find(item => item.id === "library"));
  assert.deepEqual(ui.calls.filter(([method]) => method === "POST")[1], ["POST", apiRoutes.inventoryUnequip, { itemId: "library" }]);
  assert.equal(ui.render().props.avatar.equippedBackgroundId, null);
  assert.equal(ui.calls.some(([method]) => method === "PATCH"), false, "background equipment never becomes an appearance save");
});

test("locked items cannot equip; failures preserve the confirmed scene; DEV preview is isolated and exit reloads it", async () => {
  const ui = await controller({ failPost: true });
  await ui.render().props.onEquip(ui.render().props.cosmetics.find(item => item.id === "locked"));
  assert.equal(ui.calls.some(([method]) => method === "POST"), false);
  await ui.render().props.onEquip(ui.render().props.cosmetics.find(item => item.id === "library"));
  assert.equal(ui.render().props.avatar.equippedBackgroundId, "garden"); assert.match(ui.render().props.equipmentError, /Could not update/);
  const preview = await controller({ dev: true }); preview.render().props.onTogglePreview();
  await preview.render().props.onEquip(preview.render().props.cosmetics.find(item => item.id === "library"));
  assert.equal(preview.render().props.avatar.equippedBackgroundId, "library"); assert.equal(preview.calls.some(([method]) => method === "POST"), false);
  preview.render().props.onTogglePreview(); await tick(); assert.equal(preview.render().props.avatar.equippedBackgroundId, "garden");
});

test("initial and refresh failures expose retry without manufacturing or replacing confirmed avatar state", async () => {
  const ui = await controller({ failRead: true }); assert.equal(ui.render().props.avatar, null); assert.match(ui.render().props.loadError, /Could not load/);
  ui.failRead(false); ui.render().props.onRetry(); await tick();
  const previous = ui.render().props.avatar; assert.equal(previous.equippedBackgroundId, "garden");
  ui.failRead(true); ui.render().props.onRetry(); await tick(); assert.equal(ui.render().props.avatar, previous);
  assert.equal(ui.render().props.loading, false); assert.match(ui.render().props.loadError, /Could not load/);
});
