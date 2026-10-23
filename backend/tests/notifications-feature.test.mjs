import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as crypto from "node:crypto";
import * as dates from "../layers/api-shared/nodejs/dates.mjs";
import * as tasks from "../layers/api-shared/nodejs/task-schedule.mjs";
import * as streak from "../layers/api-shared/nodejs/activity-streak.mjs";
import * as scheduling from "../layers/notification-shared/nodejs/scheduling.mjs";
import * as prefs from "../layers/notification-shared/nodejs/preferences.mjs";
import * as logic from "../functions/notification-worker/logic.mjs";
import { notificationMessage } from "../functions/notification-worker/messages.mjs";
import { createExpoProvider } from "../functions/notification-worker/push-provider.mjs";
import * as reminderLogic from "../functions/reminders/logic.mjs";
import * as http from "../layers/api-shared/nodejs/http.mjs";
import { notificationWakeups } from "../layers/api-shared/nodejs/notification-wakeup.mjs";
import { validateReminderCreate, validateReminderTiming } from "../functions/reminders/logic.mjs";

function load(file, imports, globals = {}) {
  let source = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
  const names = [...source.matchAll(/export (?:async )?(?:function|const) (\w+)/g)].map(match => match[1]);
  source = source.replace(/import\s*\{([^}]+)\}\s*from\s*"([^"]+)";/g, (_, members, path) => `const {${members.replace(/\bas\b/g, ":")}} = imports[${JSON.stringify(path)}];`).replace(/export /g, "");
  return new Function("imports", ...Object.keys(globals), `${source}\nreturn {${names.join(",")}};`)(imports, ...Object.values(globals));
}
const planning = load("layers/notification-shared/nodejs/planning.mjs", {
  "/opt/nodejs/dates.mjs": dates, "/opt/nodejs/task-schedule.mjs": tasks,
  "/opt/nodejs/activity-streak.mjs": streak, "./scheduling.mjs": scheduling,
});
const S = value => ({ S: value }), N = value => ({ N: String(value) }), B = value => ({ BOOL: value });
const now = new Date("2026-10-05T09:00:30Z");
const row = (sk, extra = {}) => ({ PK: S("USER#test"), SK: S(sk), updatedAt: S("2026-10-01T00:00:00Z"), ...extra });
const profile = row("PROFILE", { timeZone: S("UTC") });
const task = row("TASK#read", { title: S("Read"), active: B(true), repeatType: S("DAILY"), dueTime: S("09:00"), createdAt: S("2026-10-01T00:00:00Z") });
const config = row("REMINDER#read", { type: S("TASK_DUE"), reminderId: S("read"), taskId: S("read"), enabled: B(true), offsetMinutes: N(0), createdAt: S("2026-10-01T00:00:00Z"),
  nextDueAt: S("2026-10-05T09:00:00.000Z"), GSI1PK: S("NOTIFICATION_DUE"), GSI1SK: S("2026-10-05T09:00:00.000Z#read") });
const device = row("DEVICE#one", { deviceId: S("one"), enabled: B(true), pushToken: S("ExpoPushToken[private-token]") });
function plan(options = {}) { return planning.planNotifications({ config, profile, preferences: prefs.resolvePreferences(), task, now, ...options }); }

test("TASK_DUE and all allowed offsets use the task due time, including prior-day offset", () => {
  for (const offset of [0, 5, 15, 30, 60]) {
    const events = plan({ config: { ...config, offsetMinutes: N(offset) }, now: new Date(now.getTime() - offset * 60_000) }).events;
    assert.equal(events.length, 1); assert.equal(events[0].type, "TASK_DUE"); assert.equal(events[0].occurrence, "2026-10-05");
  }
  const cross = plan({ task: { ...task, dueTime: S("00:15") }, config: { ...config, offsetMinutes: N(60) }, now: new Date("2026-10-04T23:15:30Z") });
  assert.equal(cross.events[0].occurrence, "2026-10-05");
});

test("daily, M/W/F and monthly dates use canonical schedule with month-end/leap clamping", () => {
  const values = { enabled: true, offsetMinutes: 15 };
  const weekly = { ...task, repeatType: S("WEEKLY"), repeatDays: { SS: ["MON", "WED", "FRI"] } };
  const occurrences = planning.taskOccurrences(values, weekly, "UTC", now).slice(0, 3);
  assert.deepEqual(occurrences.map(item => item.date), ["2026-10-07", "2026-10-09", "2026-10-12"]);
  for (const [anchor, expected] of [["2026-01-31", "2026-02-28"], ["2028-01-31", "2028-02-29"]]) {
    const month = { ...task, repeatType: S("MONTHLY"), startDate: S(anchor) };
    const result = planning.taskOccurrences(values, month, "UTC", new Date(`${anchor}T10:00:00Z`));
    assert.equal(result[0].date, expected); assert.equal(result[1].date, `${anchor.slice(0, 4)}-03-31`);
  }
});

test("DST skips missing wall time and chooses the first repeated time; timezone is profile-owned", () => {
  const values = { enabled: true, localTime: "02:30" };
  assert.equal(planning.taskOccurrences(values, task, "America/New_York", new Date("2026-03-08T05:00:00Z"))[0].at, "2026-03-09T06:30:00.000Z");
  assert.equal(planning.taskOccurrences({ ...values, localTime: "01:30" }, task, "America/New_York", new Date("2026-11-01T04:00:00Z"))[0].at, "2026-11-01T05:30:00.000Z");
  assert.equal(plan({ profile: { ...profile, timeZone: S("Asia/Tokyo") } }).events.length, 0);
});

test("completed, archived, inactive and missing tasks never produce an eligible event", () => {
  for (const value of [null, { ...task, lastCompletedDate: S("2026-10-05") }, { ...task, completedAt: S("2026-10-05T08:00:00Z") },
    { ...task, archived: B(true) }, { ...task, active: B(false) }, { ...task, repeatType: S("NONE"), completed: B(true) }]) assert.equal(plan({ task: value }).events.length, 0);
});

test("reminder edits are not retroactive, missed windows have no backlog, due-time removal pauses offsets", () => {
  assert.equal(plan({ now: new Date("2026-10-05T09:06:00Z") }).events.length, 0);
  assert.equal(plan({ config: { ...config, updatedAt: S("2026-10-05T09:00:10Z") } }).events.length, 0);
  assert.equal(plan({ task: { ...task, dueTime: undefined } }).schedule, null);
  assert.throws(() => validateReminderTiming({ offsetMinutes: 15 }, {}), /due time/);
  assert.equal(validateReminderCreate({ type: "TASK_DUE", taskId: "read", offsetMinutes: 15 }).offsetMinutes, 15);
});

test("one-off explicit time without a task date fires once at the next chosen local clock", () => {
  const once = { ...task, repeatType: S("NONE"), dueTime: undefined };
  const values = { enabled: true, localTime: "08:00", createdAt: "2026-10-05T10:00:00Z" };
  const next = planning.taskOccurrences(values, once, "UTC", new Date(values.createdAt));
  assert.equal(next[0].at, "2026-10-06T08:00:00.000Z"); assert.equal(next[0].occurrence, "ONCE");
  assert.equal(planning.taskOccurrences(values, once, "UTC", new Date("2026-10-06T08:06:00Z")).length, 0);
});

const dailyPreferences = prefs.resolvePreferences({ dailyReminderEnabled: true, dailyReminderTime: "09:00", dailyQuestReminderEnabled: true,
  dailyQuestReminderTime: "09:00", streakReminderEnabled: true, streakReminderTime: "09:00" });
const yesterday = row("STATS#DAY#2026-10-04", { tasksCompleted: N(1) });
test("daily summary counts due tasks, quest reads progress, streak uses global activity buckets", () => {
  const result = plan({ config: row("PREFERENCES"), preferences: dailyPreferences, tasks: [task, { ...task, active: B(false) }], stats: [yesterday] });
  assert.deepEqual(result.events.map(event => event.type), ["DAILY_SUMMARY", "DAILY_QUEST", "STREAK_AT_RISK"]);
  assert.match(result.events[0].body, /1 task awaits/); assert.match(result.events[1].body, /0\/3/); assert.match(result.events[2].body, /1-day streak/);
  assert.ok(result.events.every(event => event.reason === null));
});
test("empty summary, complete quest and completed activity streak are suppressed", () => {
  const result = plan({ config: row("PREFERENCES"), preferences: dailyPreferences, tasks: [], stats: [yesterday, row("STATS#DAY#2026-10-05", { tasksCompleted: N(3) })] });
  assert.deepEqual(result.events.map(event => event.reason), ["NO_TASKS_DUE", "QUEST_COMPLETE", "STREAK_NOT_AT_RISK"]);
});
test("quiet hours suppress (never defer), including overnight boundaries; disabled preferences suppress", () => {
  const quiet = prefs.resolvePreferences({ quietHoursEnabled: true });
  for (const [time, suppressed] of [["21:59", false], ["22:00", true], ["00:00", true], ["06:59", true], ["07:00", false]]) {
    assert.equal(planning.inQuietHours(quiet, new Date(`2026-10-05T${time}:00Z`), "UTC"), suppressed);
  }
  const result = plan({ preferences: { ...quiet, quietHoursStart: "08:00", quietHoursEnd: "10:00" } });
  assert.equal(result.events[0].reason, "QUIET_HOURS"); assert.equal(result.schedule.nextDueAt, "2026-10-06T09:00:00.000Z");
  assert.equal(plan({ preferences: { ...quiet, notificationsEnabled: false } }).events[0].reason, "NOTIFICATIONS_DISABLED");
  assert.equal(plan({ preferences: { ...quiet, taskRemindersEnabled: false } }).events[0].reason, "TASK_REMINDERS_DISABLED");
  const delayed = plan({ preferences: quiet, task: { ...task, dueTime: S("21:59") }, now: new Date("2026-10-05T22:01:00Z") });
  assert.equal(delayed.events[0].reason, "QUIET_HOURS");
  const leavingQuiet = plan({ preferences: quiet, task: { ...task, dueTime: S("06:59") }, now: new Date("2026-10-05T07:01:00Z") });
  assert.equal(leavingQuiet.events[0].reason, "QUIET_HOURS");
});

function fixture({ daily = false, lostResponse = false, result = { status: "PREPARED" }, failRead = false, afterReservation, message = notificationMessage } = {}) {
  let clock = now, sendCount = 0, lose = lostResponse;
  const payloads = [], requests = [];
  const data = new Map([profile, task, device, config].map(item => [item.SK.S, structuredClone(item)]));
  if (daily) {
    data.delete(config.SK.S);
    data.set("PREFERENCES", { ...row("PREFERENCES"), ...Object.fromEntries(Object.entries(dailyPreferences).map(([key, value]) => [key, typeof value === "boolean" ? B(value) : S(value)])), GSI1PK: config.GSI1PK, GSI1SK: config.GSI1SK });
    data.set(yesterday.SK.S, yesterday);
  }
  const sdk = Object.fromEntries(["GetItemCommand", "QueryCommand", "UpdateItemCommand", "TransactWriteItemsCommand"].map(name => [name, class { constructor(input) { this.input = input; this.name = name; } }]));
  const conflict = () => { throw Object.assign(new Error("condition"), { name: "ConditionalCheckFailedException" }); };
  function update(request) {
    const item = data.get(request.Key.SK.S); if (!item) conflict();
    const values = request.ExpressionAttributeValues, names = request.ExpressionAttributeNames ?? {};
    if (values[":dueKey"] && !request.UpdateExpression.startsWith("REMOVE") && item.GSI1SK?.S !== values[":dueKey"].S) conflict();
    if (values[":claimedAt"] && item.deliveryClaimKey?.S === values[":dueKey"].S && item.deliveryClaimedAt?.S >= values[":expired"].S) conflict();
    if (values[":updatedAt"] && item.updatedAt?.S !== values[":updatedAt"].S) conflict();
    const expression = request.UpdateExpression;
    const set = expression.match(/^SET (.*?)(?: REMOVE |$)/)?.[1];
    for (const pair of set?.split(", ") ?? []) { const [key, value] = pair.split(" = "); item[names[key] ?? key] = structuredClone(values[value]); }
    for (const key of expression.match(/(?:^| )REMOVE (.*)$/)?.[1].split(", ") ?? []) delete item[names[key] ?? key];
    return { Attributes: structuredClone(item) };
  }
  sdk.DynamoDBClient = class { async send(command) {
    const request = command.input;
    requests.push({ command: command.name, input: structuredClone(request) });
    if (command.name === "GetItemCommand") { if (failRead && request.Key.SK.S === "PREFERENCES") throw new Error("offline"); return { Item: structuredClone(data.get(request.Key.SK.S)) }; }
    if (command.name === "QueryCommand") return { Items: structuredClone([...data.values()].filter(item => request.IndexName
      ? item.GSI1SK?.S <= request.ExpressionAttributeValues[":boundary"].S
      : item.SK.S.startsWith(request.ExpressionAttributeValues[":prefix"].S))) };
    if (command.name === "UpdateItemCommand") return update(request);
    if (command.name === "TransactWriteItemsCommand") {
      try {
        for (const entry of request.TransactItems) {
          if (entry.Put) { if (data.has(entry.Put.Item.SK.S)) conflict(); continue; }
          const check = entry.ConditionCheck, item = data.get(check.Key.SK.S);
          if (!!item !== check.ConditionExpression.startsWith("attribute_exists(PK)")) conflict();
          for (const [alias, field] of Object.entries(check.ExpressionAttributeNames)) assert.deepEqual(item?.[field], check.ExpressionAttributeValues?.[alias.replace("#", ":")]);
        }
      } catch { throw Object.assign(new Error("condition"), { name: "TransactionCanceledException" }); }
      for (const entry of request.TransactItems) if (entry.Put) data.set(entry.Put.Item.SK.S, structuredClone(entry.Put.Item));
      afterReservation?.(data);
      if (lose) { lose = false; throw new Error("lost transaction response"); }
      return {};
    }
    throw new Error("Unexpected command");
  } };
  const worker = load("functions/notification-worker/index.mjs", { "node:crypto": crypto, "@aws-sdk/client-dynamodb": sdk,
    "/opt/nodejs/preferences.mjs": prefs, "/opt/nodejs/planning.mjs": planning, "./logic.mjs": logic,
    "./messages.mjs": { notificationMessage: message },
    "./push-provider.mjs": { deliveryMode: () => "DRY_RUN", createExpoProvider: () => ({ mode: "DRY_RUN", send: async payload => { sendCount++; payloads.push(structuredClone(payload)); return result; } }) } },
    { Date: class extends Date { constructor(value = clock) { super(value); } }, process: { env: { TABLE_NAME: "local" } }, console: { error() {} } });
  return { data, payloads, requests, run: () => worker.handler({}), get sends() { return sendCount; }, setNow: value => { clock = new Date(value); },
    records: () => [...data.values()].filter(item => item.SK.S.startsWith("NOTIFICATION_DELIVERY#")), sdk };
}
test("real worker reserves task occurrence once across duplicate/stale-index runs and time edits", async () => {
  const f = fixture(); const original = structuredClone(f.data.get(config.SK.S));
  await f.run(); assert.equal(f.sends, 1); await f.run(); assert.equal(f.sends, 1);
  f.data.set(config.SK.S, original); await f.run(); assert.equal(f.sends, 1); assert.equal(f.records().length, 1);
  assert.doesNotMatch(JSON.stringify(f.records()), /private-token|pushToken/);
});
test("copy changes leave worker requests, reminder IDs, scheduling and delivery fields unchanged", async () => {
  const withoutHistoryCopy = value => JSON.parse(JSON.stringify(value, (_key, entry) => {
    if (!entry?.SK?.S?.startsWith("NOTIFICATION_DELIVERY#")) return entry;
    const { message, ...fields } = entry;
    return fields;
  }));
  const withoutPayloadCopy = ({ title, body, ...fields }) => fields;
  for (const daily of [false, true]) {
    const current = fixture({ daily });
    const legacy = fixture({ daily, message: ({ summaryBody }) => ({ title: "Evrenthia", body: summaryBody }) });
    const sk = daily ? "PREFERENCES" : config.SK.S;
    const original = structuredClone(current.data.get(sk));
    await current.run(); await legacy.run();
    assert.equal(current.sends, daily ? 3 : 1);
    assert.deepEqual(current.payloads.map(Object.keys), legacy.payloads.map(Object.keys));
    assert.deepEqual(current.payloads.map(withoutPayloadCopy), legacy.payloads.map(withoutPayloadCopy));
    for (const payload of current.payloads) {
      const record = current.records().find(item => item.notificationType.S === payload.data.type);
      const expected = notificationMessage({ type: payload.data.type, taskTitle: task.title.S,
        deliveryId: record.deliveryId.S, summaryBody: "1 task awaits you in Evrenthia." });
      assert.deepEqual({ title: payload.title, body: payload.body }, expected);
      assert.equal(record.message.S, expected.body, "history uses the same copy as the push");
      const identity = `${daily ? payload.data.type : config.reminderId.S}#2026-10-05`;
      const id = crypto.createHash("sha256").update(identity).digest("hex");
      assert.equal(record.deliveryId.S, id);
      assert.equal(record.SK.S, `NOTIFICATION_DELIVERY#2026-10-05#${id}`);
    }
    // Replaying a stale index still reserves/sends exactly once, independent of copy.
    current.data.set(sk, structuredClone(original)); legacy.data.set(sk, structuredClone(original));
    await current.run(); await legacy.run();
    assert.equal(current.sends, daily ? 3 : 1);
    assert.deepEqual(withoutHistoryCopy([...current.data]), withoutHistoryCopy([...legacy.data]));
    assert.deepEqual(withoutHistoryCopy(current.requests), withoutHistoryCopy(legacy.requests));
  }
});
test("actual Expo payloads preserve every field except title/body for task, quest and streak reminders", async () => {
  const current = fixture({ daily: true }); await current.run();
  const taskFixture = fixture(); await taskFixture.run();
  const sent = [];
  const provider = createExpoProvider({ mode: "LIVE", fetchImpl: async (_url, request) => {
    sent.push(JSON.parse(request.body));
    return { ok: true, json: async () => ({ data: { status: "ok" } }) };
  } });
  for (const payload of [...taskFixture.payloads, ...current.payloads]) {
    await provider.send(payload);
    await provider.send({ ...payload, title: "Evrenthia", body: "Previous notification wording" });
    const [updated, previous] = sent.slice(-2);
    const { title, body, ...updatedFields } = updated;
    const { title: previousTitle, body: previousBody, ...previousFields } = previous;
    assert.deepEqual(updatedFields, previousFields);
    assert.deepEqual(Object.keys(updated), ["to", "title", "body", "data", "sound"]);
    assert.deepEqual({ title, body }, { title: payload.title, body: payload.body });
    assert.equal(Buffer.byteLength(JSON.stringify(updated), "utf8") < 4096, true);
  }
});
test("real task pushes use safe missing-title copy and bounded long names", async () => {
  for (const title of [undefined, " \n\t ", "🌱".repeat(200)]) {
    const f = fixture();
    f.data.get(task.SK.S).title = title === undefined ? undefined : S(title);
    await f.run(); assert.equal(f.sends, 1);
    const payload = f.payloads[0];
    if (title?.trim()) assert.ok(payload.body.startsWith(`${"🌱".repeat(119)}…`));
    else assert.equal(payload.body, "Your task is ready");
    assert.equal(payload.body.isWellFormed(), true);
  }
});
test("lost reservation response and ambiguous provider timeout never cause automatic resend", async () => {
  const f = fixture({ lostResponse: true }); await f.run(); await f.run(); assert.equal(f.sends, 0); assert.equal(f.records().length, 1);
  const g = fixture({ result: { status: "FAILED", errorCode: "NETWORK_ERROR" } });
  await g.run(); g.data.set(config.SK.S, structuredClone(config)); await g.run(); assert.equal(g.sends, 1); assert.equal(g.records()[0].status.S, "FAILED");
});
test("daily types each have one durable reservation per local date, including same-time settings", async () => {
  const f = fixture({ daily: true }), original = structuredClone(f.data.get("PREFERENCES"));
  await f.run(); assert.equal(f.sends, 3); f.data.set("PREFERENCES", original); await f.run();
  assert.equal(f.sends, 3); assert.equal(f.records().length, 3);
});
test("worker suppresses disabled devices, missing accounts, archived tasks and failed reads", async () => {
  for (const mutate of [f => f.data.get(device.SK.S).enabled = B(false), f => f.data.delete("PROFILE"),
    f => f.data.delete(task.SK.S), f => f.data.get(task.SK.S).archived = B(true),
    f => f.data.set("PREFERENCES", row("PREFERENCES", { notificationsEnabled: B(false) }))]) {
    const f = fixture(); mutate(f); await f.run(); assert.equal(f.sends, 0);
  }
  const f = fixture({ failRead: true }); await f.run(); assert.equal(f.sends, 0); assert.equal(f.records().length, 0);
});
test("invalid Expo token response disables only the matching current device token", async () => {
  const f = fixture({ result: { status: "FAILED", errorCode: "DeviceNotRegistered" } });
  await f.run(); assert.equal(f.data.get(device.SK.S).enabled.BOOL, false);
});
test("last-boundary checks suppress completion, logout and account deletion after reservation", async () => {
  for (const mutate of [data => data.delete("PROFILE"), data => data.get(device.SK.S).enabled = B(false),
    data => { data.get(task.SK.S).updatedAt = S(now.toISOString()); data.get(task.SK.S).lastCompletedDate = S("2026-10-05"); },
    data => { data.get(config.SK.S).updatedAt = S(now.toISOString()); data.get(config.SK.S).enabled = B(false); }]) {
    const f = fixture({ afterReservation: mutate }); await f.run();
    assert.equal(f.sends, 0); assert.equal(f.records()[0].status.S, "SKIPPED");
  }
});
test("daily completion after reservation suppresses the pending quest/streak at the provider boundary", async () => {
  const f = fixture({ daily: true, afterReservation: data => data.set("STATS#DAY#2026-10-05", row("STATS#DAY#2026-10-05", { tasksCompleted: N(3), goalRewarded: B(true) })) });
  await f.run(); await f.run(); assert.equal(f.sends, 0);
  assert.ok(f.records().every(item => item.status.S === "SKIPPED"));
});
test("task/timezone edits wake existing reminders, with version guards and no new occurrence rows", async () => {
  const f = fixture();
  const updates = await notificationWakeups(new f.sdk.DynamoDBClient(), f.sdk.QueryCommand, "local", "USER#test", now.toISOString(), "read");
  assert.equal(updates.length, 1); assert.equal(updates[0].Update.Key.SK.S, config.SK.S);
  assert.match(updates[0].Update.ConditionExpression, /#updated = :updated/);
  assert.equal(updates[0].Update.ExpressionAttributeValues[":sort"].S, `${now.toISOString()}#${config.SK.S}`);
});
test("actual GET reminders returns saved TASK_DUE and legacy TASK records for editor reopening", async () => {
  const f = fixture();
  f.data.set("REMINDER#legacy", { ...config, SK: S("REMINDER#legacy"), reminderId: S("legacy"), type: S("TASK") });
  const endpoint = load("functions/reminders/get.mjs", { "@aws-sdk/client-dynamodb": f.sdk,
    "./logic.mjs": reminderLogic, "/opt/nodejs/http.mjs": http });
  const response = await endpoint.handler({ requestContext: { authorizer: { jwt: { claims: { sub: "test" } } } } });
  assert.equal(response.statusCode, 200);
  const result = JSON.parse(response.body);
  assert.deepEqual(result.reminders.map(item => item.type), ["TASK_DUE", "TASK"]);
  assert.equal(result.reminders[0].offsetMinutes, 0);
  assert.equal(result.reminders[0].effectiveNotificationsEnabled, true);
});
