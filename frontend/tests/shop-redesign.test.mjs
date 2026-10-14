import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";
import * as theme from "../src/theme/theme.ts";
import * as inventory from "../src/avatar/inventory.ts";
import * as layout from "../src/avatar/spriteLayout.ts";
import { apiError } from "../src/api/errors.ts";
import { apiRoutes } from "../src/api/routes.ts";

const require = createRequire(import.meta.url);
function load(path, imports) {
  const exports = {};
  const code = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), { compilerOptions: {
    jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, esModuleInterop: true,
  } }).outputText;
  new Function("require", "exports", code)(id => {
    if (id === "react/jsx-runtime") return require(id);
    assert.ok(id in imports, `Unexpected import: ${id}`);
    return imports[id];
  }, exports);
  return exports.default ?? exports;
}
function hooks() {
  let index = 0;
  const values = [];
  const react = { useState(initial) {
    const i = index++;
    if (!(i in values)) values[i] = typeof initial === "function" ? initial() : initial;
    return [values[i], value => { values[i] = typeof value === "function" ? value(values[i]) : value; }];
  }, useCallback: fn => fn, useMemo: fn => fn(), memo: fn => fn };
  return { react, render(fn) { index = 0; return fn(); } };
}
const native = { ...Object.fromEntries(["FlatList", "View", "ScrollView", "ActivityIndicator", "Image"].map(name => [name, name])),
  StyleSheet: { create: value => value } };
const primitives = Object.fromEntries(["UiText", "UiPressable", "SurfaceCard", "EmptyState", "FilterChip"].map(name => [name, name]));
const indicators = Object.fromEntries(["BadgePill", "ResourcePill", "ResourceCluster"].map(name => [name, name]));
const nodes = tree => Array.isArray(tree) ? tree.flatMap(nodes) : tree?.props ? [tree, ...nodes(tree.props.children)] : [];
const text = tree => Array.isArray(tree) ? tree.map(text).join("") : tree?.props ? text(tree.props.children)
  : typeof tree === "string" || typeof tree === "number" ? String(tree) : "";
const find = (tree, type) => nodes(tree).filter(node => node.type === type);
const tick = () => new Promise(setImmediate);
const item = (itemId, patch = {}) => ({ itemId, name: itemId, category: "tunic", assetKey: "forest-tunic.png", price: 999,
  effectivePrice: 73, effectiveRequiredLevel: 5, requiredLevel: 5, requiredAchievement: null, achievementRequirement: null,
  owned: false, unlocked: true, canAfford: true, canPurchase: true, status: "PURCHASABLE", requirementSatisfied: true, ...patch });
const shop = { player: { coins: 481, level: 12 }, items: [item("second"), item("first", { category: "pet" }), item("third", { category: "aura" }), item("fourth")] };
function content() {
  const h = hooks(); let dimensions = { width: 390, fontScale: 1 };
  const Content = load("../src/components/ShopContent.tsx", { react: h.react,
    "react-native": { ...native, useWindowDimensions: () => dimensions }, "../theme/theme": theme,
    "./ShopItemCard": "Card", "./LifeButton": "Button", "./ui/Indicators": indicators, "./ui/Primitives": primitives });
  const defaults = { shop, loading: false, busyId: null, loadError: "", purchaseError: "", entitlement: { loading: false, premium: false },
    onPurchase() {}, onRetry() {}, onPremium() {}, banner: { type: "Banner", props: { placement: "SHOP" } }, rewarded: { type: "Reward", props: {} } };
  return { render: patch => h.render(() => Content({ ...defaults, ...patch })), dimensions: value => { dimensions = value; }, defaults };
}

test("Shop defaults to the server catalog order and filters only actual category values", () => {
  const c = content(); let tree = c.render();
  assert.equal(tree.type, "FlatList"); assert.equal(tree.props.data, shop.items);
  const chips = () => find(tree.props.ListHeaderComponent, "FilterChip");
  assert.deepEqual(chips().map(n => n.props.label), ["All", "tunic", "pet", "aura"]);
  assert.equal(chips()[0].props.selected, true);
  chips().find(n => n.props.label === "tunic").props.onPress(); tree = c.render();
  assert.deepEqual(tree.props.data.map(i => i.itemId), ["second", "fourth"]);
  assert.equal(chips().find(n => n.props.label === "tunic").props.selected, true);
  chips()[0].props.onPress(); assert.equal(c.render().props.data, shop.items);
  assert.equal(find(tree, "Card").length, 0, "renderItem is lazy, not an eager catalog map");
});

test("Shop preserves six initial previews, four-item batches, window five and stable item keys in either layout", () => {
  const c = content(); const many = { ...shop, items: Array.from({ length: 100 }, (_, i) => item(String(i))) };
  for (const [width, fontScale, columns] of [[320, 1, 1], [390, 1, 2], [768, 1, 2], [1024, 1, 2], [390, 2, 1]]) {
    c.dimensions({ width, fontScale }); const tree = c.render({ shop: many, busyId: "2" });
    assert.equal(tree.props.numColumns, columns);
    assert.equal(tree.props.initialNumToRender * columns, 6);
    assert.equal(tree.props.maxToRenderPerBatch * columns, 4);
    assert.equal(tree.props.windowSize, 5); assert.equal(tree.props.extraData, "2");
    assert.equal(tree.props.keyExtractor(many.items[2]), "2");
    const row = tree.props.renderItem({ item: many.items[2] });
    assert.equal(find(row, "Card")[0].props.busy, true);
    assert.equal(find(row, "Card")[0].props.onPurchase, c.defaults.onPurchase);
    assert.equal(find(tree.props.ListHeaderComponent, "ScrollView")[0].props.horizontal, true);
  }
});

function card() {
  let memoized = false;
  const Card = load("../src/components/ShopItemCard.tsx", { react: { memo: fn => { memoized = true; return fn; } },
    "react-native": native, "@expo/vector-icons/MaterialCommunityIcons": "Icon", "../types": {}, "../theme/theme": theme,
    "../avatar/inventory": inventory, "../avatar/assetRegistry": { getCosmeticPreviewSource: ref => ref.imageUrl, getCosmeticPreviewCrop: () => ({ width: 100, height: 200 }) },
    "./CosmeticImage": "Preview", "./ui/Indicators": indicators, "./ui/Primitives": primitives });
  return { render: (value, busy = false, onPurchase = () => {}) => Card({ item: value, busy, onPurchase }), memoized };
}

test("memoized cards use shared asset mapping, effective prices and server purchase flags", () => {
  const c = card(); assert.equal(c.memoized, true); const selected = item("Forest Tunic"); let purchased;
  const tree = c.render(selected, false, value => { purchased = value; });
  assert.equal(find(tree, "Preview")[0].props.source, "avatar-v2/tops/forest-ranger");
  assert.equal(find(tree, "Preview")[0].props.cached, true);
  assert.equal(find(tree, "ResourcePill")[0].props.value, 73, "never display the undiscounted price as the charge");
  const buy = find(tree, "UiPressable")[0];
  assert.equal(buy.props.accessibilityLabel, "Buy: Forest Tunic"); assert.equal(buy.props.accessibilityHint, "73 coins");
  assert.equal(buy.props.disabled, false); buy.props.onPress(); assert.equal(purchased, selected);
  assert.equal(find(c.render({ ...selected, canPurchase: false }), "UiPressable")[0].props.disabled, true);
  const pending = find(c.render(selected, true), "UiPressable")[0];
  assert.equal(pending.props.disabled, true); assert.equal(pending.props.accessibilityState.busy, true); assert.match(text(pending), /Buying/);
});

test("insufficient funds, Premium/achievement locks and permanent ownership remain readable and cannot buy", () => {
  const c = card();
  const insufficient = c.render(item("Need funds", { canPurchase: false, canAfford: false, status: "NOT_ENOUGH_COINS" }));
  assert.equal(find(insufficient, "UiPressable")[0].props.disabled, true); assert.match(text(insufficient), /Need coins/);
  const premium = c.render(item("Premium gear", { requiresPremium: true, premiumRequirementSatisfied: false, canPurchase: false, status: "LOCKED" }));
  assert.equal(find(premium, "UiPressable").length, 0); assert.match(text(premium), /Premium required/);
  const requirement = { name: "Forestbound", type: "TASKS_COMPLETED", currentValue: 12, requiredValue: 25 };
  const locked = c.render(item("Achievement gear", { achievementRequirement: requirement, canPurchase: false, status: "LOCKED" }));
  assert.match(text(locked), /Complete "Forestbound"12 \/ 25 tasks/); assert.equal(find(locked, "UiPressable").length, 0);
  const owned = c.render(item("Previously purchased Premium", { requiresPremium: true, premiumRequirementSatisfied: false, owned: true, canPurchase: false, status: "OWNED" }));
  assert.equal(find(owned, "UiPressable").length, 0); assert.equal(find(owned, "BadgePill")[0].props.label, "Owned");
  assert.equal(find(owned, "ResourcePill").length, 0); assert.doesNotMatch(text(owned), /Premium required/);
  // The existing Shop response has no equipped slot; do not invent an equipped badge or equip endpoint.
  assert.doesNotMatch(readFileSync(new URL("../src/components/ShopItemCard.tsx", import.meta.url), "utf8"), /equipped|api\./);
});

test("Shop has honest loading/error/empty states, actual Coins, Premium navigation and the same footer order", () => {
  const c = content(); let retried = 0, premium = 0;
  const initial = c.render({ shop: null, loading: true });
  assert.equal(find(initial.props.ListHeaderComponent, "ResourcePill")[0].props.value, "—");
  assert.equal(initial.props.ListEmptyComponent, null);
  const tree = c.render({ loadError: "Offline; showing saved catalog", purchaseError: "Not enough coins", onRetry: () => retried++, onPremium: () => premium++ });
  assert.equal(find(tree.props.ListHeaderComponent, "ResourcePill")[0].props.value, 481);
  assert.equal(nodes(tree.props.ListHeaderComponent).filter(n => n.props.accessibilityRole === "alert").length, 2);
  const buttons = find(tree.props.ListHeaderComponent, "Button");
  buttons.find(n => n.props.title === "Retry shop").props.onPress(); buttons.find(n => n.props.title === "View Premium").props.onPress();
  assert.equal(retried, 1); assert.equal(premium, 1);
  assert.deepEqual(tree.props.ListFooterComponent.props.children, [c.defaults.banner, c.defaults.rewarded]);
  assert.equal(c.render({ shop: { ...shop, items: [] } }).props.ListEmptyComponent.props.title, "No items available");
});

test("Shop cached previews preserve crop/aspect geometry and leave the original wardrobe path as default", () => {
  const h = hooks();
  const Image = load("../src/components/CosmeticImage.tsx", { react: h.react, "react-native": native,
    "expo-image": { Image: "CachedImage" }, "../avatar/spriteLayout": layout });
  const render = props => h.render(() => Image({ source: "source.png", style: {}, ...props }));
  assert.equal(find(render({}), "Image")[0].props.resizeMode, "contain");
  const cached = find(render({ cached: true }), "CachedImage")[0];
  assert.equal(cached.props.contentFit, "contain"); assert.equal(cached.props.cachePolicy, "memory-disk"); assert.equal(cached.props.transition, 0);
  const crop = { x: 10, y: 20, width: 100, height: 200, sourceWidth: 1254, sourceHeight: 1254 };
  const first = render({ crop, cached: true }); assert.equal(find(first, "CachedImage").length, 0);
  first.props.onLayout({ nativeEvent: { layout: { width: 150, height: 150 } } });
  const ready = render({ crop, cached: true });
  assert.deepEqual(find(ready, "CachedImage")[0].props.style[1], layout.croppedImageStyle(crop));
  assert.deepEqual(ready.props.children.props.style, { width: 75, height: 150, overflow: "hidden" });
  assert.equal(find(render({ crop }), "Image")[0].props.resizeMode, "stretch");
});

async function controller({ get, post = async () => ({}) }) {
  const h = hooks(), calls = [], alerts = [], routes = []; let focus, refreshes = 0;
  const Screen = load("../app/(tabs)/shop.tsx", { react: h.react, "react-native": { Alert: { alert: (...args) => alerts.push(args) } },
    "expo-router": { router: { push: route => routes.push(route) }, useFocusEffect: fn => { focus = fn; } },
    "../../src/api/client": { apiError, api: { get: async route => { calls.push(["GET", route]); return { data: await get() }; },
      post: async (route, input) => { calls.push(["POST", route, input]); return { data: await post() }; } } },
    "../../src/api/routes": { apiRoutes }, "../../src/components/ShopContent": "Content",
    "../../src/context/AuthContext": { useAuth: () => ({ refreshUser: async () => { refreshes++; } }) },
    "../../src/entitlements/useEntitlements": { useEntitlements: () => ({ loading: false, premium: false }) },
    "../../src/ads/Ads": { BannerAdPlacement: "Banner", RewardedAdButton: "Reward" } });
  const render = () => h.render(Screen);
  render(); focus(); await tick();
  return { render, calls, alerts, routes, refreshes: () => refreshes };
}

test("purchase waits for the server catalog, sends only itemId and refreshes authoritative ownership/balance", async () => {
  let current = shop, resolve;
  const ui = await controller({ get: async () => current, post: () => new Promise(done => { resolve = done; }) });
  const purchase = ui.render().props.onPurchase(shop.items[0]);
  assert.equal(ui.render().props.busyId, "second"); assert.equal(ui.render().props.shop.player.coins, 481);
  assert.deepEqual(ui.calls[1], ["POST", apiRoutes.shopPurchase, { itemId: "second" }]);
  current = { ...shop, player: { coins: 407, level: 12 }, items: [{ ...shop.items[0], owned: true, status: "OWNED" }] };
  resolve({ coins: 99999 }); await purchase;
  assert.equal(ui.render().props.shop, current); assert.equal(ui.render().props.busyId, null);
  assert.equal(ui.render().props.shop.items[0].owned, true); assert.equal(ui.refreshes(), 2);
  ui.render().props.onPremium(); assert.deepEqual(ui.routes, ["/premium"]);
});

test("catalog and purchase failures preserve last confirmed balances and expose retry without reward writes", async () => {
  let failed = true;
  const ui = await controller({ get: async () => { if (failed) throw new Error("offline"); return shop; },
    post: async () => { throw { response: { data: { error: { code: "INSUFFICIENT_COINS", message: "Not enough coins" } } } }; } });
  assert.equal(ui.render().props.shop, null); assert.match(ui.render().props.loadError, /Could not load/);
  failed = false; ui.render().props.onRetry(); await tick(); assert.equal(ui.render().props.shop, shop);
  await ui.render().props.onPurchase(shop.items[0]);
  assert.equal(ui.render().props.shop.player.coins, 481); assert.match(ui.render().props.purchaseError, /Not enough coins/);
  failed = true; ui.render().props.onRetry(); await tick(); assert.equal(ui.render().props.shop, shop);
  assert.equal(ui.calls.filter(([method]) => method === "POST").length, 1); assert.equal(ui.alerts.length, 3);
});
