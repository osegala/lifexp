import { noticeJsxRuntime, noticeImport } from "./notice-test-support.mjs";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";
import * as theme from "../src/theme/theme.ts";
import * as progress from "../src/base/buildingProgress.ts";
import { apiRoutes } from "../src/api/routes.ts";
import { apiError } from "../src/api/errors.ts";
import { memoryCache, deferred, world as cachedWorld, baseLayout } from "./cache-test-support.mjs";
import { SupersededCacheRead } from "../src/cache/PlayerCache.ts";

const require = createRequire(import.meta.url);
const source = readFileSync(new URL("../app/(tabs)/base.tsx", import.meta.url), "utf8");
const ast = ts.createSourceFile("base.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const syntax = []; function walk(node) { syntax.push(node); ts.forEachChild(node, walk); } walk(ast);
const hash = nodes => createHash("sha256").update(nodes.map(n => n.getText()).join("\n")).digest("hex");

test("Base retains the world renderer, geometry, coordinates and placement while account cache owns storage", () => {
  // Geometry fingerprints exclude the retired unscoped storage helpers.
  const functions = ast.statements.filter(n => ts.isFunctionDeclaration(n) && !["BaseScreen", "BuildingNode"].includes(n.name?.text));
  const constants = ast.statements.filter(ts.isVariableStatement).flatMap(s => [...s.declarationList.declarations]).filter(n => n.name.getText() !== "styles");
  assert.equal(hash(functions), "d49427c1c236e1cb0a6aaa893e00caae107585d06c566037cc34940630c7e321");
  assert.equal(hash(constants), "d04991d9bf726c6e7190aec056293a1043f7ab44d9f49ac586d91b66c3c10272");
  assert.match(source, /<MapViewport\s+image=\{BASE_BACKGROUND_IMAGES\.tiledGround\}/);
  assert.match(source, /layout=\{buildingLayouts\[building\.type\]\}/);
  assert.match(source, /<BuildingTierArtwork type=\{building\.type\} tier=\{building\.visualTier\}/);
  assert.match(source, /<BuildingUpgradeFeedback batch=\{celebration\} motion=\{upgradeMotion\} onDone=\{finishBuildings\} tone="parchment"/);
  assert.match(readFileSync(new URL("../src/components/BuildingUpgradeFeedback.tsx", import.meta.url), "utf8"), /<GameNoticeOverlay/);
  assert.doesNotMatch(source, /kingdomMap|Skia|expo-image|recyclingKey|FlatList/);
  assert.doesNotMatch(source, /SecureStore|BASE_LAYOUT_STORAGE_KEY|localStorage/);
});

test("camera, gestures, collision-aware dragging, path generation and decoration rendering are unchanged", () => {
  // moveBuilding adds cache invalidation; its geometry remains in resolveBuildingMove above.
  const names = ["composedMapGesture", "webMapHandlers", "sortedBuildings", "pathTiles", "mapDecorations", "buildingGesture"];
  assert.equal(hash(names.map(name => syntax.find(n => ts.isVariableDeclaration(n) && n.name.getText() === name))),
    "c56e6f75d3b0db42536a461a34ca401d5a69103ba2319034e035e0c2c94cbcd8");
  assert.match(source, /accessible accessibilityRole="button"[\s\S]*?Select building/);
  assert.match(source, /Platform\.OS === "web" \? \{ tabIndex: 0 \}/);
  assert.doesNotMatch(source, /onKeyDown|onKeyUp/, "RNGH already activates tap gestures with Enter/Space; do not double-toggle selection");
  assert.match(source, /onAccessibilityTap=\{onPress\}/);
  assert.match(source, /accessibilityState=\{\{ selected \}\} aria-pressed=\{selected\}/);
  assert.match(source, /keyboardFocused && styles\.buildingFocus/);
});

function load(path, imports) {
  const exports = {};
  const code = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), { compilerOptions: {
    jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, esModuleInterop: true,
  } }).outputText;
  new Function("require", "exports", "__DEV__", code)(id => {
    if (id === "react/jsx-runtime") return noticeJsxRuntime;
    const notice = noticeImport(id, imports); if (notice !== undefined) return notice;
    if (id === "../../src/context/AuthContext") return imports[id] ?? { useAuth: () => ({ user: { id: "base-user", coins: 739 } }) };
    assert.ok(id in imports, `Unexpected import ${id}`); return imports[id];
  }, exports, false);
  return exports;
}
const native = { ...Object.fromEntries(["View", "Text", "Pressable", "Image", "ActivityIndicator", "ScrollView"].map(n => [n, n])),
  Platform: { OS: "web" }, StyleSheet: { create: x => x }, Animated: { Value: class {}, ValueXY: class {} } };
const nodes = tree => Array.isArray(tree) ? tree.flatMap(nodes) : tree?.props ? [tree, ...nodes(tree.props.children)] : [];
const text = tree => Array.isArray(tree) ? tree.map(text).join("") : tree?.props ? text(tree.props.children) : typeof tree === "string" || typeof tree === "number" ? String(tree) : "";
const find = (tree, type) => nodes(tree).find(n => n.type === type || typeof n.type === "function" && n.type.name === type);
const panel = load("../src/components/BasePanels.tsx", {
  "react-native": native, "react-native-safe-area-context": { useSafeAreaInsets: () => ({ top: 20 }) }, "@expo/vector-icons/MaterialCommunityIcons": "Icon", "../base/buildingAssetRegistry": { getBuildingImageSource: (type, tier) => ({ uri: `${type}-${tier}` }) },
  "../theme/theme": theme, "./ui/Indicators": { ResourcePill: "Resource" },
  "./ui/Primitives": Object.fromEntries(["SurfaceCard", "UiPressable", "UiText"].map(n => [n, n])),
});
const building = { buildingId: "workshop", type: "Workshop", level: 1, maxLevel: 5, visualTier: 1, upgradeAvailable: true, upgradeCost: 100 };

test("resource overlay displays authoritative Coins and World Points, unknown stays unknown, retry retains its callback", () => {
  let retried = false;
  for (const value of [0, 412, 1234567890, undefined]) {
    const ui = panel.BaseResources({ coins: value, worldPoints: value, loading: false, error: "Offline", onRetry: () => { retried = true; } });
    assert.deepEqual(nodes(ui).filter(n => n.type === "Resource").map(n => n.props),
      ["coins", "worldPoints"].map(resource => ({ tone: "hud", resource, value: value ?? "—" })));
    const retry = find(ui, "UiPressable"); assert.equal(retry.props.accessibilityLabel, "Retry loading world"); retry.props.onPress();
    assert.match(text(ui), /Offline/); assert.doesNotMatch(text(ui), /Coins|Gems|XP/);
  }
  assert.equal(retried, true);
});

test("screen-space panel preserves upgrade/enter/info/close semantics, requirement states and accessible labels", () => {
  const actions = []; let closed = false;
  for (const state of [building, { ...building, upgradeAvailable: false }, { ...building, level: 5, upgradeAvailable: false, upgradeCost: null }]) {
    const ui = panel.BaseBuildingPanel({ building: state, description: "Existing description", descriptionOpen: true, error: "Could not upgrade",
      onAction: action => actions.push(action), onClose: () => { closed = true; } });
    const controls = nodes(ui).filter(n => n.type === "UiPressable");
    assert.deepEqual(controls.map(n => n.props.accessibilityLabel), ["Close Workshop details", "Upgrade Workshop", "Enter Workshop; interiors unavailable", "Workshop information"]);
    for (const action of controls) { assert.notEqual(action.props.disabled, true, "status/explanation actions remain callable as before"); action.props.onPress(); }
    assert.equal(controls[3].props["aria-expanded"], true);
    assert.match(text(ui), /Level .*Tier 1.*Could not upgrade.*Existing description/);
    assert.match(text(ui), state.level === 5 ? /Maximum level reached/ : /100 World Points/);
    assert.equal(find(ui, "Image").props.resizeMode, "contain");
    assert.equal(ui.props.style.position, "absolute"); assert.equal(ui.props.style.maxHeight, "56%");
  }
  assert.equal(closed, true); assert.deepEqual(actions, Array(3).fill(["upgrade", "enter", "description"]).flat());
});

const tick = () => new Promise(setImmediate);
async function controller({ failRead = false, failPost = false, locked = false, maxed = false, deferPost,
  cache = memoryCache().cache, userId = "base-user", read, autoFocus = true } = {}) {
  const state = [], cleanups = new Map(); let index = 0, effects = [], focus, blur;
  const changed = (before, after) => !before || after.some((value, i) => value !== before[i]);
  const react = { useState(initial) { const i = index++; if (!(i in state)) state[i] = typeof initial === "function" ? initial() : initial;
    return [state[i], value => { state[i] = typeof value === "function" ? value(state[i]) : value; }]; },
    useRef(initial) { const i = index++; return state[i] ??= { current: initial }; },
    useMemo(fn, deps) { const i = index++; if (!state[i] || changed(state[i].deps, deps)) state[i] = { deps, value: fn() }; return state[i].value; },
    useCallback(fn, deps) { return react.useMemo(() => fn, deps); },
    useEffect(fn, deps) { const i = index++; if (changed(state[i], deps)) { state[i] = deps; effects.push(() => { cleanups.get(i)?.(); cleanups.set(i, fn()); }); } } };
  const calls = [], alerts = [], batches = [];
  let blockedRead = failRead;
  let world = { ...cachedWorld, buildings: [{ ...cachedWorld.buildings[0], currentLevel: maxed ? 5 : 1, level: maxed ? 5 : 1,
    maxed, maxLevel: 5, upgradeCost: maxed ? null : 100, canUpgrade: !locked && !maxed }] };
  const gesture = new Proxy({}, { get: () => () => gesture });
  const Screen = load("../app/(tabs)/base.tsx", { react, "react-native": { ...native, Alert: { alert: (...args) => alerts.push(args) } },
    "expo-secure-store": {}, "expo-router": { useFocusEffect: fn => { focus = fn; } }, "@expo/vector-icons/MaterialCommunityIcons": "Icon",
    "react-native-gesture-handler": { Gesture: gesture, GestureDetector: "Gesture" },
    "../../src/cache/playerData": { playerCache: cache }, "../../src/cache/PlayerCache": { SupersededCacheRead },
    "../../src/context/AuthContext": { useAuth: () => ({ user: { id: userId, coins: 739 } }) },
    "../../src/api/client": { apiError, api: {
      get: async route => { calls.push(["GET", route]); if (blockedRead) throw new Error("offline"); return { data: read ? await read(world, calls.filter(([method]) => method === "GET").length) : world }; },
      post: async (route, body) => { calls.push(["POST", route, body]); if (deferPost) await deferPost;
        if (failPost) throw new Error("offline"); world = { ...world, worldPoints: 312, buildings: [{ ...world.buildings[0], level: 2, currentLevel: 2 }] };
        return { data: { upgraded: true, building: { buildingId: "workshop", name: "Workshop", oldLevel: 1, newLevel: 2, maxLevel: 5 },
          cost: { worldPoints: 100 }, player: { worldPoints: 312 } } }; },
    } }, "../../src/api/routes": { apiRoutes }, "../../src/base/buildingProgress": progress,
    "../../src/base/buildingAssetRegistry": { BASE_BACKGROUND_IMAGES: { tiledGround: "ground" }, getBuildingImageSource: () => "art" },
    "../../src/base/mapAssetRegistry": { DECORATION_IMAGES: {}, getPathTileSource: () => "path" }, "../../src/base/pathNetwork": { buildPathNetwork: () => [] },
    "../../src/components/BuildingUpgradeFeedback": { default: "Celebration", BuildingTierArtwork: "Artwork", useBuildingUpgradePresentation: () => ({}) },
    "../../src/components/BasePanels": { BaseBuildingPanel: "Panel", BaseResources: "Resources" },
    "../../src/context/CompletionFeedbackContext": { useBuildingFeedback: () => ({ pending: undefined, enqueue: batch => batches.push(batch), finish() {} }) },
    "../../src/storage/localAccountData": { BASE_LAYOUT_STORAGE_KEY: "layout" }, "../../src/theme/theme": theme,
  }).default;
  function render() { index = 0; effects = []; const tree = Screen(); effects.forEach(fn => fn()); return tree; }
  const initial = render(); if (autoFocus) { blur = focus(); render(); await tick(); }
  const select = () => { find(render(), "BuildingNode").props.onPress(); return find(render(), "Panel"); };
  return { render, initial, select, calls, alerts, batches, cache, blockRead(value) { blockedRead = value; },
    focus: async () => { blur = focus(); render(); await tick(); },
    dispose: () => { blur?.(); for (const cleanup of cleanups.values()) cleanup?.(); } };
}

test("confirmed upgrades keep exact POST, same-tick guard, server refresh and celebration flow", async () => {
  let release; const ui = await controller({ deferPost: new Promise(resolve => { release = resolve; }) });
  const selected = ui.select(); assert.equal(selected.props.building.level, 1);
  const request = selected.props.onAction("upgrade"); await selected.props.onAction("upgrade");
  assert.deepEqual(ui.calls.filter(([method]) => method === "POST"), [["POST", apiRoutes.upgradeBuilding("workshop"), {}]]);
  release(); await request;
  assert.equal(find(ui.render(), "Resources").props.worldPoints, 312);
  assert.equal(find(ui.render(), "Panel").props.building.level, 2);
  assert.equal(ui.batches.length, 1); assert.equal(ui.batches[0].upgrades[0].newTier, 2);
});

test("locked/maxed upgrades and unavailable interiors still explain status without server mutations", async () => {
  for (const options of [{ locked: true }, { maxed: true }]) {
    const ui = await controller(options), selected = ui.select();
    await selected.props.onAction("upgrade"); await selected.props.onAction("enter");
    assert.equal(ui.calls.filter(([method]) => method === "POST").length, 0); assert.equal(ui.batches.length, 0);
    assert.match(ui.alerts[0][1], options.maxed ? /maximum level/ : /100 World Points/);
    assert.equal(ui.alerts[1][0], "Interiors unavailable");
    selected.props.onAction("description"); assert.equal(find(ui.render(), "Panel").props.descriptionOpen, true);
    find(ui.render(), "Panel").props.onClose(); assert.equal(find(ui.render(), "Panel"), undefined);
  }
});

test("upgrade failure retains selected tier and balance, reports inline error and never celebrates", async () => {
  const ui = await controller({ failPost: true }); await ui.select().props.onAction("upgrade");
  assert.equal(find(ui.render(), "Panel").props.building.level, 1);
  assert.equal(find(ui.render(), "Resources").props.worldPoints, 412);
  assert.match(find(ui.render(), "Panel").props.error, /cannot be upgraded/); assert.equal(ui.batches.length, 0);
});

test("initial/refresh failures keep unknown/last confirmed resources and recover through the existing world loader", async () => {
  const ui = await controller({ failRead: true }); assert.equal(find(ui.render(), "Resources").props.worldPoints, undefined);
  assert.match(find(ui.render(), "Resources").props.error, /Could not load/);
  ui.blockRead(false); find(ui.render(), "Resources").props.onRetry(); await tick(); ui.select();
  ui.blockRead(true); find(ui.render(), "Resources").props.onRetry(); await tick();
  assert.equal(find(ui.render(), "Resources").props.worldPoints, 412);
  assert.equal(find(ui.render(), "Panel").props.building.level, 1);
});

test("cold Base restores world, building tier, resource HUD and placement before AWS responds", async t => {
  const first = memoryCache(); first.cache.set("alice", "world", cachedWorld); first.cache.set("alice", "baseLayout", baseLayout); await tick();
  const cache = memoryCache("test", first.values).cache; await cache.hydrateUser("alice");
  const pending = deferred(), ui = await controller({ cache, userId: "alice", autoFocus: false, read: () => pending.promise }); t.after(ui.dispose);
  assert.doesNotMatch(text(ui.initial), /Building your kingdom/);
  assert.equal(ui.calls.length, 0); assert.equal(find(ui.initial, "Resources").props.worldPoints, 412);
  assert.equal(find(ui.initial, "Resources").props.coins, 739);
  const building = find(ui.initial, "BuildingNode"); assert.equal(building.props.building.level, 1);
  const position = building.props.layout;
  await ui.focus(); assert.deepEqual(find(ui.render(), "BuildingNode").props.layout, position);
  pending.reject(Error("offline")); await tick();
  assert.equal(find(ui.render(), "BuildingNode").props.building.level, 1);
  assert.equal(find(ui.render(), "Resources").props.worldPoints, 412);
  assert.match(find(ui.render(), "Resources").props.error, /Could not load/);
  await tick(); const restarted = memoryCache("test", first.values).cache; await restarted.hydrateUser("alice");
  assert.deepEqual(restarted.peek("alice", "world"), cachedWorld);
  assert.ok(restarted.peek("alice", "baseLayout"));
});

test("Base replaces and persists cached world data after a successful background refresh", async t => {
  const first = memoryCache(); first.cache.set("alice", "world", cachedWorld); await tick();
  const cache = memoryCache("test", first.values).cache; await cache.hydrateUser("alice");
  const pending = deferred(), ui = await controller({ cache, userId: "alice", read: () => pending.promise }); t.after(ui.dispose);
  const fresh = { ...cachedWorld, worldPoints: 900, buildings: [{ ...cachedWorld.buildings[0], currentLevel: 3, level: 3, upgradeCost: 300 }] };
  pending.resolve(fresh); await tick();
  assert.equal(find(ui.render(), "Resources").props.worldPoints, 900);
  assert.equal(find(ui.render(), "BuildingNode").props.building.visualTier, 3);
  const restarted = memoryCache("test", first.values).cache; await restarted.hydrateUser("alice");
  assert.deepEqual(restarted.peek("alice", "world"), fresh);
});

test("building mutation updates persistent display state only after confirmation, even if the following refresh fails", async t => {
  const first = memoryCache(), confirm = deferred();
  const ui = await controller({ cache: first.cache, deferPost: confirm.promise }); t.after(ui.dispose);
  const original = structuredClone(first.cache.peek("base-user", "world"));
  const upgrade = ui.select().props.onAction("upgrade"); await tick();
  assert.deepEqual(first.cache.peek("base-user", "world"), original);
  ui.blockRead(true); confirm.resolve(); await upgrade;
  assert.equal(find(ui.render(), "Panel").props.building.level, 2);
  assert.equal(find(ui.render(), "Resources").props.worldPoints, 312);
  await tick(); const restarted = memoryCache("test", first.values).cache; await restarted.hydrateUser("base-user");
  assert.equal(restarted.peek("base-user", "world").worldPoints, 312);
  assert.equal(restarted.peek("base-user", "world").buildings[0].currentLevel, 2);
  assert.deepEqual(ui.calls.filter(([method]) => method === "POST"), [["POST", apiRoutes.upgradeBuilding("workshop"), {}]]);
});

test("a pre-upgrade world read cannot overwrite the confirmed building mutation", async t => {
  const { cache } = memoryCache(); cache.set("base-user", "world", cachedWorld);
  const old = deferred(), ui = await controller({ cache, read: (world, count) => count === 1 ? old.promise : Promise.resolve(world) }); t.after(ui.dispose);
  await ui.select().props.onAction("upgrade");
  old.resolve(cachedWorld); await tick();
  assert.equal(find(ui.render(), "BuildingNode").props.building.level, 2);
  assert.equal(cache.peek("base-user", "world").worldPoints, 312);
  assert.equal(cache.peek("base-user", "world").buildings[0].currentLevel, 2);
});

test("Base does not expose another account's world or positions and late work after logout cannot repersist it", async t => {
  const { cache } = memoryCache(); cache.set("alice", "world", cachedWorld); cache.set("alice", "baseLayout", baseLayout);
  const pending = deferred(), bob = await controller({ cache, userId: "bob", autoFocus: false, read: () => pending.promise }); t.after(bob.dispose);
  assert.match(text(bob.initial), /Building your kingdom/); assert.equal(find(bob.initial, "BuildingNode"), undefined);
  const confirm = deferred(), alice = await controller({ cache, userId: "alice", deferPost: confirm.promise }); t.after(alice.dispose);
  const node = find(alice.render(), "BuildingNode");
  const action = alice.select().props.onAction("upgrade"); await tick();
  await cache.clearUser("alice");
  node.props.onMove("Workshop", { ...node.props.layout, x: node.props.layout.x + 300 }); alice.render();
  confirm.resolve(); await action;
  assert.equal(cache.peek("alice", "world"), null); assert.equal(cache.peek("alice", "baseLayout"), null);
  assert.equal(alice.batches.length, 0);
});

test("missing or corrupt world cache shows the genuine first-load state", async t => {
  const disk = new Map([["evrenthia.player-cache.v1.test.alice.world", JSON.stringify({ version: 1, data: { worldPoints: 0, buildings: [{}] } })]]);
  const { cache } = memoryCache("test", disk); await cache.hydrateUser("alice");
  const pending = deferred(), ui = await controller({ cache, userId: "alice", autoFocus: false, read: () => pending.promise }); t.after(ui.dispose);
  assert.match(text(ui.initial), /Building your kingdom/); assert.equal(cache.peek("alice", "world"), null);
});
