import { noticeJsxRuntime, noticeImport } from "./notice-test-support.mjs";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";
import * as tray from "../src/avatar/tray.ts";
import * as appearance from "../src/avatar/appearance.ts";
import * as inventory from "../src/avatar/inventory.ts";
import * as theme from "../src/theme/theme.ts";
import { apiError } from "../src/api/errors.ts";
import { apiRoutes } from "../src/api/routes.ts";

import { memoryCache, deferred, profile as cacheProfile } from "./cache-test-support.mjs";
import { SupersededCacheRead } from "../src/cache/PlayerCache.ts";

const require = createRequire(import.meta.url);
function load(path, imports, dev = false) {
  const exports = {};
  const code = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), { compilerOptions: {
    jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, esModuleInterop: true,
  } }).outputText;
  new Function("require", "exports", "__DEV__", code)(id => {
    if (id === "react/jsx-runtime") return noticeJsxRuntime;
    const notice = noticeImport(id, imports); if (notice !== undefined) return notice;
    if (id === "./ui/FantasyMaterial") return "FantasyMaterial";
    if (id === "./ui/PaperTexture") return "PaperTexture";
    assert.ok(id in imports, `Unexpected import: ${id}`); return imports[id];
  }, exports, dev);
  return Object.assign(exports.default ?? {}, exports);
}
function hooks() {
  let index = 0; const state = [];
  const react = { useState(initial) {
    const i = index++; if (!(i in state)) state[i] = typeof initial === "function" ? initial() : initial;
    return [state[i], value => { state[i] = typeof value === "function" ? value(state[i]) : value; }];
  }, useRef: initial => react.useState(() => ({ current: initial }))[0], useEffect() {}, useCallback: fn => fn, useMemo: fn => fn(), memo: fn => fn };
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
const profile = { ...cacheProfile, ...appearance.DEFAULT_APPEARANCE, bodyType: "GIRL", skinColorId: "skin_08" };
const gear = (id, category, assetKey, equipped = false) => ({ itemId: id, name: id, category, assetKey, equipped });
const owned = [gear("garden", "background", "avatar-v2/backgrounds/castle-garden", true),
  gear("library", "background", "avatar-v2/backgrounds/grand-library"), gear("top", "tunic", "forest-tunic.png", true),
  gear("pet", "pet", "avatar-v2/pets/moss-golem", true), gear("aura", "aura", "avatar-v2/auras/golden-swirl", true)];
const shop = { player: { coins: 42, level: 6 }, items: [...owned.map(item => ({ ...item, effectiveRequiredLevel: 1, effectivePrice: 0, canPurchase: false, owned: true, status: "OWNED", requiresPremium: item.itemId === "library" })),
  { ...gear("locked", "hat", "avatar-v2/hats/forest-ranger-hat"), effectiveRequiredLevel: 9, effectivePrice: 100, canPurchase: false, owned: false, status: "LOCKED" }] };
const equipped = { background: "garden", tunic: "top", pet: "pet", aura: "aura", pants: null, boots: null, hair: null, hat: null };
const model = { items: owned, equipped };
const cosmetics = inventory.wardrobeCosmetics(shop, model, appearance.HAIR_STYLE_IDS, profile.hairId, () => null);
const avatar = inventory.avatarFromInventory(model, profile);

function content() {
  let dimensions = { width: 390, height: 844, fontScale: 1 };
  const mod = load("../src/components/AvatarContent.tsx", { react: { useMemo: fn => fn(), useState: value => [value, () => {}], useEffect() {}, useRef: current => ({ current }) },
    "react-native-safe-area-context": { useSafeAreaInsets: () => ({ top: 20, bottom: 0 }) },
    "../avatar/prefetch": { prefetchWardrobeThumbnails: async () => {} }, "../avatar/tray": tray, "./ui/ExpandableTray": "Tray", "./ui/PageBackground": "Background",
    "react-native": { ...native, useWindowDimensions: () => dimensions }, "@expo/vector-icons/MaterialCommunityIcons": "Icon",
    "../theme/theme": theme, "../avatar/assetRegistry": { getEquippedSceneSource: (_, id) => id ? { uri: `${id}.png` } : undefined },
    "./AvatarRenderer": "Avatar", "./AppearanceEditor": "Editor", "./WardrobeCard": "WardrobeCard", "./LifeButton": "Button",
    "./ui/Indicators": { BadgePill: "Badge" }, "./ui/Primitives": primitives });
  const defaults = { avatar, cosmetics, username: "Rowan", level: 6, selectedType: "HAIR", loading: false, loadingId: null,
    loadError: "", equipmentError: "", premiumItemIds: ["library"], previewAllCosmetics: false, canPreview: false,
    editingAppearance: false, confirmDiscardAppearance: false, draftAppearance: profile, appearanceDirty: false,
    savingAppearance: false, appearanceSaveError: "", onType() {}, onEquip() {}, onRetry() {}, onEditAppearance() {},
    onCloseAppearance() {}, onKeepEditing() {}, onDiscardAppearance() {}, onChangeAppearance() {}, onSaveAppearance() {}, onTogglePreview() {} };
  return { sections: mod.WARDROBE_SECTIONS, defaults, dimensions: value => { dimensions = { ...dimensions, ...value }; }, render(patch) {
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
    const chips = find(ui.tree, "FilterChip");
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
  const background = find(normal.tree, "Image")[0];
  assert.equal(background.props.source.uri, "garden.png"); assert.equal(background.props.resizeMode, "cover");
  const stage = nodes(normal.tree).find(n => n.props.testID === "avatar-scene");
  const stageStyle = Object.assign({}, ...stage.props.style);
  assert.equal(stageStyle.position, "absolute"); assert.equal(stageStyle.overflow, "hidden");
  assert.equal(stageStyle.alignItems, "center"); assert.equal(stageStyle.justifyContent, "center");
  assert.equal(find(normal.list.props.ListHeaderComponent, "Avatar").length, 0, "character remains outside scrolling wardrobe");
  const trayNode = find(normal.tree, "Tray")[0];
  assert.equal(trayNode.props.index, 1); assert.equal(trayNode.props.stops.length, 3);
  assert.deepEqual(find(c.render({ loading: true, loadError: "Offline" }).all, "Avatar")[0].props, renderer.props);
  assert.equal(find(c.render({ editingAppearance: true }).all, "Avatar").length, 1);
  assert.equal(find(c.render({ editingAppearance: true, confirmDiscardAppearance: true }).all, "Avatar").length, 0);
  assert.equal(find(c.render({ avatar: null, draftAppearance: null, loading: true }).all, "Avatar").length, 0);
  assert.equal(find(c.render({ avatar: { ...avatar, equippedBackgroundId: "library" } }).tree, "Image")[0].props.source.uri, "library.png");
  const noBackground = c.render({ avatar: { ...avatar, equippedBackgroundId: null } });
  assert.equal(find(noBackground.tree, "Image")[0].props.source, "local-castle-garden.png");
  assert.equal(find(noBackground.tree, "Avatar")[0].props.backgroundId, null);
});

test("wardrobe uses the recovered two-row limits/window with no clipping of the SVG header or eager card map", () => {
  const c = content();
  for (const width of [320, 390, 430, 768, 1024]) {
    c.dimensions({ width }); const { list } = c.render({ loadingId: "library" });
    if (width === 390 || width === 430) assert.equal(list.props.numColumns, 4);
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
  assert.equal(find(tree, "Image")[0].props.cached, true);
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

async function controller({ dev = false, failPost = false, failRead = false, cache = memoryCache().cache, get, autoFocus = true, patch, premium = false, post } = {}) {
  const h = hooks(), calls = []; let focus;
  let state = { items: owned.map(item => ({ ...item })), equipped: { ...equipped } };
  let blockedRead = failRead;
  const Component = load("../app/(tabs)/avatar.tsx", { react: h.react, "react-native": { Alert: { alert() {} } },
    "expo-router": { useFocusEffect: fn => { focus = fn; } }, "../../src/api/client": { apiError, api: {
      get: async route => { calls.push(["GET", route]); if (get) return { data: await get(route) }; if (blockedRead && route === apiRoutes.inventory) throw new Error("offline"); return { data: route === apiRoutes.shop ? shop : route === apiRoutes.me ? profile : state }; },
      post: async (route, body) => { calls.push(["POST", route, body]); if (failPost) throw new Error("offline"); if (post) return post(route, body);
        state = { ...state, equipped: { ...state.equipped, background: route === apiRoutes.inventoryUnequip ? null : body.itemId },
          items: state.items.map(item => item.category === "background" ? { ...item, equipped: route !== apiRoutes.inventoryUnequip && item.itemId === body.itemId } : item) };
      }, patch: async (route, body) => { calls.push(["PATCH", route, body]); return { data: patch ? await patch(body) : body }; },
    } }, "../../src/cache/playerData": { playerCache: cache }, "../../src/cache/PlayerCache": { SupersededCacheRead },
    "../../src/avatar/prefetch": { prefetchAvatarAssets: async () => {} }, "../../src/api/routes": { apiRoutes }, "../../src/avatar/inventory": inventory,
    "../../src/avatar/appearance": appearance, "../../src/avatar/localAppearance": { getLocalAppearance: async () => profile, setLocalAppearance: async () => {} },
    "../../src/avatar/assetRegistry": { getCosmeticAssetIds: () => appearance.HAIR_STYLE_IDS, getCosmeticAssetMetadata: () => ({ fullOutfit: false }) },
    "../../src/components/AvatarContent": "Content", "../../src/context/AuthContext": { useAuth: () => ({ user: { id: "local", username: "Rowan", level: 6 } }) },
    "../../src/entitlements/useEntitlements": { useEntitlements: () => ({ loading: false, premium }) }, "../../src/config/environment": { environment: { environment: "dev" } },
  }, dev);
  const render = () => h.render(Component);
  render(); if (autoFocus) { focus(); await tick(); }
  return { render, calls, focus: () => focus(), state: () => state, failRead: value => { blockedRead = value; } };
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

test("Avatar renders cached equipment and wardrobe immediately on remount and preserves them throughout revalidation", async () => {
  const { cache } = memoryCache(); cache.set("local", "profile", profile); cache.set("local", "inventory", model); cache.set("local", "shop", shop);
  const wait = deferred();
  const ui = await controller({ cache, autoFocus: false, get: route => wait.promise.then(() => route === apiRoutes.me ? profile : route === apiRoutes.shop ? shop : model) });
  const initial = ui.render().props;
  assert.equal(initial.loading, false); assert.equal(initial.avatar.equippedBackgroundId, "garden"); assert.ok(initial.cosmetics.length > 0);
  ui.focus(); await tick();
  assert.equal(ui.render().props.refreshing, true); assert.equal(ui.render().props.loading, false);
  assert.equal(ui.render().props.avatar.equippedTopId, "top"); assert.ok(ui.render().props.cosmetics.length > 0);
  wait.resolve(); await tick();
  assert.equal(ui.render().props.refreshing, false); assert.equal(ui.render().props.avatar.equippedBackgroundId, "garden");
});

test("Avatar hydrates disk before a slow backend, and a failed refresh never removes the equipped avatar or owned looks", async () => {
  const original = memoryCache(); original.cache.set("local", "profile", profile); original.cache.set("local", "inventory", model); original.cache.set("local", "shop", shop); await tick();
  const { cache } = memoryCache("test", original.values); const wait = deferred();
  const ui = await controller({ cache, autoFocus: false, get: () => wait.promise });
  assert.equal(ui.render().props.loading, true); assert.equal(ui.render().props.avatar, null);
  ui.focus(); await tick(); const shown = ui.render().props;
  assert.equal(shown.loading, false); assert.equal(shown.avatar.equippedBackgroundId, "garden"); assert.ok(shown.cosmetics.length > 0);
  wait.reject(new Error("offline")); await tick();
  assert.equal(ui.render().props.avatar, shown.avatar); assert.equal(ui.render().props.cosmetics, shown.cosmetics);
  assert.equal(ui.render().props.refreshing, false); assert.match(ui.render().props.loadError, /Could not load/);
});

test("an evicted Shop cache still permits rendering the server-owned inventory with saved appearance", async () => {
  const { cache } = memoryCache(); cache.set("local", "profile", profile); cache.set("local", "inventory", model);
  const ui = await controller({ cache, autoFocus: false }); const props = ui.render().props;
  assert.equal(props.loading, false); assert.equal(props.avatar.equippedBackgroundId, "garden");
  assert.ok(props.cosmetics.find(item => item.id === "garden" && item.owned && item.equipped));
  assert.equal(props.cosmetics.some(item => item.id === "locked"), false, "no synthetic unlocks or ownership");
});

test("cold wardrobe loading hides the misleading zero count; cached refresh retains count and character", () => {
  const c = content(); const cold = c.render({ avatar: null, cosmetics: [], loading: true });
  assert.equal(find(cold.header, "SectionHeader")[0].props.trailing, undefined); assert.equal(find(cold.tree, "Avatar").length, 0);
  const warm = c.render({ refreshing: true });
  assert.match(text(find(warm.header, "SectionHeader")[0].props.trailing), /looks/); assert.equal(find(warm.tree, "Avatar").length, 1);
  assert.equal(warm.list.props.data.length, appearance.HAIR_STYLE_IDS.length);
});

test("appearance drafts and DEV equipment previews never become persisted server cache", async () => {
  const { cache } = memoryCache(); const ui = await controller({ cache, dev: true });
  ui.render().props.onChangeAppearance({ hairId: appearance.HAIR_STYLE_IDS[1] });
  assert.equal(cache.peek("local", "profile").hairId, profile.hairId);
  ui.render().props.onTogglePreview(); await ui.render().props.onEquip(ui.render().props.cosmetics.find(item => item.id === "library"));
  assert.equal(ui.render().props.avatar.equippedBackgroundId, "library");
  assert.equal(cache.peek("local", "inventory").equipped.background, "garden");
});

test("confirmed appearance saves update the cache, but a response after account clear cannot repopulate it", async () => {
  const { cache } = memoryCache(); const saved = deferred();
  const ui = await controller({ cache, patch: body => saved.promise.then(() => body) });
  ui.render().props.onChangeAppearance({ bodyType: "BOY" }); const saving = ui.render().props.onSaveAppearance();
  saved.resolve(); await saving; await tick(); assert.equal(cache.peek("local", "profile").bodyType, "BOY");
  const late = deferred(); const other = await controller({ cache, patch: body => late.promise.then(() => body) });
  other.render().props.onChangeAppearance({ bodyType: "BOY" }); other.render().props.onSaveAppearance();
  await cache.clearUser("local"); late.resolve(); await tick(); assert.equal(cache.peek("local", "profile"), null);
});

test("a slow Shop request cannot hold the equipped avatar behind full loading once Inventory/Profile are usable", async () => {
  const { cache } = memoryCache(); const catalog = deferred();
  const ui = await controller({ cache, get: route => route === apiRoutes.shop ? catalog.promise : Promise.resolve(route === apiRoutes.me ? profile : model) });
  assert.equal(ui.render().props.loading, false); assert.equal(ui.render().props.refreshing, true);
  assert.equal(ui.render().props.avatar.equippedBackgroundId, "garden");
  assert.ok(ui.render().props.cosmetics.some(item => item.id === "garden" && item.owned));
  catalog.resolve(shop); await tick(); assert.equal(ui.render().props.refreshing, false);
  assert.ok(ui.render().props.cosmetics.some(item => item.id === "locked" && !item.unlocked));
});

test("Premium wardrobe claims through the existing server purchase route before equip, with itemId only", async () => {
  const ui = await controller({ premium: true });
  const release = { ...ui.render().props.cosmetics.find(item => item.id === "library"), id: "premium_scene", unlocked: false, owned: false, requiresPremium: true, claimable: true };
  await ui.render().props.onEquip(release);
  assert.deepEqual(ui.calls.filter(([method]) => method === "POST"), [["POST", apiRoutes.shopPurchase, { itemId: "premium_scene" }], ["POST", apiRoutes.inventoryEquip, { itemId: "premium_scene" }]]);
});

test("a stale cached Premium offer cannot bypass a newer Free entitlement or a fresh server denial", async () => {
  const ui = await controller({ premium: false });
  const release = { ...ui.render().props.cosmetics.find(item => item.id === "library"), unlocked: false, owned: false, requiresPremium: true, claimable: true };
  await ui.render().props.onEquip(release); assert.equal(ui.calls.some(([method]) => method === "POST"), false);
  const denied = await controller({ premium: true, failPost: true });
  await denied.render().props.onEquip(release);
  assert.deepEqual(denied.calls.filter(([method]) => method === "POST"), [["POST", apiRoutes.shopPurchase, { itemId: "library" }]]);
  assert.equal(denied.render().props.avatar.equippedBackgroundId, "garden");
});

test("a Premium claim finishing after account clear cannot send equip or repopulate another account's cache", async () => {
  const { cache } = memoryCache(); const reply = deferred();
  const ui = await controller({ cache, premium: true, post: () => reply.promise });
  const release = { ...ui.render().props.cosmetics.find(item => item.id === "library"), unlocked: false, owned: false, requiresPremium: true, claimable: true };
  const action = ui.render().props.onEquip(release);
  assert.deepEqual(ui.calls.filter(([method]) => method === "POST"), [["POST", apiRoutes.shopPurchase, { itemId: "library" }]]);
  assert.equal(ui.render().props.avatar.equippedBackgroundId, "garden", "no optimistic equipment change while the claim is pending");
  await cache.clearUser("local"); reply.resolve({ purchased: true }); await action;
  assert.equal(ui.calls.filter(([method]) => method === "POST").length, 1);
  assert.equal(cache.peek("local", "inventory"), null);
});
