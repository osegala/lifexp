import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
import * as progress from "../src/onboarding/progress.ts";
import { authDestination } from "../src/auth/destination.ts";
import * as appearance from "../src/avatar/appearance.ts";
import * as theme from "../src/theme/theme.ts";
import { apiRoutes } from "../src/api/routes.ts";
import { apiError } from "../src/api/errors.ts";
const require = createRequire(import.meta.url);
const input = { title: "Read", description: null, taskSize: "NORMAL", repeatType: "NONE", repeatDays: [], startDate: null, dueTime: null };
const tick = () => new Promise(setImmediate);
function loader(path, imports) {
  const exports = {};
  const code = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } }).outputText;
  new Function("require", "exports", code)(id => id === "react/jsx-runtime" ? require(id) : id in imports ? imports[id] : (() => { throw new Error(`Missing ${id}`); })(), exports);
  return exports;
}

test("all six steps have one optional local progress record per authenticated user, never a completion flag", () => {
  assert.deepEqual(progress.STEPS, ["Welcome", "Avatar", "Starter tasks", "Reminders", "How progress works", "You’re ready"]);
  assert.deepEqual(progress.readProgress(null), { step: 0, taskIds: [] });
  const saved = { step: 2, taskIds: ["first"], pendingTask: { requestId: "stable-key", input } };
  assert.deepEqual(progress.readProgress(JSON.stringify(saved)), saved);
  assert.notEqual(progress.progressKey("old-sub"), progress.progressKey("new-sub"));
  for (const raw of ["not-json", '{"step":20,"taskIds":[]}', '{"step":2,"taskIds":[1]}']) assert.throws(() => progress.readProgress(raw));
  assert.equal(authDestination("token", { onboardingCompleted: true }), "/(tabs)/dashboard");
  assert.equal(authDestination("token", { onboardingCompleted: false }), "/onboarding");
});

test("starter task lost response, interruption and retry confirm one ID rather than creating a second task", async () => {
  let stored = { step: 2, taskIds: [] }, lost = true, next = 0; const server = new Map(), calls = [];
  const persist = async value => { stored = structuredClone(value); };
  const save = async (body, id, key) => {
    calls.push([body, id, key]);
    if (!server.has(key)) server.set(key, `task-${++next}`);
    if (lost) { lost = false; throw new Error("timeout after commit"); }
    return server.get(key);
  };
  const add = () => progress.saveStarterTask(progress.readProgress(JSON.stringify(stored)), input, undefined, save, persist, () => "request-1");
  await assert.rejects(add(), /timeout/); assert.equal(stored.taskIds.length, 0); assert.ok(stored.pendingTask);
  assert.equal(await add(), "task-1"); assert.equal(server.size, 1); assert.deepEqual(stored.taskIds, ["task-1"]);
  assert.equal(stored.pendingTask, undefined); assert.equal(calls[0][2], calls[1][2]);
});

test("failed local retry-key persistence prevents creation; failed confirmation persistence remains replayable", async () => {
  let sent = 0;
  await assert.rejects(progress.saveStarterTask(progress.emptyProgress(), input, undefined, async () => { sent++; }, async () => { throw new Error("storage"); }, () => "id"));
  assert.equal(sent, 0);
  let stored, writes = 0;
  await assert.rejects(progress.saveStarterTask(progress.emptyProgress(), input, undefined, async () => "task-1", async value => {
    if (++writes === 2) throw new Error("storage after server save"); stored = value;
  }, () => "id"));
  assert.equal(stored.pendingTask.requestId, "id"); assert.deepEqual(stored.taskIds, []);
});

test("task title is not a dedupe key and reminder retries update the returned ID", async () => {
  let stored = progress.emptyProgress(), serial = 0; const calls = [];
  const save = async (body, id, key) => { calls.push([body, id, key]); return id ?? key; };
  const persist = async value => { stored = value; };
  for (let i = 0; i < 3; i++) await progress.saveStarterTask(stored, input, undefined, save, persist, () => `id-${++serial}`);
  assert.equal(stored.taskIds.length, 3);
  await progress.saveStarterTask(stored, input, "id-1", save, persist, () => assert.fail("no create key"));
  assert.deepEqual(calls.at(-1).slice(1), ["id-1", undefined]); assert.equal(stored.taskIds.length, 3);
});

test("editing a draft after ambiguous creation first replays original payload, then updates the same task", async () => {
  const calls = [], stored = { step: 2, taskIds: [], pendingTask: { requestId: "stable", input } };
  await progress.saveStarterTask(stored, { ...input, title: "Read chapter two" }, undefined,
    async (...args) => { calls.push(args); return "task-1"; }, async () => {}, () => assert.fail("must reuse"));
  assert.deepEqual(calls[0], [input, undefined, "stable"]);
  assert.deepEqual(calls[1], [{ ...input, title: "Read chapter two" }, "task-1"]);
});

test("finish requires successful true PATCH and profile refresh; every failure remains retryable", async () => {
  let refreshed = 0;
  await assert.rejects(progress.finishOnboarding(async () => { throw new Error("offline"); }, async () => { refreshed++; return true; }));
  assert.equal(refreshed, 0);
  await assert.rejects(progress.finishOnboarding(async () => ({ onboardingCompleted: false }), async () => true), /not confirmed/);
  await assert.rejects(progress.finishOnboarding(async () => ({ onboardingCompleted: true }), async () => false), /could not refresh/);
  await progress.finishOnboarding(async () => ({ onboardingCompleted: true }), async () => { refreshed++; return true; });
  assert.equal(refreshed, 1);
});

function hooks() {
  let cursor = 0; const state = [], effects = [];
  const same = (a, b) => a && b && a.length === b.length && a.every((value, i) => value === b[i]);
  const react = {
    useState(initial) { const i = cursor++; if (!(i in state)) state[i] = typeof initial === "function" ? initial() : initial;
      return [state[i], value => { state[i] = typeof value === "function" ? value(state[i]) : value; }]; },
    useRef: value => react.useState({ current: value })[0],
    useCallback(fn, deps) { const i = cursor++; if (!same(state[i]?.deps, deps)) state[i] = { deps, fn }; return state[i].fn; },
    useEffect(fn, deps) { const i = cursor++; if (!same(state[i], deps)) { state[i] = deps; effects.push(fn); } },
  };
  return { react, render(fn) { cursor = 0; const tree = fn(); while (effects.length) effects.shift()(); return tree; } };
}
const nodes = tree => Array.isArray(tree) ? tree.flatMap(nodes) : tree?.props
  ? [tree, ...nodes(typeof tree.type === "function" ? tree.type(tree.props) : tree.props.children)] : [];
const text = tree => typeof tree === "string" || typeof tree === "number" ? String(tree) : Array.isArray(tree) ? tree.map(text).join("") : tree?.props ? text(tree.props.children) : "";
async function screen({ storage = new Map(), failAvatar = false, failFinish = false, failLoad = false, platform = "web" } = {}) {
  const h = hooks(), calls = [], cached = []; let complete = false, serial = 0;
  const auth = { user: { id: "new", timeZone: "UTC", onboardingCompleted: false },
    refreshUser: async () => { auth.user.onboardingCompleted = complete; return true; }, logout: async () => { calls.push(["logout"]); } };
  const Screen = loader("../app/onboarding.tsx", { react: h.react, "react-native-get-random-values": {},
    "@react-native-async-storage/async-storage": { getItem: async key => storage.get(key) ?? null, setItem: async (key, value) => storage.set(key, value) },
    "react-native": { ...Object.fromEntries(["ActivityIndicator", "Pressable", "ScrollView", "Text", "View"].map(x => [x, x])),
      StyleSheet: { create: x => x }, Platform: { OS: platform }, AccessibilityInfo: {}, findNodeHandle: () => null },
    "../src/api/client": { apiError, api: {
      get: async route => { if (failLoad) throw new Error("offline"); return { data: route === apiRoutes.me ? appearance.DEFAULT_APPEARANCE : { time: { date: "2026-10-07", weekday: "WED", timeZone: "UTC" }, tasks: [] } }; },
      patch: async (route, body) => { calls.push([route, body]); if (body.onboardingCompleted ? failFinish : failAvatar) throw new Error("offline");
        if (body.onboardingCompleted) complete = true; return { data: body }; },
    } }, "../src/api/routes": { apiRoutes }, "../src/context/AuthContext": { useAuth: () => auth },
    "../src/avatar/appearance": appearance, "../src/avatar/localAppearance": { setLocalAppearance: async (...args) => cached.push(args) },
    "../src/components/AppearanceEditor": "Appearance", "../src/components/AvatarRenderer": "Avatar",
    "../src/components/TaskEditor": "TaskEditor", "../src/components/NotificationSettings": "Notifications",
    "../src/tasks/saveTask": { saveTask: async (body, id, key) => { calls.push(["task", body, id, key]); return id ?? `task-${++serial}`; } },
    "../src/onboarding/progress": progress, "../src/theme/theme": theme,
  }).Onboarding;
  const render = () => h.render(() => Screen({ userId: "new" }));
  render(); await tick(); render(); await tick();
  return { render, calls, cached, auth, storage,
    setFailure: value => { failAvatar = failFinish = failLoad = value; },
    press: async label => { const b = nodes(render()).find(n => n.type === "Pressable" && n.props.accessibilityLabel === label); assert.ok(b, `Button ${label}`); assert.ok(!b.props.disabled); b.props.onPress(); await tick(); render(); await tick(); },
    child: name => nodes(render()).find(n => n.type === name)?.props,
  };
}
const at = (step, extra = {}) => new Map([[progress.progressKey("new"), JSON.stringify({ step, taskIds: [], ...extra })]]);

test("real onboarding welcome, keep-default-avatar, skipped tasks/reminders, tutorial and finish use existing systems", async () => {
  const ui = await screen(); assert.match(text(ui.render()), /Welcome/); assert.equal(ui.calls.length, 0);
  await ui.press("Get Started"); assert.deepEqual(ui.child("Appearance").appearance, appearance.DEFAULT_APPEARANCE);
  assert.equal(ui.child("Appearance").dirty, false);
  await ui.press("Keep saved look / skip"); assert.equal(ui.child("TaskEditor").suggestions.length, 7);
  await ui.press("Skip tasks for now"); assert.equal(ui.child("Notifications").timeZone, "UTC");
  assert.match(text(ui.render()), /iOS\/Android/);
  await ui.press("Continue / skip reminders"); assert.match(text(ui.render()), /XP and coins.*Daily and Weekly Quests.*World Points/s);
  await ui.press("Continue to finish"); assert.equal(ui.auth.user.onboardingCompleted, false);
  await ui.press("Enter Evrenthia"); assert.equal(ui.auth.user.onboardingCompleted, true);
  assert.deepEqual(ui.calls, [[apiRoutes.me, { onboardingCompleted: true }]]);
});

test("avatar failure preserves draft and step; retry saves canonical fields and local per-user cache", async () => {
  const ui = await screen({ storage: at(1), failAvatar: true });
  ui.child("Appearance").onChange({ bodyType: "GIRL", skinColorId: "skin_16" });
  assert.equal(ui.child("Appearance").dirty, true);
  await ui.press("Save appearance & continue"); assert.equal(ui.child("Appearance").appearance.skinColorId, "skin_16");
  assert.ok(nodes(ui.render()).some(n => n.props.accessibilityRole === "alert")); assert.equal(ui.cached.length, 0);
  ui.setFailure(false); await ui.press("Save appearance & continue");
  assert.equal(ui.cached[0][0], "new"); assert.equal(ui.cached[0][1].bodyType, "GIRL");
  assert.equal(progress.readProgress(ui.storage.get(progress.progressKey("new"))).step, 2);
});

test("one then three explicitly confirmed starter tasks persist returned IDs across remount without creating on load", async () => {
  const ui = await screen({ storage: at(2) });
  assert.equal(ui.calls.length, 0);
  for (let i = 0; i < 3; i++) {
    await ui.child("TaskEditor").onSave(input); assert.match(text(ui.render()), new RegExp(`${i + 1} task`));
  }
  const resumed = await screen({ storage: ui.storage });
  assert.match(text(resumed.render()), /3 tasks saved/); assert.equal(resumed.calls.length, 0);
  await resumed.press("Continue to reminders");
});

test("unfinished creation is never auto-submitted after reload; user can retry or skip", async () => {
  const ui = await screen({ storage: at(2, { pendingTask: { requestId: "persisted-request-id", input } }) });
  assert.equal(ui.calls.length, 0); assert.match(text(ui.render()), /save was interrupted/);
  await ui.press("Retry interrupted task"); assert.equal(ui.calls[0][3], "persisted-request-id"); assert.match(text(ui.render()), /1 task saved/);
  assert.equal(ui.child("TaskEditor").time.timeZone, "UTC");
});

test("final save failure stays on Finish and succeeds only after retry; loading failure exposes recovery", async () => {
  const ui = await screen({ storage: at(5), failFinish: true });
  await ui.press("Enter Evrenthia"); assert.equal(ui.auth.user.onboardingCompleted, false);
  assert.match(text(ui.render()), /You’re ready/); assert.ok(nodes(ui.render()).some(n => n.props.accessibilityRole === "alert"));
  ui.setFailure(false); await ui.press("Enter Evrenthia"); assert.equal(ui.auth.user.onboardingCompleted, true);
  const failed = await screen({ failLoad: true }); assert.equal(failed.child("Appearance"), undefined);
  failed.setFailure(false); await failed.press("Retry setup"); assert.match(text(failed.render()), /Welcome/);
});

test("step buttons have screen-reader names, 48-point targets, focusable headings, wrapping layout and no motion", async () => {
  for (const step of [0, 1, 2, 3, 4, 5]) {
    const ui = await screen({ storage: at(step) });
    for (const b of nodes(ui.render()).filter(n => n.type === "Pressable")) {
      assert.ok(b.props.accessibilityLabel); assert.equal(b.props.accessibilityRole, "button");
      assert.ok(b.props.style({ pressed: false })[0].minHeight >= 44);
    }
    assert.ok(nodes(ui.render()).some(n => n.props.accessibilityRole === "header" && n.props.tabIndex === -1));
  }
  const source = readFileSync(new URL("../app/onboarding.tsx", import.meta.url), "utf8");
  assert.match(source, /animated: false/); assert.doesNotMatch(source, /Animated|LayoutAnimation|setTimeout/);
  assert.match(source, /width: "100%", maxWidth: 680/);
  const layout = readFileSync(new URL("../app/_layout.tsx", import.meta.url), "utf8");
  assert.match(layout, /Stack.Protected guard=\{destination === "\/onboarding"\}/);
  assert.match(layout, /Stack.Protected guard=\{destination === "\/\(tabs\)\/dashboard"\}/);
});

test("real root guards protect every main route while onboarding is incomplete and retain recovery UI on failure", () => {
  let session;
  const Stack = Object.assign(({ children }) => children, { Screen: "Screen", Protected: ({ guard, children }) => guard ? children : null });
  const Root = loader("../app/_layout.tsx", {
    "expo-router": { Stack }, "react-native": { View: "View", ActivityIndicator: "Spinner", StyleSheet: { create: x => x } },
    "react-native-gesture-handler": { GestureHandlerRootView: "Gestures" },
    "react-native-safe-area-context": { SafeAreaProvider: "SafeAreaProvider", SafeAreaView: "SafeAreaView" },
    "../src/context/AuthContext": { AuthProvider: "AuthProvider", useAuth: () => session },
    "../src/components/SessionRecovery": "Recovery", "../src/theme/theme": theme, "../src/auth/destination": { authDestination },
  }).default;
  const screens = () => nodes(Root()).filter(n => n.type === "Screen").map(n => n.props.name);
  session = { token: "token", user: { onboardingCompleted: false }, loading: false };
  assert.deepEqual(screens(), ["index", "onboarding"]);
  session.user.onboardingCompleted = true;
  assert.deepEqual(screens(), ["index", "(tabs)", "base-interior", "social-base", "modal"]);
  session = { token: "token", user: null, sessionError: "offline", loading: false };
  assert.deepEqual(screens(), []); assert.ok(nodes(Root()).some(n => n.type === "Recovery" && n.props.fullScreen));
  session = { token: "token", user: null, loading: true };
  assert.deepEqual(screens(), []); assert.ok(nodes(Root()).some(n => n.type === "Spinner"));
  session = { token: null, user: null, loading: false };
  assert.deepEqual(screens(), ["index", "login", "register"]);
});

test("account-local cleanup removes only this user's onboarding retry record alongside existing caches", async () => {
  const removed = [];
  const cleanup = loader("../src/storage/localAccountData.ts", {
    "expo-secure-store": { deleteItemAsync: async key => removed.push(key) },
    "react-native": { Platform: { OS: "ios" } }, "../avatar/localAppearance": { clearLocalAppearance: async id => removed.push(`appearance:${id}`) },
    "@react-native-async-storage/async-storage": { removeItem: async key => removed.push(key) }, "../onboarding/progress": progress,
  }).clearLocalAccountData;
  await cleanup("old-sub"); assert.ok(removed.includes(progress.progressKey("old-sub")));
  assert.ok(!removed.includes(progress.progressKey("new-sub")));
});
