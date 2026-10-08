import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
import * as model from "../src/notifications/model.ts";
import * as theme from "../src/theme/theme.ts";
import * as scheduling from "../src/tasks/scheduling.ts";
import { apiError } from "../src/api/errors.ts";
import { apiRoutes } from "../src/api/routes.ts";
const require = createRequire(import.meta.url);
const tick = () => new Promise(setImmediate);
function load(path, imports) {
  const exports = {};
  const source = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } }).outputText;
  new Function("require", "exports", source)(id => {
    if (id === "react/jsx-runtime") return require(id);
    if (!(id in imports)) throw new Error(`Missing ${id}`);
    return imports[id];
  }, exports);
  return exports;
}
function hooks() {
  let cursor = 0; const state = [], effects = [];
  const react = { useState: initial => {
    const key = cursor++; if (!(key in state)) state[key] = typeof initial === "function" ? initial() : initial;
    return [state[key], value => { state[key] = typeof value === "function" ? value(state[key]) : value; }];
  }, useRef: initial => react.useState({ current: initial })[0], useCallback: fn => fn,
  useEffect: (fn, deps) => { const key = cursor++; if (!state[key] || deps.some((value, i) => value !== state[key][i])) { state[key] = deps; effects.push(fn); } } };
  return { react, render(fn) { cursor = 0; const result = fn(); while (effects.length) effects.shift()(); return result; } };
}
const native = { StyleSheet: { create: value => value }, ...Object.fromEntries(["View", "Text", "Switch", "Pressable"].map(name => [name, name])) };
const nodes = tree => Array.isArray(tree) ? tree.flatMap(nodes) : tree?.props ? [tree, ...nodes(tree.props.children)] : [];
const text = tree => typeof tree === "string" ? tree : Array.isArray(tree) ? tree.map(text).join("") : tree?.props ? text(tree.props.children) : "";

function permissionFixture({ platform = "ios", granted = false, denied = false, accept = true, fail = false } = {}) {
  const stored = new Map(), calls = []; let requests = 0, prompts = 0, listener;
  const notifications = { getPermissionsAsync: async () => ({ granted, status: denied ? "denied" : granted ? "granted" : "undetermined", canAskAgain: !denied }),
    requestPermissionsAsync: async () => { requests++; granted = !denied; return { granted }; },
    getExpoPushTokenAsync: async () => ({ data: "ExpoPushToken[private-token]" }),
    addPushTokenListener: fn => { listener = fn; return { remove() {} }; },
    setNotificationChannelAsync: async () => {}, AndroidImportance: { DEFAULT: 3 } };
  const device = load("../src/notifications/device.ts", { "react-native-get-random-values": {},
    "react-native": { Platform: { OS: platform }, Alert: { alert: (_title, _body, buttons) => { prompts++; buttons[accept ? 1 : 0].onPress(); } } },
    "expo-secure-store": { getItemAsync: async key => stored.get(key) ?? null, setItemAsync: async (key, value) => { stored.set(key, value); }, deleteItemAsync: async key => { stored.delete(key); } },
    "expo-constants": { expoConfig: { extra: { eas: { projectId: "local-project" } } } }, "expo-notifications": notifications,
    "../api/routes": { apiRoutes }, "../api/client": { api: { post: async (url, body) => { calls.push([url, body]); }, delete: async url => { if (fail) throw new Error("offline"); calls.push([url]); } } },
  });
  return { device, stored, calls, notifications, get requests() { return requests; }, get prompts() { return prompts; }, rotate: () => listener?.() };
}
test("permission flow never prompts on launch and explains before first explicit grant/register", async () => {
  const f = permissionFixture(); assert.equal(await f.device.enableDeviceNotifications(false), "cancelled"); assert.equal(f.prompts, 0);
  assert.equal(await f.device.enableDeviceNotifications(), "ready"); assert.equal(f.prompts, 1); assert.equal(f.requests, 1);
  assert.equal(f.calls[0][0], "/devices"); assert.equal(f.calls[0][1].platform, "IOS");
  await f.device.enableDeviceNotifications(false); assert.equal(f.calls[0][1].deviceId, f.calls[1][1].deviceId);
  await f.device.watchDeviceToken(); f.rotate(); await tick(); assert.equal(f.calls.length, 3);
});
test("denied permission and web remain usable without repeated OS prompts or token requests", async () => {
  const denied = permissionFixture({ denied: true });
  assert.equal(await denied.device.enableDeviceNotifications(), "denied"); assert.equal(await denied.device.enableDeviceNotifications(), "denied");
  assert.equal(denied.requests, 0); assert.equal(denied.calls.length, 0);
  const web = permissionFixture({ platform: "web" }); assert.equal(await web.device.enableDeviceNotifications(), "web"); assert.equal(web.prompts, 0); assert.equal(web.calls.length, 0);
  const cancel = permissionFixture({ accept: false }); assert.equal(await cancel.device.enableDeviceNotifications(), "cancelled"); assert.equal(cancel.requests, 0);
  const firstDenial = permissionFixture(); let attempts = 0;
  firstDenial.notifications.requestPermissionsAsync = async () => { attempts++; return { granted: false }; };
  assert.equal(await firstDenial.device.enableDeviceNotifications(), "denied");
  assert.equal(await firstDenial.device.enableDeviceNotifications(), "denied"); assert.equal(attempts, 1);
});
test("logout disables current device before clearing opt-in and failed disable remains retryable", async () => {
  const f = permissionFixture({ granted: true }); await f.device.enableDeviceNotifications(); await f.device.disableCurrentDevice();
  assert.equal(f.calls[1][0], `/devices/${f.calls[0][1].deviceId}`); assert.equal(await f.device.enableDeviceNotifications(false), "cancelled");
  const g = permissionFixture({ granted: true, fail: true }); await g.device.enableDeviceNotifications(); await assert.rejects(g.device.disableCurrentDevice(), /Reconnect/);
  const auth = readFileSync(new URL("../src/context/AuthContext.tsx", import.meta.url), "utf8");
  assert.match(auth, /await disableCurrentDevice\(\);\s+await billing.identify\(null\);\s+await session.logout\(\)/);
  const profile = readFileSync(new URL("../app/(tabs)/profile.tsx", import.meta.url), "utf8");
  assert.match(profile, /await disableCurrentDevice\(\);\s+await api.delete\(apiRoutes.me\)/);
});
test("native error details and tokens never appear in permission status text or logs", async () => {
  const f = permissionFixture({ granted: true }); f.notifications.getExpoPushTokenAsync = async () => { throw new Error("private-token"); };
  assert.equal(await f.device.enableDeviceNotifications(), "unavailable");
  assert.doesNotMatch(JSON.stringify(f.device.permissionMessage), /private-token/);
  assert.doesNotMatch(readFileSync(new URL("../src/notifications/device.ts", import.meta.url), "utf8"), /console\./);
});
test("reminder choices preserve due-time relation and require an explicit clock without due time", () => {
  for (const offset of [0, 5, 15, 30, 60]) assert.deepEqual(model.reminderTiming(String(offset), "", "09:00"), { enabled: true, offsetMinutes: offset, localTime: null });
  assert.throws(() => model.reminderTiming("15", "", ""), /due time/);
  assert.deepEqual(model.reminderTiming("CUSTOM", "08:45", ""), { enabled: true, offsetMinutes: null, localTime: "08:45" });
  assert.equal(model.reminderTiming("NONE", "", "").enabled, false);
});
test("real reminder hook loads/edits/disables records and preserves draft after a failed save", async () => {
  const h = hooks(), calls = []; let fail = false;
  const stored = { reminderId: "reminder-123", taskId: "read", enabled: true, offsetMinutes: 15, localTime: null };
  const hook = load("../src/notifications/useTaskReminder.ts", { react: h.react, "../api/routes": { apiRoutes }, "./model": model,
    "./device": { enableDeviceNotifications: async () => "denied", permissionMessage: { denied: "Permission denied; saved reminders still work." } },
    "../api/client": { api: { get: async () => ({ data: { reminders: [stored] } }), patch: async (route, value) => { if (fail) throw new Error("offline"); calls.push([route, value]); }, delete: async route => calls.push([route]) } },
  }).useTaskReminder;
  const render = () => h.render(() => hook("read")); render(); await tick(); assert.equal(render().choice, "15");
  render().setChoice("CUSTOM"); render().setClock("10:00"); fail = true; await assert.rejects(render().save("read", "")); assert.equal(render().clock, "10:00");
  fail = false; assert.match(await render().save("read", ""), /denied/); assert.equal(calls[0][1].localTime, "10:00"); assert.match(render().notice, /denied/);
  render().setChoice("NONE"); await render().save("read", ""); assert.deepEqual(calls[1], ["/reminders/reminder-123"]);
});
test("TaskEditor retains a created task ID when reminder save fails, avoiding duplicate tasks on retry", async () => {
  const h = hooks(), ids = []; let fail = true;
  const reminder = { choice: "15", clock: "", save: async () => { if (fail) throw new Error("offline"); }, reset() {} };
  const Editor = load("../src/components/TaskEditor.tsx", { react: h.react, "react-native": native, "../api/client": { apiError },
    "../theme/theme": theme, "../tasks/scheduling": scheduling, "./LifeInput": "Input", "../notifications/model": model,
    "../notifications/useTaskReminder": { useTaskReminder: () => reminder } }).default;
  const render = () => h.render(() => Editor({ disabled: false, time: { date: "2026-10-05", weekday: "MON", timeZone: "UTC" }, onSave: async (_input, id) => { ids.push(id); return "created"; } }));
  const node = label => nodes(render()).find(item => item.props.accessibilityLabel === label)
    ?? nodes(render()).find(item => item.type === "Pressable" && text(item) === label);
  node("Task title").props.onChangeText("Read"); node("Schedule options").props.onPress(); node("Due time, 24-hour HH:mm, optional").props.onChangeText("09:00");
  const pressSave = () => nodes(render()).find(item => item.type === "Pressable" && text(item) === "Add task").props.onPress();
  pressSave(); await tick(); assert.match(text(render()), /will not create another task/); fail = false; pressSave(); await tick(); assert.deepEqual(ids, [undefined, "created"]);
  for (const option of model.REMINDER_OPTIONS) { node("Schedule options").props.onPress(); const choice = node(`Reminder: ${option.label}`); assert.equal(choice.props.accessibilityRole, "button"); node("Schedule options").props.onPress(); }
});
test("notification settings expose labeled controls, save only preferences and keep failed drafts", async () => {
  const h = hooks(); let focus, fail = false; const patches = [];
  const initial = { notificationsEnabled: true, taskRemindersEnabled: true, dailyReminderEnabled: false, dailyReminderTime: null,
    dailyQuestReminderEnabled: false, dailyQuestReminderTime: "18:00", streakReminderEnabled: false, streakReminderTime: "20:00",
    quietHoursEnabled: false, quietHoursStart: "22:00", quietHoursEnd: "07:00" };
  const Settings = load("../src/components/NotificationSettings.tsx", { react: h.react, "react-native": native, "expo-router": { useFocusEffect: fn => { focus = fn; } },
    "../api/routes": { apiRoutes }, "../api/client": { apiError, api: { get: async () => ({ data: initial }), patch: async (route, value) => { if (fail) throw new Error("offline"); patches.push([route, value]); return { data: value }; } } },
    "../notifications/device": { enableDeviceNotifications: async () => "web", permissionMessage: { web: "Use the native app; preferences can be saved here." } }, "../notifications/model": model,
    "../theme/theme": theme, "./LifeButton": "Button", "./LifeCard": "Card", "./LifeInput": "Input" }).default;
  const render = () => h.render(() => Settings({ timeZone: "UTC" })); render(); focus(); await tick();
  for (const label of ["Notifications enabled", "Task reminders", "Daily task summary", "Daily quest reminder", "Streak reminder", "Quiet hours"]) assert.ok(nodes(render()).find(item => item.type === "Switch" && item.props.accessibilityLabel === label));
  nodes(render()).find(item => item.props.accessibilityLabel === "Quiet hours").props.onValueChange(true);
  const save = () => nodes(render()).find(item => item.props.title === "Save notification settings").props.onPress();
  fail = true; save(); await tick(); assert.match(text(render()), /Could not save/); fail = false; save(); await tick();
  assert.equal(patches[0][0], "/preferences"); assert.equal(patches[0][1].quietHoursEnabled, true); assert.equal(patches[0][1].quietHoursStart, "22:00");
  assert.equal(patches[0][1].timeZone, undefined); assert.match(text(render()), /not delay/); assert.match(text(render()), /Settings saved/);
});
