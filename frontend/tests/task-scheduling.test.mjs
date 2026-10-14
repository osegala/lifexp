import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";
import * as scheduling from "../src/tasks/scheduling.ts";
import * as theme from "../src/theme/theme.ts";
import { apiError } from "../src/api/errors.ts";
import * as reminders from "../src/notifications/model.ts";

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
  return exports.default ?? exports;
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
const native = { Platform: { select: options => options.default }, ...Object.fromEntries(["ActivityIndicator", "Pressable", "ScrollView", "Text", "View"].map(name => [name, name])),
  StyleSheet: { create: value => value }, Alert: { alert() {} } };
const nodes = tree => Array.isArray(tree) ? tree.flatMap(nodes) : tree?.props ? [tree, ...nodes(tree.props.children)] : [];
const text = tree => typeof tree === "string" || typeof tree === "number" ? String(tree) : Array.isArray(tree) ? tree.map(text).join("") : tree?.props ? text(tree.props.children) : "";
const button = (tree, label) => nodes(tree).find(node => (node.type === "Pressable" && (node.props.accessibilityLabel === label || text(node) === label)) || (node.type === "FilterChip" && node.props.label === label.replace(/ tasks$/, "")));
const field = (tree, label) => nodes(tree).find(node => node.type === "Input" && node.props.accessibilityLabel.startsWith(label));
const tick = () => new Promise(setImmediate);
const time = { date: "2026-10-05", weekday: "MON", timeZone: "America/New_York" };
const task = (id, extra = {}) => ({ taskId: id, title: id, description: null, repeatType: "NONE", repeatDays: [], taskSize: "NORMAL",
  active: true, completed: false, isScheduledToday: true, isDueToday: true, completedToday: false,
  xpReward: 35, coinReward: 4, currentStreak: 0, bestStreak: 0, ...extra });

function editor({ initial, save = async () => {}, tone = "parchment" } = {}) {
  const h = hooks(), submissions = [];
  const Editor = load("../src/components/TaskEditor.tsx", { react: h.react, "react-native": native, "../api/client": { apiError },
    "../notifications/model": reminders, "../notifications/useTaskReminder": { useTaskReminder: () => ({ choice: "NONE", clock: "", save: async () => {}, reset() {} }) },
    "../theme/theme": theme, "../tasks/scheduling": scheduling, "./LifeInput": "Input", "./ui/Primitives": { UiPressable: "Pressable" } });
  const render = () => h.render(() => Editor({ task: initial, time, tone, disabled: false, onSave: async value => { submissions.push(value); await save(value); } }));
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
  assert.equal(button(ui.render(), "Wednesday").props["aria-checked"], false);
  assert.equal(button(ui.render(), "Friday").props["aria-checked"], true);
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

async function screen({ get, post = async () => ({}), patch = async () => ({}), remove = async () => ({}) }) {
  const h = hooks(), calls = [], events = [];
  let focus, resume;
  const taskApi = { post: async (route, input) => { calls.push(["POST", route, input]); return { data: await post(route, input) }; },
    patch: async (route, input) => { calls.push(["PATCH", route, input]); return { data: await patch(route, input) }; } };
  const saving = load("../src/tasks/saveTask.ts", { "../api/client": { api: taskApi },
    "../api/routes": { apiRoutes: { tasks: "tasks", task: id => `tasks/${id}` } } });
  const Content = load("../src/components/TasksContent.tsx", {
    react: h.react, "react-native": native, "@expo/vector-icons/MaterialCommunityIcons": "Icon",
    "../theme/theme": theme, "../tasks/scheduling": scheduling, "./LifeButton": "LifeButton",
    "./ui/Indicators": { BadgePill: "Badge" },
    "./ui/Primitives": { UiPressable: "Pressable", UiText: "Text", ScreenShell: "ScrollView", SurfaceCard: "Card",
      FilterChip: "FilterChip", SectionHeader: "SectionHeader", EmptyState: "EmptyState" },
  });
  const Screen = load("../app/(tabs)/tasks.tsx", {
    "../../src/components/TasksContent": "TasksContent",
    "../../src/tasks/saveTask": saving,
    react: h.react, "react-native": { ...native, AppState: { currentState: "active", addEventListener: (_, listener) => { resume = listener; return { remove() {} }; } } },
    "expo-router": { useFocusEffect: fn => { focus = fn; } }, "@expo/vector-icons/MaterialCommunityIcons": "Icon",
    "../../src/api/client": { apiError, api: { get: async route => ({ data: await get(route) }),
      post: async (route, input) => { calls.push(["POST", route, input]); return { data: await post(route, input) }; },
      patch: async (route, input) => { calls.push(["PATCH", route, input]); return { data: await patch(route, input) }; },
      delete: async route => { calls.push(["DELETE", route]); return { data: await remove(route) }; } } },
    "../../src/api/routes": { apiRoutes: { tasks: "tasks", world: "world", task: id => `tasks/${id}`, completeTask: id => `tasks/${id}/complete` } },
    "../../src/components/LifeCard": "Card", "../../src/components/TaskEditor": "Editor", "../../src/tasks/scheduling": scheduling,
    "../../src/context/AuthContext": { useAuth: () => ({ refreshUser: async () => {}, triggerDashboardRefresh() {} }) },
    "../../src/context/CompletionFeedbackContext": { useCompletionFeedback: () => value => events.push(value), useBuildingFeedback: () => ({ enqueue() {} }) },
    "../../src/base/buildingProgress": { buildingUpgrades: () => [] }, "../../src/feedback/completion": { completionEvent: () => ({ id: "event" }) },
    "../../src/theme/theme": theme,
  });
  const render = () => h.render(() => Content(Screen().props));
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
  ui.editor().onCancel(); // Editor closes only after its reminder save also succeeds.
  assert.equal(ui.calls[1][0], "PATCH"); assert.equal(ui.calls[1][1], "tasks/Read"); assert.equal(ui.editor(), undefined);
  ui.press("Upcoming tasks"); assert.match(text(ui.render()), /Next: 2026-10-06/);
  assert.equal(button(ui.render(), "Complete Read").props.disabled, true);
  serverDate = "2026-10-06"; t.mock.timers.tick(60_000); await tick();
  assert.match(text(ui.render()), /2026-10-06/); assert.equal(nodes(ui.render()).find(node => node.type === "EmptyState").props.title, "No upcoming tasks.");
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

test("parchment editor retains every input and validation while legacy/onboarding styling stays opt-in", async () => {
  const ui = editor(), legacy = editor({ tone: "legacy" });
  assert.equal(field(ui.render(), "Task title").props.style.backgroundColor, theme.uiTheme.colors.elevated);
  assert.equal(field(legacy.render(), "Task title").props.style, undefined);
  assert.equal(field(ui.render(), "Description").props.maxLength, 2000);
  for (const option of scheduling.TASK_SIZE_OPTIONS) assert.ok(button(ui.render(), `${option.label}, ${option.xp} XP`));
  assert.equal(button(ui.render(), "Schedule options").props.accessibilityState.expanded, true);
  ui.input("Task title", "Month-end review"); ui.press("Repeat: Monthly");
  ui.input("Start date", "2028-01-31"); ui.input("Due time", "23:59");
  ui.press("Add task"); await tick();
  assert.equal(ui.submissions[0].startDate, "2028-01-31");
  assert.equal(ui.submissions[0].dueTime, "23:59");
  assert.equal(ui.submissions[0].repeatType, "MONTHLY");
});

test("Tasks presentation retains canonical flat order, all three views, metadata and labeled actions", async t => {
  const rows = [task("Later", { dueTime: "20:00" }), task("Beta", { dueTime: "09:00" }), task("Alpha", { dueTime: "09:00" }),
    task("Future", { isDueToday: false, nextScheduledDate: "2026-10-06" }), task("Inactive", { active: false, isDueToday: false }),
    task("Archived", { archived: true })];
  const ui = await screen({ get: async () => ({ time, summary: { dueToday: 3, completedToday: 0 }, tasks: rows }) }); t.after(ui.cleanup);
  const completions = () => nodes(ui.render()).filter(n => n.props.accessibilityLabel?.startsWith("Complete ")).map(n => n.props.accessibilityLabel);
  assert.deepEqual(completions(), ["Complete Alpha", "Complete Beta", "Complete Later"]);
  assert.deepEqual(nodes(ui.render()).filter(n => n.type === "FilterChip").map(n => n.props.label), ["Today", "Upcoming", "All"]);
  assert.match(text(ui.render()), /Normal · \+35 XP · \+4 coins/);
  for (const action of ["Complete Alpha", "Edit Alpha", "Archive Alpha"]) {
    assert.equal(button(ui.render(), action).props.accessibilityRole, "button");
    assert.equal(button(ui.render(), action).props.accessibilityState.disabled, false);
  }
  ui.press("Upcoming tasks"); assert.deepEqual(completions(), ["Complete Future"]);
  ui.press("All tasks"); assert.equal(completions().length, 5);
  assert.equal(button(ui.render(), "Complete Inactive").props.disabled, true);
  const source = readFileSync(new URL("../src/components/TasksContent.tsx", import.meta.url), "utf8");
  assert.match(source, /tasksForView\(props.data\?\.tasks/);
  assert.doesNotMatch(source, /api\.|new Date|\.sort\(|\.filter\(|FlatList|SectionList/);
  assert.match(source, /<ScreenShell keyboardShouldPersistTaps="handled"/);
});

test("create form remains mounted across disclosure/filter changes without submitting or losing its identity", async t => {
  const ui = await screen({ get: async () => ({ time, summary: {}, tasks: [] }) }); t.after(ui.cleanup);
  const created = ui.create();
  const wrapper = () => nodes(ui.render()).find(n => n.type === "View" && n.props.style?.display === "none");
  assert.ok(wrapper()); assert.equal(created.tone, "parchment");
  ui.press("Add task"); assert.equal(wrapper(), undefined);
  ui.press("Hide new task form"); assert.ok(wrapper());
  ui.press("Upcoming tasks"); ui.press("Add task");
  assert.equal(ui.create().time, created.time);
  assert.equal(ui.create().onSave.name, created.onSave.name);
  assert.equal(ui.calls.length, 0); assert.equal(ui.events.length, 0);
  assert.equal(nodes(ui.render()).filter(n => n.type === "Editor").length, 1);
});

test("archive uses the existing delete route; failed archive keeps the row and never produces a reward", async t => {
  let rows = [task("Read")], fail = true;
  const ui = await screen({ get: async () => ({ time, summary: {}, tasks: rows }), remove: async route => {
    if (fail) throw new Error("offline");
    assert.equal(route, "tasks/Read"); rows = [];
  } }); t.after(ui.cleanup);
  ui.press("Archive Read"); await tick(); assert.ok(button(ui.render(), "Edit Read"));
  fail = false; ui.press("Archive Read"); await tick();
  assert.equal(button(ui.render(), "Edit Read"), undefined);
  assert.deepEqual(ui.calls, [["DELETE", "tasks/Read"], ["DELETE", "tasks/Read"]]);
  assert.equal(ui.events.length, 0);
});

test("failed edit retains editor; cancel and filter changes close it without mutations", async t => {
  const ui = await screen({ get: async () => ({ time, summary: {}, tasks: [task("Read")] }), patch: async () => { throw new Error("offline"); } }); t.after(ui.cleanup);
  ui.press("Edit Read");
  assert.equal(ui.editor().tone, "parchment");
  await assert.rejects(ui.editor().onSave({ title: "Draft" }), /offline/);
  assert.ok(ui.editor()); ui.editor().onCancel(); assert.equal(ui.editor(), undefined);
  ui.press("Edit Read"); ui.press("All tasks"); assert.equal(ui.editor(), undefined);
  assert.equal(ui.calls.length, 1); assert.equal(ui.events.length, 0);
});

test("initial load error does not fabricate an empty schedule and retry recovers the real list", async t => {
  let fail = true;
  const ui = await screen({ get: async () => {
    if (fail) throw new Error("offline");
    return { time, summary: { dueToday: 1, completedToday: 0 }, tasks: [task("Recovered")] };
  } }); t.after(ui.cleanup);
  assert.equal(nodes(ui.render()).some(n => n.type === "EmptyState"), false);
  assert.ok(nodes(ui.render()).some(n => n.props.accessibilityRole === "alert"));
  assert.equal(ui.create().disabled, true);
  fail = false;
  nodes(ui.render()).find(n => n.props.title === "Refresh tasks").props.onPress(); await tick();
  assert.ok(button(ui.render(), "Complete Recovered"));
  assert.equal(ui.create().disabled, false); assert.equal(ui.events.length, 0);
});
