import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import * as theme from "../src/theme/theme.ts";
import * as inventoryHelpers from "../src/avatar/inventory.ts";
import * as appearance from "../src/avatar/appearance.ts";
import * as scheduling from "../src/tasks/scheduling.ts";
import { apiRoutes } from "../src/api/routes.ts";
import { apiError } from "../src/api/errors.ts";

const require = createRequire(import.meta.url);
const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
function load(path, imports) {
  const exports = {};
  const code = ts.transpileModule(read(path), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } }).outputText;
  new Function("exports", "require", code)(exports, id => {
    if (id === "react/jsx-runtime") return require(id);
    assert.ok(id in imports, `Unexpected import: ${id}`);
    return imports[id];
  });
  return exports;
}
function hooks() {
  let index = 0;
  const values = [];
  const react = {
    useState(initial) {
      const i = index++;
      if (!(i in values)) values[i] = typeof initial === "function" ? initial() : initial;
      return [values[i], value => { values[i] = typeof value === "function" ? value(values[i]) : value; }];
    },
    useRef: initial => react.useState({ current: initial })[0],
    useCallback: fn => fn,
  };
  return { react, render: fn => { index = 0; return fn(); } };
}
const native = { View: "View", Text: "Text", Image: "Image", StyleSheet: { create: value => value, absoluteFill: { position: "absolute" } } };
const nodes = tree => Array.isArray(tree) ? tree.flatMap(nodes) : tree?.props ? [tree, ...nodes(tree.props.children)] : [];
const text = tree => Array.isArray(tree) ? tree.map(text).join(" ") : tree?.props ? text(tree.props.children)
  : typeof tree === "string" || typeof tree === "number" ? String(tree) : "";
const find = (tree, type) => nodes(tree).filter(node => node.type === type);
const tick = () => new Promise(setImmediate);
const { homeAvatarFromInventory } = load("../src/home/avatar.ts", { "../avatar/inventory": inventoryHelpers });
const item = (itemId, assetKey, category = "background") => ({ itemId, assetKey, category, name: itemId, equipped: false });
function inventory(background = "garden") {
  return { equipped: { background, tunic: "top", pants: null, boots: null, hair: null, hat: null, pet: null, aura: null },
    items: [item("garden", "avatar-v2/backgrounds/castle-garden"), item("library", "avatar-v2/backgrounds/grand-library"),
      item("top", "forest-tunic.png", "tunic"), item("unselected", "unused")] };
}
const task = (taskId, title, dueTime, patch = {}) => ({ taskId, title, dueTime, active: true, archived: false,
  isDueToday: true, completedToday: false, xpReward: 35, coinReward: 4, ...patch });
const taskData = { tasks: [task("z", "Zulu", "18:00"), task("b", "Beta", "09:00"), task("a", "Alpha", "09:00"),
  task("future", "Future", "08:00", { isDueToday: false, nextScheduledDate: "2040-03-01" }),
  task("archived", "Archived", "08:00", { archived: true }), task("inactive", "Inactive", "08:00", { active: false }),
  task("done", "Completed", "08:00", { isDueToday: false, completedToday: true }),
  task("untimed", "Untimed", null)],
  time: { date: "2040-02-29", weekday: "Wednesday", timeZone: "Pacific/Auckland" },
  summary: { dueToday: 4, completedToday: 1 } };
const user = { id: "account", username: "Actual name", coins: 739, level: 17, xpIntoLevel: 123, xpForNextLevel: 456, progressPercent: 27 };
const goals = { date: taskData.time.date, timeZone: taskData.time.timeZone, player: { worldPoints: 881 }, refreshAfterMs: 60000 };
const achievements = { achievements: [{ achievementId: "earned", name: "An earned achievement", earned: true,
  currentValue: 7, requiredValue: 7, description: "Actual description", rewards: [{ name: "Actual reward" }] }],
  summary: { earned: 1, total: 8 } };
function content() {
  const h = hooks(), sources = { garden: { uri: "garden.png" }, library: { uri: "library.png" } }, resolutions = [];
  const Home = load("../src/components/HomeContent.tsx", {
    react: h.react, "react-native": native, "../theme/theme": theme, "../tasks/scheduling": scheduling,
    "@expo/vector-icons/MaterialCommunityIcons": "Icon",
    "../avatar/assetRegistry": { getEquippedSceneSource: (cosmetics, id, type) => {
      resolutions.push({ cosmetics, id, type }); return sources[id];
    } },
    "./AvatarRenderer": "Avatar", "./LifeButton": "Button", "./QuestProgress": "Quests", "./XPBar": "XPBar",
    "./ui/Indicators": { ResourcePill: "Resource", ResourceCluster: "Resources", BadgePill: "Badge" },
    "./ui/Primitives": Object.fromEntries(["EmptyState", "ListRowCard", "ScreenShell", "SectionHeader", "SurfaceCard", "UiPressable", "UiText"].map(x => [x, x])),
  }).default;
  const defaults = { user, goals, achievements, tasks: taskData, scene: homeAvatarFromInventory(inventory(), appearance.DEFAULT_APPEARANCE),
    loading: false, tasksLoading: false, avatarLoading: false, questError: false,
    progressError: "", taskError: "", avatarError: "", onRetry() {}, onProfile() {}, onTasks() {}, ad: "banner-slot" };
  const render = patch => {
    const tree = Home({ ...defaults, ...patch });
    const sceneElement = nodes(tree).find(node => typeof node.type === "function");
    return { tree, scene: h.render(() => sceneElement.type(sceneElement.props)) };
  };
  return { render, defaults, resolutions, sources };
}

test("Home uses authoritative equipment slots and shared appearance/asset mapping, without loading the catalog", () => {
  const appearanceValue = { ...appearance.DEFAULT_APPEARANCE, bodyType: "GIRL", skinColorId: "skin_16", hairId: "avatar-v2/hair/box-braids" };
  const original = inventory();
  const scene = homeAvatarFromInventory(original, appearanceValue);
  assert.deepEqual(scene.avatar, inventoryHelpers.avatarFromInventory(original, appearanceValue));
  assert.deepEqual(scene.cosmetics.map(x => x.id), ["garden", "top"], "slot selection wins over stale item flags");
  assert.equal(scene.cosmetics.find(x => x.id === "top").imageUrl, "avatar-v2/tops/forest-ranger");
  assert.equal(homeAvatarFromInventory(inventory("library"), appearanceValue).avatar.equippedBackgroundId, "library");
  assert.doesNotMatch(read("../app/(tabs)/dashboard.tsx"), /apiRoutes\.shop|wardrobeCosmetics/);
});

test("equipped background changes reach the same resolver and only one unchanged avatar composition is mounted", () => {
  const c = content(), first = c.render();
  assert.equal(find(first.scene, "Avatar").length, 1);
  const renderer = find(first.scene, "Avatar")[0];
  assert.equal(renderer.props.showBackground, false, "scene rendered once outside the character");
  assert.equal(renderer.props.backgroundId, "garden");
  assert.equal(renderer.props.topId, "top");
  assert.equal(renderer.props.skinColorId, appearance.DEFAULT_APPEARANCE.skinColorId);
  assert.equal(find(first.scene, "Image")[0].props.source, c.sources.garden);
  assert.equal(find(first.scene, "Image")[0].props.resizeMode, "cover");
  const stale = c.render({ loading: true, avatarLoading: true, avatarError: "offline" });
  assert.deepEqual(find(stale.scene, "Avatar")[0].props, renderer.props, "refresh does not drop or replace the composition");
  const changed = c.render({ scene: homeAvatarFromInventory(inventory("library"), appearance.DEFAULT_APPEARANCE) });
  assert.equal(find(changed.scene, "Image")[0].props.source, c.sources.library);
  assert.equal(c.resolutions.at(-1).type, "BACKGROUND");
  assert.equal(c.resolutions.at(-1).id, "library");
  assert.equal(find(changed.scene, "Avatar").length, 1);
});

test("missing or failed scene assets keep the character and bounded stage, and a new source recovers", () => {
  const c = content();
  find(c.render().scene, "Image")[0].props.onError();
  const failed = c.render().scene;
  assert.equal(find(failed, "Image").length, 0);
  assert.equal(find(failed, "Avatar").length, 1);
  assert.match(text(failed), /Equipped background unavailable/);
  assert.equal(failed.props.style.minHeight, 320);
  assert.equal(find(c.render({ scene: homeAvatarFromInventory(inventory("library"), appearance.DEFAULT_APPEARANCE) }).scene, "Image").length, 1);
  const missing = c.render({ scene: homeAvatarFromInventory(inventory("missing"), appearance.DEFAULT_APPEARANCE) }).scene;
  assert.match(text(missing), /Equipped background unavailable/);
  const none = c.render({ scene: homeAvatarFromInventory(inventory(null), appearance.DEFAULT_APPEARANCE) }).scene;
  assert.doesNotMatch(text(none), /unavailable/);
});

test("Today uses canonical eligibility and ordering, previews three rows, and rows navigate without completing", () => {
  const c = content(); let navigations = 0;
  const { tree } = c.render({ onTasks: () => navigations++ });
  const rows = find(tree, "ListRowCard");
  assert.deepEqual(rows.map(x => x.props.title), scheduling.tasksForView(taskData.tasks, "Today", taskData.time.date).slice(0, 3).map(x => x.title));
  assert.deepEqual(rows.map(x => x.key), ["a", "b", "z"]);
  for (const row of rows) row.props.onPress();
  find(tree, "Button").find(x => x.props.title === "View all tasks").props.onPress();
  assert.equal(navigations, 4);
  assert.ok(nodes(tree).some(x => x.props.subtitle?.includes(taskData.time.date)));
  assert.doesNotMatch(read("../app/(tabs)/dashboard.tsx") + read("../src/components/HomeContent.tsx"),
    /api\.(post|patch|put|delete)|completeTask\(|useCompletionFeedback|new Date\(/);
});

test("real currencies, XP, achievement rewards, Profile and final banner placement are preserved", () => {
  const c = content(); let profile = 0;
  const { tree } = c.render({ onProfile: () => profile++ });
  assert.deepEqual(find(tree, "Resource").map(x => [x.props.resource, x.props.value]), [["coins", 739], ["worldPoints", 881]]);
  assert.equal(find(tree, "XPBar")[0].props.progress, 0.27);
  assert.ok(find(tree, "Badge").some(x => x.props.label === "Level 17"));
  assert.match(text(tree), /123\s+\/\s+456\s+XP/);
  assert.match(text(tree), /Actual reward/);
  assert.equal(find(tree, "Quests")[0].props.goals, goals);
  assert.equal(find(tree, "Quests")[0].props.tone, "parchment");
  find(tree, "UiPressable").find(x => x.props.accessibilityLabel === "Open Profile").props.onPress();
  assert.equal(profile, 1);
  assert.equal(tree.props.children.at(-1), "banner-slot");
});

test("loading/errors never fabricate data or a clear schedule; stale content and retry remain accessible", () => {
  const c = content(); let retries = 0;
  const { tree, scene } = c.render({ user: null, goals: null, achievements: null, tasks: null, scene: null,
    loading: true, tasksLoading: true, avatarLoading: true });
  assert.deepEqual(find(tree, "Resource").map(x => x.props.value), ["—", "—"]);
  assert.match(text(tree), /Loading your tasks/);
  assert.match(text(scene), /Loading your character/);
  assert.equal(find(scene, "Avatar").length, 0);
  assert.equal(find(tree, "EmptyState").length, 0);
  const failed = c.render({ questError: true, taskError: "offline", avatarError: "Character refresh failed", onRetry: () => retries++ }).tree;
  assert.match(text(failed), /Showing last confirmed progress/);
  assert.equal(find(failed, "ListRowCard").length, 3);
  assert.equal(find(failed, "Quests")[0].props.goals, goals);
  assert.ok(nodes(failed).filter(x => x.props.accessibilityRole === "alert").length >= 3);
  find(failed, "Button").find(x => x.props.title === "Refresh Home").props.onPress();
  assert.equal(retries, 1);
  const empty = c.render({ tasks: { ...taskData, tasks: [] } }).tree;
  assert.match(find(empty, "EmptyState")[0].props.description, /completed tasks are saved/);
});

async function controller() {
  const h = hooks(), calls = [], navigation = [], cache = [];
  let focus, appState, cleanup;
  const data = { [apiRoutes.tasks]: taskData, [apiRoutes.goals]: goals, [apiRoutes.achievements]: achievements,
    [apiRoutes.inventory]: inventory(), [apiRoutes.me]: appearance.DEFAULT_APPEARANCE };
  const failures = new Set();
  let profileOk = true;
  const Screen = load("../app/(tabs)/dashboard.tsx", {
    react: h.react, "react-native": { Alert: { alert() {} }, AppState: { currentState: "active",
      addEventListener: (_, fn) => { appState = fn; return { remove() {} }; } } },
    "expo-router": { useFocusEffect: fn => { focus = fn; }, router: { navigate: route => navigation.push(route) } },
    "../../src/ads/Ads": { BannerAdPlacement: "Banner" },
    "../../src/api/client": { apiError, api: { get: async route => {
      calls.push(route); if (failures.has(route)) throw new Error("offline");
      return { data: await data[route] };
    } } },
    "../../src/api/routes": { apiRoutes }, "../../src/avatar/appearance": appearance,
    "../../src/avatar/localAppearance": { getLocalAppearance: async () => appearance.DEFAULT_APPEARANCE, setLocalAppearance: async (...args) => cache.push(args) },
    "../../src/components/HomeContent": "HomeContent",
    "../../src/context/AuthContext": { useAuth: () => ({ user, refreshUser: async () => profileOk }) },
    "../../src/home/avatar": { homeAvatarFromInventory },
  }).default;
  const render = () => h.render(Screen).props;
  render(); cleanup = focus(); await tick();
  return { render, calls, navigation, data, failures, cache,
    setProfile: value => { profileOk = value; },
    foreground: async () => { appState("active"); await tick(); },
    retry: async () => { render().onRetry(); await tick(); },
    refocus: async () => { cleanup(); render(); cleanup = focus(); await tick(); }, dispose: () => cleanup() };
}

test("Home refocus/resume reads equipped state again, retries retain snapshots, and navigation reaches existing routes", async t => {
  const c = await controller(); t.after(c.dispose);
  assert.equal(c.render().scene.avatar.equippedBackgroundId, "garden");
  assert.deepEqual(c.cache[0], ["account", appearance.DEFAULT_APPEARANCE]);
  c.data[apiRoutes.inventory] = inventory("library");
  await c.refocus();
  assert.equal(c.render().scene.avatar.equippedBackgroundId, "library");
  const lastScene = c.render().scene;
  for (const route of [apiRoutes.inventory, apiRoutes.tasks, apiRoutes.goals, apiRoutes.achievements]) c.failures.add(route);
  await c.retry();
  assert.equal(c.render().scene, lastScene);
  assert.equal(c.render().tasks, taskData);
  assert.equal(c.render().goals, goals);
  assert.equal(c.render().achievements, achievements);
  assert.ok(c.render().questError && c.render().taskError && c.render().avatarError && c.render().progressError);
  c.failures.clear();
  await c.retry();
  assert.equal(c.render().taskError, ""); assert.equal(c.render().avatarError, ""); assert.equal(c.render().progressError, "");
  c.data[apiRoutes.inventory] = inventory("garden"); await c.foreground();
  assert.equal(c.render().scene.avatar.equippedBackgroundId, "garden");
  c.render().onTasks(); c.render().onProfile();
  assert.deepEqual(c.navigation, ["/(tabs)/tasks", "/(tabs)/profile"]);
  assert.equal(c.render().ad.props.placement, "HOME");
  assert.ok(c.calls.every(route => [apiRoutes.me, apiRoutes.inventory, apiRoutes.goals, apiRoutes.tasks, apiRoutes.achievements].includes(route)));
});

test("profile refresh failure stays recoverable and blur ignores late task/equipment responses", async t => {
  const c = await controller(); t.after(c.dispose);
  c.setProfile(false); const last = c.render();
  await c.retry();
  assert.match(c.render().progressError, /Could not refresh your profile/);
  assert.equal(c.render().scene, last.scene);
  assert.equal(c.render().tasksLoading, false);
  assert.equal(c.render().avatarLoading, false);
  c.setProfile(true);
  let resolve;
  c.data[apiRoutes.inventory] = new Promise(done => { resolve = done; });
  c.render().onRetry(); await tick(); c.dispose();
  resolve(inventory("library")); await tick();
  assert.equal(c.render().scene, last.scene, "late reads cannot update a blurred screen");
});
