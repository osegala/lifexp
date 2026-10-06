import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";
import * as scheduling from "../src/tasks/scheduling.ts";
import * as theme from "../src/theme/theme.ts";
import { apiError } from "../src/api/errors.ts";

const require = createRequire(import.meta.url);
function load(path, imports) {
  const exports = {};
  const code = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText;
  new Function("exports", "require", code)(exports, id => {
    if (id === "react/jsx-runtime") return require(id);
    if (!(id in imports)) throw new Error(`Unmocked import: ${id}`);
    return imports[id];
  });
  return exports.default;
}
function hooks() {
  let cursor = 0;
  const state = [];
  const react = { useState: initial => {
    const key = cursor++;
    if (!(key in state)) state[key] = typeof initial === "function" ? initial() : initial;
    return [state[key], value => { state[key] = typeof value === "function" ? value(state[key]) : value; }];
  }, useRef: initial => react.useState({ current: initial })[0], useCallback: fn => fn };
  return { react, render: fn => { cursor = 0; return fn(); } };
}
const native = { ...Object.fromEntries(["ActivityIndicator", "Pressable", "ScrollView", "Text", "View"].map(name => [name, name])),
  StyleSheet: { create: value => value }, Alert: { alert() {} } };
const nodes = tree => Array.isArray(tree) ? tree.flatMap(nodes) : tree?.props ? [tree, ...nodes(tree.props.children)] : [];
const text = tree => typeof tree === "string" || typeof tree === "number" ? String(tree) : Array.isArray(tree) ? tree.map(text).join("") : tree?.props ? text(tree.props.children) : "";
const button = (tree, label) => nodes(tree).find(node => node.type === "Pressable" && (node.props.accessibilityLabel === label || text(node) === label));
const field = (tree, label) => nodes(tree).find(node => node.type === "Input" && node.props.accessibilityLabel.startsWith(label));
const tick = () => new Promise(setImmediate);
const time = { date: "2026-10-05", weekday: "MON", timeZone: "America/New_York" };
const task = (id, extra = {}) => ({ taskId: id, title: id, description: null, repeatType: "NONE", repeatDays: [], taskSize: "NORMAL",
  active: true, completed: false, isScheduledToday: true, isDueToday: true, completedToday: false,
  xpReward: 35, coinReward: 4, currentStreak: 0, bestStreak: 0, ...extra });

function editor({ initial, save = async () => {} } = {}) {
  const h = hooks(), submissions = [];
  const Editor = load("../src/components/TaskEditor.tsx", { react: h.react, "react-native": native, "../api/client": { apiError },
    "../theme/theme": theme, "../tasks/scheduling": scheduling, "./LifeInput": "Input" });
  const render = () => h.render(() => Editor({ task: initial, time, disabled: false, onSave: async value => { submissions.push(value); await save(value); } }));
  if (!initial) button(render(), "Schedule options").props.onPress();
  return { render, submissions, press: label => button(render(), label).props.onPress(),
    input: (label, value) => field(render(), label).props.onChangeText(value) };
}

test("editor offers all five repeat options with accessible selection and full weekday labels", () => {
  const ui = editor();
  for (const label of ["Never", "Daily", "Weekly", "Monthly", "Custom weekdays"]) {
    const choice = button(ui.render(), `Repeat: ${label}`);
    assert.equal(choice.props.accessibilityRole, "button");
    assert.equal(choice.props.accessibilityState.selected, label === "Never");
  }
  ui.press("Repeat: Custom weekdays");
  for (const day of scheduling.DAY_NAMES) assert.equal(button(ui.render(), day).props.accessibilityRole, "checkbox");
  ui.press("Monday"); ui.press("Wednesday"); ui.press("Friday"); ui.press("Wednesday");
  assert.equal(button(ui.render(), "Wednesday").props.accessibilityState.checked, false);
  assert.equal(button(ui.render(), "Friday").props.accessibilityState.checked, true);
});

test("creation sends existing DAILY/WEEKLY rules, monthly anchor and optional wall time without rewards or device timezone", async () => {
  for (const [choice, repeatType] of [["Never", "NONE"], ["Daily", "DAILY"], ["Weekly", "WEEKLY"], ["Monthly", "MONTHLY"], ["Custom weekdays", "WEEKLY"]]) {
    const ui = editor();
    ui.input("Task title", " Read "); ui.press(`Repeat: ${choice}`);
    if (choice === "Custom weekdays") { ui.press("Monday"); ui.press("Wednesday"); ui.press("Friday"); }
    ui.input("Due time", "09:30");
    ui.press("Add task"); await tick();
    assert.equal(ui.submissions.length, 1);
    const saved = ui.submissions[0];
    assert.equal(saved.repeatType, repeatType); assert.equal(saved.title, "Read"); assert.equal(saved.dueTime, "09:30");
    assert.deepEqual(saved.repeatDays, choice === "Custom weekdays" ? ["MON", "WED", "FRI"] : choice === "Weekly" ? ["MON"] : []);
    assert.equal(saved.startDate, choice === "Monthly" ? time.date : null);
    assert.equal(saved.taskSize, "NORMAL"); assert.equal(saved.timeZone, undefined); assert.equal(saved.xpReward, undefined);
    assert.equal(field(ui.render(), "Task title").props.value, "");
  }
});

test("edit initializes saved fields, weekly chooses one day, and recurrence removal clears weekdays", async () => {
  const ui = editor({ initial: task("Read", { repeatType: "WEEKLY", repeatDays: ["MON", "WED"], startDate: "2026-10-05", dueTime: "12:30" }) });
  assert.equal(button(ui.render(), "Repeat: Custom weekdays").props.accessibilityState.selected, true);
  assert.equal(field(ui.render(), "Due time").props.value, "12:30");
  ui.press("Repeat: Weekly"); ui.press("Friday");
  assert.equal(button(ui.render(), "Monday").props.accessibilityState.checked, false);
  ui.press("Repeat: Never"); ui.press("Save changes"); await tick();
  assert.equal(ui.submissions[0].repeatType, "NONE"); assert.deepEqual(ui.submissions[0].repeatDays, []);
});

test("invalid calendar dates/times/weekdays never submit and failed saves retain the complete draft", async () => {
  const ui = editor({ save: async () => { throw new Error("offline"); } });
  ui.input("Task title", "Draft"); ui.input("Due date", "2026-02-30"); ui.press("Add task"); await tick();
  assert.equal(ui.submissions.length, 0); assert.match(text(ui.render()), /valid date/);
  ui.input("Due date", "2026-02-28"); ui.input("Due time", "24:00"); ui.press("Add task"); await tick();
  assert.equal(ui.submissions.length, 0); assert.match(text(ui.render()), /24-hour time/);
  ui.input("Due time", "08:00"); ui.press("Repeat: Custom weekdays"); ui.press("Add task"); await tick();
  assert.equal(ui.submissions.length, 0); assert.match(text(ui.render()), /at least one weekday/);
  ui.press("Monday"); ui.press("Add task"); await tick();
  assert.equal(ui.submissions.length, 1); assert.equal(field(ui.render(), "Task title").props.value, "Draft");
  assert.equal(field(ui.render(), "Start date").props.value, "2026-02-28");
  assert.equal(field(ui.render(), "Due time").props.value, "08:00");
  assert.ok(nodes(ui.render()).some(node => node.props.accessibilityRole === "alert"));
});

test("same-tick save taps are guarded and editor adds no animation or reduced-motion override", async () => {
  let finish;
  const ui = editor({ save: () => new Promise(resolve => { finish = resolve; }) });
  ui.input("Task title", "Read");
  const press = button(ui.render(), "Add task").props.onPress;
  press(); press();
  assert.equal(ui.submissions.length, 1); assert.equal(button(ui.render(), "Saving…").props.disabled, true);
  finish(); await tick();
  assert.doesNotMatch(readFileSync(new URL("../src/components/TaskEditor.tsx", import.meta.url), "utf8"), /Animated|setInterval|setTimeout|AccessibilityInfo/);
});

test("labels and Today/Upcoming use server availability, date and chronological wall times", () => {
  assert.equal(scheduling.recurrenceLabel(task("one")), "Does not repeat");
  assert.equal(scheduling.recurrenceLabel(task("one", { repeatType: "DAILY" })), "Daily");
  assert.equal(scheduling.recurrenceLabel(task("one", { repeatType: "WEEKLY", repeatDays: ["MON"] })), "Every Monday");
  assert.equal(scheduling.recurrenceLabel(task("one", { repeatType: "WEEKLY", repeatDays: ["FRI", "MON", "WED"] })), "Mon, Wed, Fri");
  assert.equal(scheduling.recurrenceLabel(task("one", { repeatType: "MONTHLY", startDate: "2026-01-31" })), "Monthly · day 31");
  const tasks = [task("today"), task("inactive", { active: false }), task("archived", { archived: true }),
    task("late", { isDueToday: false, isScheduledToday: false, nextScheduledDate: "2026-10-06", dueTime: "16:00" }),
    task("soon", { isDueToday: false, isScheduledToday: false, nextScheduledDate: "2026-10-06", dueTime: "09:00" }),
    task("future", { isDueToday: false, isScheduledToday: false, nextScheduledDate: "2026-10-31" }),
    task("done", { repeatType: "DAILY", isDueToday: false, completedToday: true, nextScheduledDate: "2026-10-07" })];
  assert.deepEqual(scheduling.tasksForView(tasks, "Today", time.date).map(task => task.taskId), ["today"]);
  assert.deepEqual(scheduling.tasksForView(tasks, "Upcoming", time.date).map(task => task.taskId), ["soon", "late", "done", "future"]);
  assert.equal(scheduling.tasksForView(tasks, "All", time.date).length, 6);
});

async function screen({ get, post = async () => ({}), patch = async () => ({}) }) {
  const h = hooks(), calls = [], events = [];
  let focus, resume;
  const Screen = load("../app/(tabs)/tasks.tsx", {
    react: h.react, "react-native": { ...native, AppState: { currentState: "active", addEventListener: (_, listener) => { resume = listener; return { remove() {} }; } } },
    "expo-router": { useFocusEffect: fn => { focus = fn; } }, "@expo/vector-icons/MaterialCommunityIcons": "Icon",
    "../../src/api/client": { apiError, api: { get: async route => ({ data: await get(route) }),
      post: async (route, input) => { calls.push(["POST", route, input]); return { data: await post(route, input) }; },
      patch: async (route, input) => { calls.push(["PATCH", route, input]); return { data: await patch(route, input) }; } } },
    "../../src/api/routes": { apiRoutes: { tasks: "tasks", world: "world", task: id => `tasks/${id}`, completeTask: id => `tasks/${id}/complete` } },
    "../../src/components/LifeCard": "Card", "../../src/components/TaskEditor": "Editor", "../../src/tasks/scheduling": scheduling,
    "../../src/context/AuthContext": { useAuth: () => ({ refreshUser: async () => {}, triggerDashboardRefresh() {} }) },
    "../../src/context/CompletionFeedbackContext": { useCompletionFeedback: () => value => events.push(value), useBuildingFeedback: () => ({ enqueue() {} }) },
    "../../src/base/buildingProgress": { buildingUpgrades: () => [] }, "../../src/feedback/completion": { completionEvent: () => ({ id: "event" }) },
    "../../src/theme/theme": theme,
  });
  const render = () => h.render(Screen);
  render(); const cleanup = focus(); await tick();
  return { render, calls, events, cleanup, resume: () => resume("active"), press: label => button(render(), label).props.onPress(),
    editor: () => nodes(render()).find(node => node.type === "Editor" && !!node.props.task)?.props,
    create: () => nodes(render()).find(node => node.type === "Editor" && !node.props.task)?.props };
}

test("Tasks creates/edits through existing routes, renders due time, and refreshes server dates on poll/resume", async t => {
  t.mock.timers.enable({ apis: ["setInterval"] });
  let serverDate = time.date, fail = false;
  const row = task("Read", { repeatType: "DAILY", startDate: time.date, dueTime: "09:30", nextScheduledDate: "2026-10-06" });
  const ui = await screen({ get: async () => { if (fail) throw new Error("offline"); return { time: { ...time, date: serverDate }, summary: {}, tasks: [row] }; } });
  t.after(ui.cleanup);
  assert.match(text(ui.render()), /Daily · 09:30/);
  assert.match(text(ui.render()), /America\/New_York/);
  const input = { title: "Created", description: null, repeatType: "WEEKLY", repeatDays: ["MON", "WED"], startDate: time.date, dueTime: "08:00", taskSize: "NORMAL" };
  await ui.create().onSave(input);
  assert.deepEqual(ui.calls[0], ["POST", "tasks", { ...input, active: true }]);
  ui.press("Edit Read"); await ui.editor().onSave({ ...input, repeatType: "NONE", repeatDays: [] });
  assert.equal(ui.calls[1][0], "PATCH"); assert.equal(ui.calls[1][1], "tasks/Read"); assert.equal(ui.editor(), undefined);
  ui.press("Upcoming tasks"); assert.match(text(ui.render()), /Next: 2026-10-06/);
  assert.equal(button(ui.render(), "Complete Read").props.disabled, true);
  serverDate = "2026-10-06"; t.mock.timers.tick(60_000); await tick();
  assert.match(text(ui.render()), /2026-10-06/); assert.match(text(ui.render()), /No upcoming tasks/);
  ui.press("Today tasks"); fail = true; ui.resume(); await tick();
  assert.match(text(ui.render()), /Daily · 09:30/, "failed refresh keeps last known tasks");
  assert.ok(nodes(ui.render()).some(node => node.props.accessibilityRole === "alert"));
  assert.equal(ui.events.length, 0, "saving/refreshing never grants completion feedback");
});

test("real task action shows next recurring occurrence only after confirmed completion; repeat/failed requests never celebrate", async t => {
  let row = task("Daily", { repeatType: "DAILY", nextScheduledDate: time.date });
  let writes = 0;
  const ui = await screen({ get: async route => route === "world" ? { buildings: [] } : { time, summary: {}, tasks: [row] },
    post: async () => {
      if (++writes > 1) throw new Error("duplicate");
      row = { ...row, completedToday: true, isDueToday: false, nextScheduledDate: "2026-10-06" };
      return { task: row, time, rewards: { xp: 35, coins: 4 } };
    } });
  t.after(ui.cleanup);
  const complete = button(ui.render(), "Complete Daily").props.onPress;
  complete(); complete(); await tick();
  assert.equal(writes, 1); assert.equal(ui.events.length, 1);
  assert.equal(button(ui.render(), "Complete Daily"), undefined, "confirmed completion leaves Today immediately");
  ui.press("Upcoming tasks"); assert.match(text(ui.render()), /Daily/);
  assert.match(text(ui.render()), /Next: 2026-10-06/);
  assert.equal(button(ui.render(), "Complete Daily").props.disabled, true);
  assert.equal(ui.events.length, 1);
});
