import { noticeJsxRuntime, noticeImport } from "./notice-test-support.mjs";
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

import { memoryCache, deferred } from "./cache-test-support.mjs";
import { SupersededCacheRead } from "../src/cache/PlayerCache.ts";

const require = createRequire(import.meta.url);
function load(path, imports) {
  const exports = {};
  const code = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), { compilerOptions: {
    jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, esModuleInterop: true,
  } }).outputText;
  new Function("require", "exports", code)(id => {
    if (id === "react/jsx-runtime") return noticeJsxRuntime;
    const notice = noticeImport(id, imports); if (notice !== undefined) return notice;
    if (id === "./ui/PaperTexture") return "PaperTexture";
    if (id === "./ui/FantasyMaterial") return "FantasyMaterial";
    if (id === "@expo/vector-icons/MaterialCommunityIcons") return "Icon";
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
  }, useRef: initial => react.useState(() => ({ current: initial }))[0], useEffect() {}, useCallback: fn => fn, useMemo: fn => fn(), memo: fn => fn };
  return { react, render(fn) { index = 0; return fn(); } };
}
const native = { ...Object.fromEntries(["FlatList", "View", "ScrollView", "ActivityIndicator", "Image"].map(name => [name, name])),
  Platform: { select: value => value.default }, StyleSheet: { create: value => value } };
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
    "react-native-safe-area-context": { useSafeAreaInsets: () => ({ top: 20 }) },
    "../avatar/prefetch": { prefetchShopThumbnails: async () => {} }, "./ui/PageBackground": "Background", "./ShopItemCard": "Card", "./LifeButton": "Button", "./ui/Indicators": indicators, "./ui/Primitives": primitives });
  const defaults = { shop, loading: false, busyId: null, loadError: "", purchaseError: "", entitlement: { loading: false, premium: false },
    onPurchase() {}, onRetry() {}, onPremium() {}, banner: { type: "Banner", props: { placement: "SHOP" } }, rewarded: { type: "Reward", props: {} } };
  return { render: patch => h.render(() => Content({ ...defaults, ...patch }).props.children), dimensions: value => { dimensions = value; }, defaults };
}

test("Shop defaults to the server catalog order and filters only actual category values", () => {
  const c = content(); let tree = c.render();
  assert.equal(tree.type, "FlatList"); assert.equal(tree.props.data, shop.items);
  const chips = () => find(tree.props.ListHeaderComponent, "FilterChip");
  assert.deepEqual(chips().map(n => n.props.label), ["All", "Premium", "Outfits", "Pets", "Auras"]);
  assert.equal(chips()[0].props.selected, true);
  chips().find(n => n.props.label === "Outfits").props.onPress(); tree = c.render();
  assert.deepEqual(tree.props.data.map(i => i.itemId), ["second", "fourth"]);
  assert.equal(chips().find(n => n.props.label === "Outfits").props.selected, true);
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
  return { render: (value, busy = false, onPurchase = () => {}, extra = {}) => Card({ item: value, busy, onPurchase, ...extra }), memoized };
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
  buttons.find(n => n.props.title === "Retry shop").props.onPress(); find(tree.props.ListHeaderComponent, "UiPressable").find(n => n.props.accessibilityLabel === "View Premium").props.onPress();
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

async function controller({ get, post = async () => ({}), cache = memoryCache().cache, autoFocus = true }) {
  const h = hooks(), calls = [], alerts = [], routes = []; let focus, refreshes = 0;
  const Screen = load("../app/(tabs)/shop.tsx", { react: h.react, "react-native": { Alert: { alert: (...args) => alerts.push(args) } },
    "expo-router": { router: { push: route => routes.push(route) }, useFocusEffect: fn => { focus = fn; } },
    "../../src/api/client": { apiError, api: { get: async route => { calls.push(["GET", route]); return { data: await get() }; },
      post: async (route, input) => { calls.push(["POST", route, input]); return { data: await post() }; } } },
    "../../src/cache/playerData": { playerCache: cache }, "../../src/cache/PlayerCache": { SupersededCacheRead }, "../../src/api/routes": { apiRoutes }, "../../src/components/ShopContent": "Content",
    "../../src/context/AuthContext": { useAuth: () => ({ user: { id: "local" }, refreshUser: async () => { refreshes++; } }) },
    "../../src/entitlements/useEntitlements": { useEntitlements: () => ({ loading: false, premium: false }) },
    "../../src/ads/Ads": { BannerAdPlacement: "Banner", RewardedAdButton: "Reward" } });
  const render = () => h.render(Screen);
  render(); if (autoFocus) { focus(); await tick(); }
  return { render, calls, alerts, routes, focus: () => focus(), refreshes: () => refreshes };
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


test("all 119 seed items remain in the review catalog and every friendly category reaches the same original IDs", () => {
  const source = readFileSync(new URL("../src/dev/ShopPreview.tsx", import.meta.url), "utf8");
  const catalog = JSON.parse(source.match(/const catalog = (\[[\s\S]*?\]);/)[1].replace(/,\s*\]/g, "]"));
  const seed = JSON.parse(readFileSync(new URL("../../backend/seeds/cosmetics.json", import.meta.url), "utf8"));
  assert.equal(catalog.length, 119);
  assert.deepEqual(catalog.map(row => row.itemId).sort(), seed.map(row => row.itemId).sort());
  const reviewed = { ...shop, items: catalog.map(row => item(row.itemId, row)) };
  const c = content(); let tree = c.render({ shop: reviewed });
  for (const [value, label] of [["tunic", "Outfits"], ["hat", "Hats"], ["pet", "Pets"], ["pants", "Bottoms"], ["boots", "Boots"], ["aura", "Auras"], ["background", "Scenes"]]) {
    find(tree.props.ListHeaderComponent, "FilterChip").find(n => n.props.label === label).props.onPress();
    tree = c.render({ shop: reviewed });
    assert.deepEqual(tree.props.data.map(row => row.itemId), reviewed.items.filter(row => row.category === value).map(row => row.itemId));
  }
});

test("Shop shows cached server balances and purchase flags on entry while a background response is pending", async () => {
  const { cache } = memoryCache(); cache.set("local", "shop", shop); const request = deferred();
  const ui = await controller({ cache, autoFocus: false, get: () => request.promise });
  assert.equal(ui.render().props.shop.player.coins, 481); assert.equal(ui.render().props.loading, false);
  ui.focus(); await tick(); assert.equal(ui.render().props.refreshing, true); assert.equal(ui.render().props.loading, false);
  assert.deepEqual(ui.render().props.shop.items, shop.items);
  const fresh = { ...shop, player: { coins: 407, level: 12 } }; request.resolve(fresh); await tick();
  assert.equal(ui.render().props.shop, fresh); assert.equal(ui.render().props.refreshing, false);
  assert.deepEqual(cache.peek("local", "shop"), fresh);
});

test("Shop hydrates disk before network completion and survives offline tab re-entry", async () => {
  const original = memoryCache(); original.cache.set("local", "shop", shop); await tick();
  const { cache } = memoryCache("test", original.values); const request = deferred();
  const ui = await controller({ cache, get: () => request.promise });
  assert.equal(ui.render().props.loading, false); assert.equal(ui.render().props.shop.player.coins, 481);
  request.reject(Error("offline")); await tick(); assert.equal(ui.render().props.shop.player.coins, 481);
  assert.match(ui.render().props.loadError, /Could not load/);
  ui.focus(); await tick(); assert.equal(ui.render().props.loading, false); assert.equal(ui.render().props.shop.items.length, 4);
});

test("an old catalog read finishing after a purchase cannot restore old ownership or coins", async () => {
  const { cache } = memoryCache(); cache.set("local", "shop", shop);
  const old = deferred(); let reads = 0;
  const confirmed = { ...shop, player: { coins: 408, level: 12 }, items: [{ ...shop.items[0], owned: true, canPurchase: false, status: "OWNED" }] };
  const ui = await controller({ cache, get: () => ++reads === 1 ? old.promise : Promise.resolve(confirmed) });
  await ui.render().props.onPurchase(shop.items[0]);
  assert.equal(ui.render().props.shop.player.coins, 408); assert.equal(ui.render().props.shop.items[0].owned, true);
  old.resolve(shop); await tick();
  assert.equal(ui.render().props.shop.player.coins, 408); assert.deepEqual(cache.peek("local", "shop"), confirmed);
});

test("a purchase reply after logout cannot resurrect a cleared cache or start another account's refresh", async () => {
  const { cache } = memoryCache(); const reply = deferred();
  const ui = await controller({ cache, get: async () => shop, post: () => reply.promise });
  const purchase = ui.render().props.onPurchase(shop.items[0]);
  await cache.clearUser("local"); reply.resolve({ coins: 1000 }); await purchase;
  assert.equal(cache.peek("local", "shop"), null); assert.equal(ui.calls.filter(([method]) => method === "GET").length, 1);
});

test("a confirmed reward during cold loading restarts the superseded catalog read and caches only server totals", async () => {
  const { cache } = memoryCache(); const old = deferred(); let reads = 0;
  const confirmed = { ...shop, player: { coins: 531, level: 12 } };
  const ui = await controller({ cache, get: () => ++reads === 1 ? old.promise : Promise.resolve(confirmed) });
  assert.equal(ui.render().props.shop, null); assert.equal(ui.render().props.loading, true);
  ui.render().props.rewarded.props.onReward({ coins: 531 }); await tick();
  assert.equal(ui.render().props.shop.player.coins, 531); assert.equal(ui.render().props.loading, false);
  old.resolve(shop); await tick();
  assert.equal(cache.peek("local", "shop").player.coins, 531); assert.equal(ui.render().props.shop.player.coins, 531);
});

test("Premium filter contains all 34 releases while normal category filters retain the same Premium items", () => {
  const c = content(); const seed = JSON.parse(readFileSync(new URL("../../backend/seeds/cosmetics.json", import.meta.url)));
  const full = { ...shop, items: seed.map(row => item(row.itemId, row)) };
  let tree = c.render({ shop: full });
  find(tree.props.ListHeaderComponent, "FilterChip").find(node => node.props.label === "Premium").props.onPress();
  tree = c.render({ shop: full }); assert.equal(tree.props.data.length, 34); assert.ok(tree.props.data.every(item => item.requiresPremium));
  for (const [category, label, count] of [["tunic", "Outfits", 10], ["boots", "Boots", 5], ["pet", "Pets", 3]]) {
    find(tree.props.ListHeaderComponent, "FilterChip").find(node => node.props.label === label).props.onPress(); tree = c.render({ shop: full });
    assert.ok(tree.props.data.every(item => item.category === category)); assert.equal(tree.props.data.filter(item => item.requiresPremium).length, count);
  }
});

test("Premium cards offer the existing upgrade route or a server-permitted free unlock, never a coin charge", () => {
  const c = card(); let upgrades = 0, claims = 0;
  const release = item("Rose Bard Dress", { requiresPremium: true, effectivePrice: 0, premiumRequirementSatisfied: true });
  const active = c.render(release, false, () => claims++, { premiumAvailable: true, onPremium: () => upgrades++ });
  assert.equal(find(active, "ResourcePill").length, 0); assert.match(text(active), /Included with Premium/);
  const unlock = find(active, "UiPressable")[0]; assert.equal(unlock.props.accessibilityLabel, "Unlock: Rose Bard Dress"); unlock.props.onPress(); assert.equal(claims, 1);
  const free = c.render(release, false, () => claims++, { premiumAvailable: false, onPremium: () => upgrades++ });
  assert.equal(find(free, "UiPressable")[0].props.accessibilityLabel, "View Premium for Rose Bard Dress"); find(free, "UiPressable")[0].props.onPress();
  assert.equal(upgrades, 1); assert.equal(claims, 1, "fresh Free status denies a stale cached offer");
  const owned = c.render({ ...release, owned: true, status: "OWNED", premiumRequirementSatisfied: false }, false, () => claims++, { premiumAvailable: false });
  assert.equal(find(owned, "UiPressable").length, 0); assert.ok(find(owned, "BadgePill").some(node => node.props.label === "Owned")); assert.doesNotMatch(text(owned), /Premium required/);
});

test("a server Premium denial reconciles cached offers through the same background refresh path", async () => {
  const { cache } = memoryCache();
  const release = item("premium_hat", { price: 0, effectivePrice: 0, requiresPremium: true, premiumRequirementSatisfied: true });
  let current = { ...shop, items: [release] };
  const ui = await controller({ cache, get: async () => current, post: async () => {
    current = { ...current, items: [{ ...release, canPurchase: false, unlocked: false, premiumRequirementSatisfied: false, status: "LOCKED" }] };
    throw { response: { data: { error: { code: "PREMIUM_REQUIRED", message: "Premium required" } } } };
  } });
  await ui.render().props.onPurchase(release);
  assert.equal(ui.render().props.shop.items[0].canPurchase, false);
  assert.equal(cache.peek("local", "shop").items[0].premiumRequirementSatisfied, false);
  assert.equal(ui.render().props.shop.player.coins, 481); assert.match(ui.render().props.purchaseError, /Premium required/);
});

test("cold Shop restores all 34 Premium entries before the backend response and retains them offline", async () => {
  const premium = JSON.parse(readFileSync(new URL("../../backend/seeds/cosmetics.json", import.meta.url), "utf8"))
    .filter(row => row.requiresPremium).map(row => item(row.itemId, { ...row, effectivePrice: row.price, effectiveRequiredLevel: row.requiredLevel }));
  const first = memoryCache(); first.cache.set("local", "shop", { ...shop, items: premium }); await tick();
  const cache = memoryCache("test", first.values).cache; await cache.hydrateUser("local");
  const pending = deferred(), ui = await controller({ cache, get: () => pending.promise, autoFocus: false });
  assert.equal(ui.calls.length, 0); assert.equal(ui.render().props.loading, false);
  assert.equal(ui.render().props.shop.items.filter(row => row.requiresPremium).length, 34);
  ui.focus(); await tick(); pending.reject(Error("offline")); await tick();
  assert.equal(ui.render().props.shop.items.length, 34); assert.equal(ui.render().props.loading, false);
});
