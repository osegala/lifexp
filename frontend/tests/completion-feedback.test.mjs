import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";
import * as feedback from "../src/feedback/completion.ts";
import * as buildings from "../src/base/buildingProgress.ts";
import * as theme from "../src/theme/theme.ts";
import * as scheduling from "../src/tasks/scheduling.ts";
import { apiError } from "../src/api/errors.ts";
import { levelInfo } from "../../backend/layers/api-shared/nodejs/leveling.mjs";

const { completionEvent, completionFrame, completionAnnouncement, completionQueue, EMPTY_COMPLETION_QUEUE } = feedback;
const task = id => ({ taskId: id, title: `Task ${id}`, taskSize: "NORMAL", xpReward: 35, coinReward: 4,
  repeatType: "NONE", repeatDays: [], active: true, archived: false, completedToday: false, isScheduledToday: true, isDueToday: true });
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
  StyleSheet: { create: value => value }, Alert: { alert() {} },
  AppState: { currentState: "active", addEventListener: () => ({ remove() {} }) } };
const tick = () => new Promise(setImmediate);

function goals(daily = 2, weekly = 9, days = 7) {
  const goal = (current, target, worldPoints) => ({ current, target, progressPercent: Math.min(100, current / target * 100),
    completed: current >= target, reward: { worldPoints, granted: current >= target,
      ...(current >= target ? { earnedWorldPoints: worldPoints } : {}) } });
  return { date: "2026-10-05", week: "2026-W41", timeZone: "America/New_York", refreshAfterMs: 60_000,
    player: { worldPoints: 412 }, daily: { tasks: goal(daily, 3, 32) }, weekly: { tasks: goal(weekly, 15, 113) },
    streak: { currentDays: days, longestDays: days, completedToday: daily > 0 } };
}

test("quest cards render server progress, preview/granted states, activity streak and accessible labels without color/motion", () => {
  const Quests = load("../src/components/QuestProgress.tsx", { "react-native": native,
    "../theme/theme": theme, "./LifeCard": "LifeCard", "./XPBar": "XPBar" });
  function expand(tree) {
    if (Array.isArray(tree)) return tree.map(expand);
    if (!tree?.props) return tree;
    if (typeof tree.type === "function") return expand(tree.type(tree.props));
    return { ...tree, props: { ...tree.props, children: expand(tree.props.children) } };
  }
  for (const [daily, weekly, days] of [[0, 0, 1], [2, 9, 7], [3, 15, 8]]) {
    const tree = expand(Quests({ goals: goals(daily, weekly, days) }));
    assert.match(text(tree), new RegExp(`${daily} / 3`));
    assert.match(text(tree), new RegExp(`${weekly} / 15`));
    assert.match(text(tree), new RegExp(`${days} ${days === 1 ? "day" : "days"}`));
    assert.match(text(tree), /America\/New_York/);
    assert.match(text(tree), daily < 3 ? /Reward: \+32 World Points/ : /✓ Complete.*\+32 World Points earned/);
    assert.match(text(tree), weekly < 15 ? /Reward: \+113 World Points/ : /✓ Complete.*\+113 World Points earned/);
    assert.ok(nodes(tree).some(node => node.props.accessibilityLabel?.includes(`Daily Quest, ${daily} of 3 tasks completed.`)));
    assert.ok(nodes(tree).some(node => node.props.accessibilityLabel?.includes(`Weekly Quest, ${weekly} of 15 tasks completed.`)));
    assert.ok(nodes(tree).some(node => node.props.accessibilityLabel?.includes(`Daily activity streak, ${days} days.`)));
  }
  const oldServer = goals(3, 15);
  delete oldServer.streak;
  delete oldServer.daily.tasks.reward.earnedWorldPoints;
  const tree = expand(Quests({ goals: oldServer }));
  assert.match(text(tree), /Reward granted/);
  assert.match(text(tree), /Streak status is not available/);
  assert.doesNotMatch(text(tree), /32 World Points earned/);
});

test("quest celebrations use only awarded flags and first-day activity, not counts, previews or task streaks", () => {
  const data = response();
  assert.deepEqual(feedback.questCompletionMessages(data), []);
  data.goalRewards = { daily: { awarded: false, worldPoints: 32 }, weekly: { awarded: false, worldPoints: 113 } };
  data.activityStreak = { currentDays: 8, longestDays: 8, completedToday: true, increased: false };
  assert.deepEqual(feedback.questCompletionMessages(data), []);
  data.goalRewards.daily.awarded = true;
  data.goalRewards.weekly.awarded = true;
  data.activityStreak.increased = true;
  assert.deepEqual(feedback.questCompletionMessages(data), [
    "Daily Quest Complete · +32 World Points", "Weekly Quest Complete · +113 World Points", "8 Day Streak · Today counts"
  ]);
  const event = completionEvent(data);
  let queue = completionQueue(EMPTY_COMPLETION_QUEUE, { type: "enqueue", event });
  queue = completionQueue(queue, { type: "finish", id: event.id });
  assert.equal(completionQueue(queue, { type: "enqueue", event }), queue, "duplicate response cannot replay quest bonuses");
  assert.match(completionAnnouncement(event), /Daily Quest Complete.*Weekly Quest Complete.*8 Day Streak/);
});

async function dashboard(readGoals) {
  const h = hooks();
  let focus, appState, removed = false, refreshKey = 0;
  const Screen = load("../app/(tabs)/dashboard.tsx", {
    react: h.react, "react-native": { ...native, AppState: { currentState: "active",
      addEventListener: (_, fn) => { appState = fn; return { remove: () => { removed = true; } }; } } },
    "expo-router": { router: {}, useFocusEffect: fn => { focus = fn; } },
    "@expo/vector-icons/MaterialCommunityIcons": "Icon",
    "../../src/api/client": { apiError, api: { get: async route => ({ data: route === "goals" ? await readGoals() : { summary: { earned: 0, total: 0 } } }) } },
    "../../src/api/routes": { apiRoutes: { goals: "goals", achievements: "achievements" } },
    "../../src/components/LifeCard": "LifeCard", "../../src/components/XPBar": "XPBar", "../../src/components/QuestProgress": "Quests",
    "../../src/context/AuthContext": { useAuth: () => ({ user: {}, refreshUser: async () => true, dashboardRefreshKey: refreshKey }) },
    "../../src/theme/theme": theme
  });
  const render = () => h.render(Screen);
  render(); let cleanup = focus(); await tick();
  return { render, state: value => appState(value), dispose: () => cleanup(), removed: () => removed,
    refocus: async () => { cleanup(); refreshKey++; render(); cleanup = focus(); await tick(); } };
}

test("Home keeps last confirmed quests/balance when refresh fails; focus and foreground reload, blur stops polling", async t => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let calls = 0, failed = false;
  const snapshot = goals();
  const ui = await dashboard(async () => { calls++; if (failed) throw new Error("offline"); return snapshot; });
  assert.equal(nodes(ui.render()).find(node => node.type === "Quests").props.goals, snapshot);
  failed = true;
  t.mock.timers.tick(60_000); await tick();
  assert.equal(calls, 2);
  assert.equal(nodes(ui.render()).find(node => node.type === "Quests").props.goals, snapshot);
  assert.match(text(ui.render()), /Showing last confirmed progress/);
  assert.match(text(ui.render()), /412/);
  assert.ok(nodes(ui.render()).some(node => node.props.accessibilityRole === "alert"));
  failed = false; ui.state("active"); await tick();
  assert.doesNotMatch(text(ui.render()), /Could not refresh/);
  await ui.refocus(); assert.equal(calls, 4);
  ui.dispose(); const finalCalls = calls;
  t.mock.timers.tick(120_000); await tick();
  assert.equal(calls, finalCalls); assert.equal(ui.removed(), true);
});

test("Home never fabricates zero progress on initial failure and honors server midnight delay", async t => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let calls = 0;
  const ui = await dashboard(async () => {
    calls++;
    if (calls === 1) throw new Error("offline");
    return { ...goals(calls === 2 ? 3 : 0), refreshAfterMs: 1200 };
  });
  assert.equal(nodes(ui.render()).some(node => node.type === "Quests"), false);
  assert.match(text(ui.render()), /Could not load quests/);
  t.mock.timers.tick(60_000); await tick();
  assert.equal(nodes(ui.render()).find(node => node.type === "Quests").props.goals.daily.tasks.current, 3);
  t.mock.timers.tick(1199); await tick(); assert.equal(calls, 2);
  t.mock.timers.tick(1); await tick(); assert.equal(calls, 3);
  assert.equal(nodes(ui.render()).find(node => node.type === "Quests").props.goals.daily.tasks.current, 0);
  ui.dispose();
});

async function tasksScreen(post, { refreshUser = async () => {}, readWorld = async () => world(1) } = {}) {
  const h = hooks(), events = [], calls = [], buildingEvents = [];
  let focus, refreshes = 0;
  const tasks = [task("one"), task("two")];
  const Screen = load("../app/(tabs)/tasks.tsx", {
    "../../src/tasks/saveTask": { saveTask: () => assert.fail("completion must not create tasks") },
    react: h.react, "react-native": native,
    "@expo/vector-icons/MaterialCommunityIcons": "Icon",
    "expo-router": { useFocusEffect: fn => { focus = fn; } },
    "../../src/api/client": { apiError, api: {
      get: async route => ({ data: route === "world" ? await readWorld() : { tasks: [...tasks], time: {}, summary: {} } }),
      post: async (route, body) => {
        calls.push({ route, body });
        const data = await post(route);
        tasks[tasks.findIndex(t => t.taskId === data.task.taskId)] = data.task;
        return { data };
      },
    } },
    "../../src/api/routes": { apiRoutes: { tasks: "tasks", world: "world", completeTask: id => `tasks/${id}/complete` } },
    "../../src/base/buildingProgress": buildings,
    "../../src/feedback/completion": feedback,
    "../../src/components/LifeButton": "LifeButton", "../../src/components/LifeCard": "LifeCard", "../../src/components/LifeInput": "LifeInput",
    "../../src/components/TaskEditor": "TaskEditor", "../../src/tasks/scheduling": scheduling,
    "../../src/context/AuthContext": { useAuth: () => ({ refreshUser, triggerDashboardRefresh: () => refreshes++ }) },
    "../../src/context/CompletionFeedbackContext": { useCompletionFeedback: () => event => events.push(event),
      useBuildingFeedback: () => ({ enqueue: batch => buildingEvents.push(batch) }) },
    "../../src/theme/theme": theme,
  });
  const render = () => h.render(Screen);
  render(); const cleanup = focus(); await tick(); cleanup();
  const button = id => nodes(render()).find(n => n.props.accessibilityLabel === `Complete Task ${id}`);
  return { render, button, events, buildingEvents, calls, refreshes: () => refreshes,
    showAll: () => nodes(render()).find(n => n.props.accessibilityLabel === "All tasks").props.onPress() };
}

test("task action waits for server success, guards same-tick taps, and survives refresh failure", async () => {
  let resolve;
  const ui = await tasksScreen(() => new Promise(done => { resolve = done; }), {
    refreshUser: async () => { throw new Error("offline refresh"); },
  });
  const press = ui.button("one").props.onPress;
  press(); press();
  await tick(); // The authoritative before-world read precedes POST.
  assert.deepEqual(ui.calls, [{ route: "tasks/one/complete", body: {} }]);
  assert.equal(ui.events.length, 0);
  assert.equal(ui.button("one").props.children.props.name, "check");
  const data = response(); resolve(data); await tick();
  assert.deepEqual(ui.events, [data]);
  assert.equal(ui.button("one"), undefined, "completed task no longer appears in Today");
  ui.showAll();
  assert.equal(ui.button("one").props.children.props.name, "check-circle");
  assert.equal(ui.button("one").props.disabled, true);
  assert.equal(ui.refreshes(), 1);
});

test("failed and already-completed requests never emit success or optimistic rewards", async () => {
  for (const error of [new Error("offline"), { response: { data: { error: { code: "TASK_ALREADY_COMPLETED", message: "Already completed" } } } }]) {
    const ui = await tasksScreen(async () => { throw error; });
    ui.button("one").props.onPress(); await tick();
    assert.equal(ui.events.length, 0);
    assert.equal(ui.buildingEvents.length, 0);
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
  const data = response("level", 90, 20);
  data.goalRewards = { daily: { awarded: true, worldPoints: 32 }, weekly: { awarded: true, worldPoints: 113 } };
  data.activityStreak = { currentDays: 8, longestDays: 8, completedToday: true, increased: true };
  data.player.worldPoints = 412;
  const event = completionEvent(data);
  const render = () => h.render(() => Card({ event, onDone: id => done.push(id) }));
  render(); const cleanupAccessibility = h.effects[0](); await tick();
  render(); const cleanupAnimation = h.effects[1]();
  const tree = render();
  assert.equal(starts, 0);
  assert.match(text(tree), /Level Up!.*Level 2/);
  assert.match(text(tree), /37 coins total/);
  assert.match(text(tree), /Daily Quest Complete · \+32 World Points/);
  assert.match(text(tree), /Weekly Quest Complete · \+113 World Points/);
  assert.match(text(tree), /8 Day Streak/);
  assert.match(text(tree), /412 World Points total/);
  assert.equal(nodes(tree).find(n => n.type === "Scene").props.reducedMotion, true);
  assert.deepEqual(announced, [completionAnnouncement(event)]);
  t.mock.timers.tick(5499); assert.deepEqual(done, []);
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
  const buildingContext = tree => nodes(tree).find(n => n.props.value?.enqueue)?.props.value;
  assert.equal(text(announce(first)), "");
  assert.equal(announce(first).props["aria-live"], "polite");
  assert.equal(announce(first).props["aria-atomic"], true);
  first.props.value(response("one")); first.props.value(response("two"));
  buildingContext(first).enqueue({ id: "upgrade", upgrades: buildings.buildingUpgrades(world(1), world(2)) });
  assert.equal(buildingContext(render()).pending, undefined, "building feedback waits for completion feedback");
  assert.equal(current(render()).event.response.task.taskId, "one");
  assert.match(text(announce(render())), /Task one completed/);
  current(render()).onDone(current(render()).event.id);
  assert.equal(current(render()).event.response.task.taskId, "two");
  current(render()).onDone(current(render()).event.id);
  assert.equal(current(render()), undefined);
  assert.equal(text(announce(render())), "");
  assert.equal(buildingContext(render()).pending.id, "upgrade", "unconsumed event survives until World focuses");
  buildingContext(render()).finish("upgrade");
  assert.equal(buildingContext(render()).pending, undefined);
});

function world(workshopLevel, gardenLevel = 1) {
  return { worldPoints: 500, buildings: [["workshop", "Workshop", workshopLevel], ["garden", "Garden", gardenLevel]].map(([buildingId, name, currentLevel]) => ({
    buildingId, name, currentLevel, level: currentLevel, maxLevel: 5, upgradeCost: 100, canUpgrade: true,
  })) };
}

test("world diff uses stored building levels, ignores unchanged/decreased/missing tiers and keeps every increase", () => {
  assert.deepEqual(buildings.buildingUpgrades(world(1), world(1)), []);
  assert.deepEqual(buildings.buildingUpgrades(world(3), world(2)), []);
  assert.deepEqual(buildings.buildingUpgrades(null, world(2)), []);
  assert.deepEqual(buildings.buildingUpgrades(world(1), null), []);
  assert.deepEqual(buildings.buildingUpgrades({ buildings: [] }, world(2)), []);
  for (const [from, to] of [[1, 2], [2, 3], [4, 5]]) {
    const changes = buildings.buildingUpgrades(world(from), world(to));
    assert.deepEqual(changes, [{ buildingId: "workshop", buildingName: "Workshop", previousTier: from, newTier: to }]);
    assert.equal(buildings.worldToBaseProgress(world(to)).buildings[0].visualTier, to);
  }
  assert.equal(buildings.buildingUpgrades(world(1, 2), world(2, 3)).length, 2);
  assert.deepEqual(buildings.buildingUpgrades(world(5), world(6)), [], "visual tier remains capped at the existing five images");
  assert.deepEqual(buildings.confirmedBuildingUpgrade({ upgraded: true,
    building: { buildingId: "workshop", name: "Workshop", oldLevel: 2, newLevel: 3 } }), buildings.buildingUpgrades(world(2), world(3)));
});

test("building batches share session dedupe, preserve rapid upgrades, and never replay after consumption or refresh", () => {
  const first = { id: "task-one", upgrades: buildings.buildingUpgrades(world(1, 1), world(2, 2)) };
  let state = completionQueue(EMPTY_COMPLETION_QUEUE, { type: "buildings", batch: first });
  assert.equal(state.buildings[0].upgrades.length, 2);
  assert.equal(completionQueue(state, { type: "buildings", batch: first }), state);
  state = completionQueue(state, { type: "buildings", batch: { ...first, id: "manual-same-upgrade" } });
  assert.equal(state.buildings.length, 1, "same server transition from a different source is not replayed");
  state = completionQueue(state, { type: "buildings", batch: { id: "task-two", upgrades: buildings.buildingUpgrades(world(2), world(3)) } });
  state = completionQueue(state, { type: "finishBuildings", id: first.id });
  assert.equal(state.buildings[0].id, "task-two");
  assert.equal(completionQueue(state, { type: "finishBuildings", id: first.id }), state, "stale timer cannot consume another batch");
  state = completionQueue(state, { type: "finishBuildings", id: "task-two" });
  state = completionQueue(state, { type: "buildings", batch: { ...first, id: "late-response" } });
  assert.deepEqual(state.buildings, []);
  assert.deepEqual(EMPTY_COMPLETION_QUEUE.buildings, [], "refresh/account change starts without any persisted celebration");
});

test("task success compares ordered authoritative snapshots, including multiple upgrades and unavailable world", async () => {
  const order = [];
  let reads = 0;
  const ui = await tasksScreen(async () => { order.push("post"); return response(); }, {
    readWorld: async () => { order.push("world"); return reads++ ? world(2, 3) : world(1, 2); },
  });
  ui.button("one").props.onPress(); await tick();
  assert.deepEqual(order, ["world", "post", "world"]);
  assert.deepEqual(ui.buildingEvents[0], { id: completionEvent(response()).id, upgrades: buildings.buildingUpgrades(world(1, 2), world(2, 3)) });
  for (const failedRead of [0, 1]) {
    let attempts = 0;
    const offline = await tasksScreen(async () => response(), { readWorld: async () => {
      if (attempts++ === failedRead) throw new Error("offline world");
      return world(3);
    } });
    offline.button("one").props.onPress(); await tick();
    assert.equal(offline.events.length, 1, "world read failure cannot undo earned task rewards");
    assert.deepEqual(offline.buildingEvents[0].upgrades, []);
  }
  const noChange = await tasksScreen(async () => response("one", 90, 1000));
  noChange.button("one").props.onPress(); await tick();
  assert.deepEqual(noChange.buildingEvents[0].upgrades, [], "even a multiple-level player increase cannot invent a building upgrade");
});

function buildingUI(h, { reduced = false, announced = [], animations = [], values = [] } = {}, exportName = "default") {
  return load("../src/components/BuildingUpgradeFeedback.tsx", {
    react: h.react,
    "react-native": { ...native, Image: "Image", Platform: { OS: "ios" }, Easing: { inOut: v => v, quad: 0 },
      AccessibilityInfo: { isReduceMotionEnabled: async () => reduced, addEventListener: () => ({ remove() {} }), announceForAccessibility: value => announced.push(value) },
      Animated: { View: "AnimatedView", Image: "AnimatedImage", Value: class {
        setValue(value) { values.push(value); }
        interpolate(config) { return config; }
      }, timing: (_, config) => ({ start() { animations.push(config); }, stop() {} }) },
    },
    "../base/buildingAssetRegistry": { getBuildingImageSource: (name, tier) => `${name}/tier-${tier}.png` },
    "../base/buildingProgress": buildings, "../theme/theme": theme,
  }, exportName);
}

test("building reveal uses actual old/new tiers; reduced motion and final render have no animated transforms", () => {
  const h = hooks();
  const Art = buildingUI(h, {}, "BuildingTierArtwork");
  const upgrade = buildings.buildingUpgrades(world(4), world(5))[0];
  const motion = { reducedMotion: false, progress: { interpolate: config => config } };
  const render = (change, reducedMotion = false) => Art({ type: "Workshop", tier: 5, upgrade: change, motion: { ...motion, reducedMotion } });
  const images = nodes(render(upgrade)).filter(n => n.type === "AnimatedImage");
  assert.deepEqual(images.map(n => n.props.source), ["Workshop/tier-4.png", "Workshop/tier-5.png"]);
  assert.equal(images[0].props.style.at(-1).opacity.outputRange.at(-1), 0);
  assert.equal(images[1].props.style.at(-1).opacity.outputRange.at(-1), 1);
  for (const tree of [render(undefined), render(upgrade, true)]) {
    assert.equal(tree.type, "Image");
    assert.equal(tree.props.source, "Workshop/tier-5.png");
    assert.equal(tree.props.resizeMode, "contain");
    assert.deepEqual(tree.props.style, { width: "100%", height: "100%" });
  }
});

test("world presentation announces all upgrades, lasts 2.8s, and cancels timers when World blurs", async t => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const batch = { id: "batch", upgrades: buildings.buildingUpgrades(world(1, 2), world(2, 3)) };
  for (const reduced of [true, false]) {
    const h = hooks(), announced = [], animations = [], done = [], values = [];
    const usePresentation = buildingUI(h, { reduced, announced, animations, values }, "useBuildingUpgradePresentation");
    const onDone = id => done.push(id);
    const render = active => h.render(() => usePresentation(active, onDone));
    render(undefined); const cleanupA11y = h.effects[0](); await tick();
    render(undefined); assert.equal(h.effects[1](), undefined, "off-world queue cannot animate/consume");
    render(batch); const cleanup = h.effects[1]();
    assert.equal(animations.length, reduced ? 0 : 1);
    assert.deepEqual(announced, ["Workshop reached Tier 2. Garden reached Tier 3"]);
    assert.equal(values.at(-1), reduced ? 1 : 0);
    t.mock.timers.tick(2799); assert.deepEqual(done, []);
    t.mock.timers.tick(1); assert.deepEqual(done, [batch.id]);
    cleanup();
    render(batch); const blur = h.effects[1](); blur();
    t.mock.timers.tick(3000); assert.deepEqual(done, [batch.id], "blur must not consume a queued batch");
    cleanupA11y();
  }
});
