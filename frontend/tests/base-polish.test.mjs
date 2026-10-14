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

const require = createRequire(import.meta.url);
const source = readFileSync(new URL("../app/(tabs)/base.tsx", import.meta.url), "utf8");
const ast = ts.createSourceFile("base.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const syntax = []; function walk(node) { syntax.push(node); ts.forEachChild(node, walk); } walk(ast);
const hash = nodes => createHash("sha256").update(nodes.map(n => n.getText()).join("\n")).digest("hex");

test("Base retains the exact pre-phase world renderer, geometry, coordinates, placement and storage helpers", () => {
  // Fingerprints taken from the pre-Phase-6 HEAD. UI-only edits must not touch these.
  const functions = ast.statements.filter(n => ts.isFunctionDeclaration(n) && !["BaseScreen", "BuildingNode"].includes(n.name?.text));
  const constants = ast.statements.filter(ts.isVariableStatement).flatMap(s => [...s.declarationList.declarations]).filter(n => n.name.getText() !== "styles");
  assert.equal(hash(functions), "0189cc0315513ce1d95e09b0108a694ec095c39c4a7caff4f1231222d0074f19");
  assert.equal(hash(constants), "d04991d9bf726c6e7190aec056293a1043f7ab44d9f49ac586d91b66c3c10272");
  assert.match(source, /<MapViewport\s+image=\{BASE_BACKGROUND_IMAGES\.tiledGround\}/);
  assert.match(source, /layout=\{buildingLayouts\[building\.type\]\}/);
  assert.match(source, /<BuildingTierArtwork type=\{building\.type\} tier=\{building\.visualTier\}/);
  assert.match(source, /<BuildingUpgradeFeedback batch=\{celebration\} motion=\{upgradeMotion\} onDone=\{finishBuildings\} tone="parchment" style=\{styles\.upgradeFeedback\}/);
  assert.match(source, /upgradeFeedback: \{ top: ui\.spacing\.md \* 2 \+ ui\.size\.target, bottom: undefined \}/);
  assert.doesNotMatch(source, /kingdomMap|Skia|expo-image|recyclingKey|FlatList/);
});

test("camera, gestures, collision-aware dragging, path generation and decoration rendering are unchanged", () => {
  const names = ["composedMapGesture", "webMapHandlers", "moveBuilding", "sortedBuildings", "pathTiles", "mapDecorations", "buildingGesture"];
  assert.equal(hash(names.map(name => syntax.find(n => ts.isVariableDeclaration(n) && n.name.getText() === name))),
    "734c8c7eab661af6e3e00b47f108a232a6d8483ccfbb13a10ff976710c30ca87");
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
    if (id === "react/jsx-runtime") return require(id);
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
  "react-native": native, "@expo/vector-icons/MaterialCommunityIcons": "Icon", "../base/buildingAssetRegistry": { getBuildingImageSource: (type, tier) => ({ uri: `${type}-${tier}` }) },
  "../theme/theme": theme, "./ui/Indicators": { ResourcePill: "Resource" },
  "./ui/Primitives": Object.fromEntries(["SurfaceCard", "UiPressable", "UiText"].map(n => [n, n])),
});
const building = { buildingId: "workshop", type: "Workshop", level: 1, maxLevel: 5, visualTier: 1, upgradeAvailable: true, upgradeCost: 100 };

test("resource overlay displays only authoritative World Points, unknown stays unknown, retry retains its callback", () => {
  let retried = false;
  for (const value of [0, 412, 1234567890, undefined]) {
    const ui = panel.BaseResources({ worldPoints: value, loading: false, error: "Offline", onRetry: () => { retried = true; } });
    assert.deepEqual(find(ui, "Resource").props, { resource: "worldPoints", value: value ?? "—" });
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
async function controller({ failRead = false, failPost = false, locked = false, maxed = false, deferPost } = {}) {
  const state = []; let index = 0, effects = [], focus;
  const react = { useState(initial) { const i = index++; if (!(i in state)) state[i] = typeof initial === "function" ? initial() : initial;
    return [state[i], value => { state[i] = typeof value === "function" ? value(state[i]) : value; }]; },
    useRef(initial) { const i = index++; return state[i] ??= { current: initial }; }, useMemo: fn => fn(), useCallback: fn => fn,
    useEffect: fn => effects.push(fn) };
  const calls = [], alerts = [], batches = [];
  let blockedRead = failRead;
  let world = { worldPoints: 412, buildings: [{ buildingId: "workshop", name: "Workshop", currentLevel: maxed ? 5 : 1, level: maxed ? 5 : 1,
    maxLevel: 5, upgradeCost: maxed ? null : 100, canUpgrade: !locked && !maxed }] };
  const gesture = new Proxy({}, { get: () => () => gesture });
  const Screen = load("../app/(tabs)/base.tsx", { react, "react-native": { ...native, Alert: { alert: (...args) => alerts.push(args) } },
    "expo-secure-store": {}, "expo-router": { useFocusEffect: fn => { focus = fn; } }, "@expo/vector-icons/MaterialCommunityIcons": "Icon",
    "react-native-gesture-handler": { Gesture: gesture, GestureDetector: "Gesture" },
    "../../src/api/client": { apiError, api: {
      get: async route => { calls.push(["GET", route]); if (blockedRead) throw new Error("offline"); return { data: world }; },
      post: async (route, body) => { calls.push(["POST", route, body]); if (deferPost) await deferPost;
        if (failPost) throw new Error("offline"); world = { ...world, worldPoints: 312, buildings: [{ ...world.buildings[0], level: 2, currentLevel: 2 }] };
        return { data: { upgraded: true, building: { buildingId: "workshop", name: "Workshop", oldLevel: 1, newLevel: 2, maxLevel: 5 } } }; },
    } }, "../../src/api/routes": { apiRoutes }, "../../src/base/buildingProgress": progress,
    "../../src/base/buildingAssetRegistry": { BASE_BACKGROUND_IMAGES: { tiledGround: "ground" }, getBuildingImageSource: () => "art" },
    "../../src/base/mapAssetRegistry": { DECORATION_IMAGES: {}, getPathTileSource: () => "path" }, "../../src/base/pathNetwork": { buildPathNetwork: () => [] },
    "../../src/components/BuildingUpgradeFeedback": { default: "Celebration", BuildingTierArtwork: "Artwork", useBuildingUpgradePresentation: () => ({}) },
    "../../src/components/BasePanels": { BaseBuildingPanel: "Panel", BaseResources: "Resources" },
    "../../src/context/CompletionFeedbackContext": { useBuildingFeedback: () => ({ pending: undefined, enqueue: batch => batches.push(batch), finish() {} }) },
    "../../src/storage/localAccountData": { BASE_LAYOUT_STORAGE_KEY: "layout" }, "../../src/theme/theme": theme,
  }).default;
  function render() { index = 0; effects = []; return Screen(); }
  render(); focus(); render(); effects.find(fn => String(fn).includes("if (focused)"))(); await tick();
  const select = () => { find(render(), "BuildingNode").props.onPress(); return find(render(), "Panel"); };
  return { render, select, calls, alerts, batches, blockRead(value) { blockedRead = value; } };
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
