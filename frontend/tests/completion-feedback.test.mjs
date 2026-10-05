import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";
import * as feedback from "../src/feedback/completion.ts";
import * as theme from "../src/theme/theme.ts";
import { apiError } from "../src/api/errors.ts";
import { levelInfo } from "../../backend/layers/api-shared/nodejs/leveling.mjs";

const { completionEvent, completionFrame, completionAnnouncement, completionQueue, EMPTY_COMPLETION_QUEUE } = feedback;
const task = id => ({ taskId: id, title: `Task ${id}`, taskSize: "NORMAL", xpReward: 35, coinReward: 4,
  repeatType: "NONE", repeatDays: [], active: true, archived: false, completedToday: false, isDueToday: true });
function response(id = "one", previousXp = 40, xp = 47) {
  const before = levelInfo(previousXp), after = levelInfo(previousXp + xp);
  return {
    task: { ...task(id), completedToday: true, isDueToday: false },
    rewards: { xp, coins: 7, worldPoints: 25 },
    progression: { ...after, totalXp: previousXp + xp, previousLevel: before.level,
      previous: { ...before, totalXp: previousXp }, leveledUp: after.level > before.level },
    player: { xp: previousXp + xp, coins: 37, level: after.level },
    time: { date: "2026-10-04", completedAt: "2026-10-04T12:00:00Z" }, newAchievements: [],
  };
}

test("feedback uses awarded XP/coins rather than the task's advisory base rewards", () => {
  const event = completionEvent(response());
  assert.match(completionAnnouncement(event), /47 XP and 7 coins earned/);
  assert.equal(event.previousCoins, 30);
  assert.equal(completionFrame(event, 0).coins, 30);
  assert.equal(completionFrame(event, 0.5).coins, 34);
  assert.equal(completionFrame(event, 1).coins, 37);
  assert.equal(completionFrame(event, 1).progress, 0.87);
  assert.equal(completionFrame(event, 1).leveledUp, false);
  assert.doesNotMatch(completionAnnouncement(event), /Level up|Achievement unlocked/);
});

test("XP fills through a variable-threshold level boundary and preserves exact overflow", () => {
  const event = completionEvent(response("level", 90, 20));
  assert.equal(completionFrame(event, 0).progress, 0.9);
  assert.ok(completionFrame(event, 0.499).progress > 0.999);
  assert.deepEqual(completionFrame(event, 0.5), { level: 2, progress: 0, coins: 34, leveledUp: true });
  assert.equal(completionFrame(event, 1).progress, 10 / levelInfo(110).xpForNextLevel);
  assert.match(completionAnnouncement(event), /Level up! Level 2/);
});

test("multiple crossed levels reset separately without a copied XP formula", () => {
  const event = completionEvent(response("multi", 90, 1000));
  const crossed = event.response.progression.level - event.previous.level;
  assert.ok(crossed > 1);
  for (let i = 1; i <= crossed; i++) {
    const frame = completionFrame(event, i / (crossed + 1));
    assert.equal(frame.level, event.previous.level + i);
    assert.equal(frame.progress, 0);
  }
  const final = event.response.progression;
  assert.equal(completionFrame(event, 1).progress, final.xpIntoLevel / final.xpForNextLevel);
});

test("only actual level increases and newly awarded achievements are announced", () => {
  const data = response();
  data.progression.leveledUp = true; // Never trust a flag over unchanged levels.
  data.newAchievements = [{ achievementId: "new", name: "First Steps" }];
  const event = completionEvent(data);
  assert.equal(completionFrame(event, 1).leveledUp, false);
  assert.doesNotMatch(completionAnnouncement(event), /Level up|owned|equipped/);
  assert.match(completionAnnouncement(event), /Achievement unlocked: First Steps/);
});

test("old response fallback accepts only a matching server profile snapshot", () => {
  const data = response();
  const previous = data.progression.previous;
  delete data.progression.previous;
  assert.deepEqual(completionEvent(data, previous).previous, previous);
  const stale = completionEvent(data, { ...previous, totalXp: 0 });
  assert.equal(stale.previous, undefined);
  assert.equal(completionFrame(stale, 0).progress, completionFrame(stale, 1).progress);
});

test("rapid events stay FIFO, duplicates never replay, and stale timers cannot drop the next event", () => {
  const first = completionEvent(response("first")), second = completionEvent(response("second"));
  let queue = completionQueue(EMPTY_COMPLETION_QUEUE, { type: "enqueue", event: first });
  queue = completionQueue(queue, { type: "enqueue", event: second });
  assert.deepEqual(queue.pending, [first, second]);
  assert.equal(completionQueue(queue, { type: "enqueue", event: first }), queue);
  queue = completionQueue(queue, { type: "finish", id: first.id });
  assert.deepEqual(queue.pending, [second]);
  assert.equal(completionQueue(queue, { type: "finish", id: first.id }), queue);
  assert.equal(completionQueue(queue, { type: "enqueue", event: first }), queue);
  const daily = response("daily");
  daily.task.repeatType = "DAILY";
  queue = completionQueue(queue, { type: "enqueue", event: completionEvent(daily) });
  daily.time = { ...daily.time, date: "2026-10-05" };
  queue = completionQueue(queue, { type: "enqueue", event: completionEvent(daily) });
  assert.equal(queue.pending.length, 3, "next-day recurring completions are distinct events");
});

const require = createRequire(import.meta.url);
function load(path, imports, exportName = "default") {
  const exports = {};
  const code = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText;
  new Function("exports", "require", code)(exports, id => {
    if (id === "react/jsx-runtime") return require(id);
    if (!(id in imports)) throw new Error(`Unmocked import: ${id}`);
    return imports[id];
  });
  return exports[exportName];
}
function hooks() {
  let cursor = 0;
  const state = [], effects = [];
  const react = {
    useState: initial => {
      const key = cursor++;
      if (!(key in state)) state[key] = typeof initial === "function" ? initial() : initial;
      return [state[key], value => { state[key] = typeof value === "function" ? value(state[key]) : value; }];
    },
    useRef: initial => react.useState({ current: initial })[0],
    useCallback: fn => fn,
    useEffect: fn => effects.push(fn),
  };
  return { react, effects, render: fn => { cursor = 0; effects.length = 0; return fn(); } };
}
function nodes(tree) {
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  return tree?.props ? [tree, ...nodes(tree.props.children)] : [];
}
const text = tree => typeof tree === "string" || typeof tree === "number" ? String(tree) : Array.isArray(tree)
  ? tree.map(text).join("") : tree?.props ? text(tree.props.children) : "";
const native = { ...Object.fromEntries(["ActivityIndicator", "Pressable", "ScrollView", "Text", "View"].map(name => [name, name])),
  StyleSheet: { create: value => value }, Alert: { alert() {} } };
const tick = () => new Promise(setImmediate);

async function tasksScreen(post, { refreshUser = async () => {} } = {}) {
  const h = hooks(), events = [], calls = [];
  let focus, refreshes = 0;
  const tasks = [task("one"), task("two")];
  const Screen = load("../app/(tabs)/tasks.tsx", {
    react: h.react, "react-native": native,
    "@expo/vector-icons/MaterialCommunityIcons": "Icon",
    "expo-router": { useFocusEffect: fn => { focus = fn; } },
    "../../src/api/client": { apiError, api: {
      get: async () => ({ data: { tasks: [...tasks], time: {}, summary: {} } }),
      post: async (route, body) => {
        calls.push({ route, body });
        const data = await post(route);
        tasks[tasks.findIndex(t => t.taskId === data.task.taskId)] = data.task;
        return { data };
      },
    } },
    "../../src/api/routes": { apiRoutes: { tasks: "tasks", completeTask: id => `tasks/${id}/complete` } },
    "../../src/components/LifeButton": "LifeButton", "../../src/components/LifeCard": "LifeCard", "../../src/components/LifeInput": "LifeInput",
    "../../src/context/AuthContext": { useAuth: () => ({ refreshUser, triggerDashboardRefresh: () => refreshes++ }) },
    "../../src/context/CompletionFeedbackContext": { useCompletionFeedback: () => event => events.push(event) },
    "../../src/theme/theme": theme,
  });
  const render = () => h.render(Screen);
  render(); focus(); await tick();
  const button = id => nodes(render()).find(n => n.props.accessibilityLabel === `Complete Task ${id}`);
  return { render, button, events, calls, refreshes: () => refreshes };
}

test("task action waits for server success, guards same-tick taps, and survives refresh failure", async () => {
  let resolve;
  const ui = await tasksScreen(() => new Promise(done => { resolve = done; }), {
    refreshUser: async () => { throw new Error("offline refresh"); },
  });
  const press = ui.button("one").props.onPress;
  press(); press();
  assert.deepEqual(ui.calls, [{ route: "tasks/one/complete", body: {} }]);
  assert.equal(ui.events.length, 0);
  assert.equal(ui.button("one").props.children.props.name, "check");
  const data = response(); resolve(data); await tick();
  assert.deepEqual(ui.events, [data]);
  assert.equal(ui.button("one").props.children.props.name, "check-circle");
  assert.equal(ui.button("one").props.disabled, true);
  assert.equal(ui.refreshes(), 1);
});

test("failed and already-completed requests never emit success or optimistic rewards", async () => {
  for (const error of [new Error("offline"), { response: { data: { error: { code: "TASK_ALREADY_COMPLETED", message: "Already completed" } } } }]) {
    const ui = await tasksScreen(async () => { throw error; });
    ui.button("one").props.onPress(); await tick();
    assert.equal(ui.events.length, 0);
    assert.equal(ui.button("one").props.children.props.name, "check");
    assert.equal(ui.button("one").props.disabled, false);
    assert.ok(nodes(ui.render()).some(n => n.props.accessibilityRole === "alert"));
  }
});

test("two confirmed task actions emit two distinct events without waiting for animation", async () => {
  const ui = await tasksScreen(async route => response(route.split("/")[1]));
  ui.button("one").props.onPress(); await tick();
  ui.button("two").props.onPress(); await tick();
  assert.deepEqual(ui.events.map(e => e.task.taskId), ["one", "two"]);
});

test("reduced motion shows final server values, announces accessibly, and cleans up", async t => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const h = hooks(), announced = [], done = [], values = [];
  let starts = 0, stops = 0, removed = 0;
  const Card = load("../src/components/CompletionFeedback.tsx", {
    react: h.react,
    "react-native": { ...native, Platform: { OS: "ios" }, Easing: { inOut: v => v, quad: 0 },
      AccessibilityInfo: { isReduceMotionEnabled: async () => true,
        addEventListener: () => ({ remove() {} }), announceForAccessibility: value => announced.push(value) },
      Animated: { Value: class { setValue(v) { values.push(v); } addListener() { return "listener"; } removeListener() { removed++; } },
        timing: () => ({ start() { starts++; }, stop() { stops++; } }) },
    },
    "../api/client": { api: {} }, "../api/routes": { apiRoutes: {} },
    "../feedback/completion": feedback, "../theme/theme": theme, "./CompletionScene": "Scene", "./XPBar": "XPBar",
  });
  const event = completionEvent(response("level", 90, 20));
  const render = () => h.render(() => Card({ event, onDone: id => done.push(id) }));
  render(); const cleanupAccessibility = h.effects[0](); await tick();
  render(); const cleanupAnimation = h.effects[1]();
  const tree = render();
  assert.equal(starts, 0);
  assert.match(text(tree), /Level Up!.*Level 2/);
  assert.match(text(tree), /37 coins total/);
  assert.equal(nodes(tree).find(n => n.type === "Scene").props.reducedMotion, true);
  assert.deepEqual(announced, [completionAnnouncement(event)]);
  t.mock.timers.tick(2799); assert.deepEqual(done, []);
  t.mock.timers.tick(1); assert.deepEqual(done, [event.id]);
  cleanupAnimation(); cleanupAccessibility();
  assert.equal(stops, 1); assert.equal(removed, 1); assert.equal(values.at(-1), 0);
});

test("normal motion animates confirmed totals and unmount cancels the old queue timer", async t => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const h = hooks(), animations = [], done = [];
  let update;
  const Card = load("../src/components/CompletionFeedback.tsx", {
    react: h.react,
    "react-native": { ...native, Platform: { OS: "web" }, Easing: { inOut: v => v, quad: 0 },
      AccessibilityInfo: { isReduceMotionEnabled: async () => false, addEventListener: () => ({ remove() {} }) },
      Animated: { Value: class { setValue() {} addListener(fn) { update = fn; return "listener"; } removeListener() {} },
        timing: (_, config) => ({ start() { animations.push(config); }, stop() {} }) },
    },
    "../api/client": { api: { get: async () => ({ data: { achievements: [
      { achievementId: "new", rewards: [{ name: "Forest Ranger Tunic" }] },
      { achievementId: "old", rewards: [{ name: "Old Reward" }] },
    ] } }) } },
    "../api/routes": { apiRoutes: { achievements: "/achievements" } },
    "../feedback/completion": feedback, "../theme/theme": theme, "./CompletionScene": "Scene", "./XPBar": "XPBar",
  });
  const data = response(); data.newAchievements = [{ achievementId: "new", name: "First Steps" }];
  const event = completionEvent(data);
  const render = () => h.render(() => Card({ event, onDone: id => done.push(id) }));
  render(); const cleanupAccessibility = h.effects[0](); const cleanupRewards = h.effects[2](); await tick();
  render(); const cleanupAnimation = h.effects[1]();
  assert.equal(animations.length, 1);
  assert.equal(animations[0].duration, 1800);
  update({ value: 1 });
  const tree = render();
  assert.match(text(tree), /37 coins total/);
  assert.match(text(tree), /Forest Ranger Tunic.*not automatically owned or equipped/);
  assert.doesNotMatch(text(tree), /Old Reward/);
  cleanupAnimation(); cleanupAccessibility(); cleanupRewards();
  t.mock.timers.tick(3000);
  assert.deepEqual(done, [], "dismiss/unmount must cancel automatic advance");
});

test("provider keeps the web live region mounted and coordinates FIFO display/dismiss", () => {
  const h = hooks();
  const Provider = load("../src/context/CompletionFeedbackContext.tsx", {
    react: { ...h.react, createContext: () => ({ Provider: "Provider" }), useMemo: fn => fn(),
      useReducer: (reducer, initial) => {
        const [state, set] = h.react.useState(initial);
        return [state, action => set(current => reducer(current, action))];
      } },
    "react-native": { ...native, Platform: { OS: "web" } },
    "../components/CompletionFeedback": "Feedback", "../feedback/completion": feedback,
  }, "CompletionFeedbackProvider");
  const render = () => h.render(() => Provider({ children: "Task screen" }));
  const announce = tree => nodes(tree).find(n => n.props.role === "status");
  const current = tree => nodes(tree).find(n => n.type === "Feedback")?.props;
  const first = render();
  assert.equal(text(announce(first)), "");
  assert.equal(announce(first).props["aria-live"], "polite");
  assert.equal(announce(first).props["aria-atomic"], true);
  first.props.value(response("one")); first.props.value(response("two"));
  assert.equal(current(render()).event.response.task.taskId, "one");
  assert.match(text(announce(render())), /Task one completed/);
  current(render()).onDone(current(render()).event.id);
  assert.equal(current(render()).event.response.task.taskId, "two");
  current(render()).onDone(current(render()).event.id);
  assert.equal(current(render()), undefined);
  assert.equal(text(announce(render())), "");
});
