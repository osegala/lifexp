import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import * as dates from "../layers/api-shared/nodejs/dates.mjs";
import * as schedule from "../layers/api-shared/nodejs/task-schedule.mjs";
import * as rules from "../layers/api-shared/nodejs/task-rules.mjs";
import * as input from "../layers/api-shared/nodejs/task-input.mjs";
import * as rewards from "../layers/api-shared/nodejs/task-rewards.mjs";
import * as http from "../layers/api-shared/nodejs/http.mjs";
import * as wakeups from "../layers/api-shared/nodejs/notification-wakeup.mjs";
import { planCompletion } from "../layers/api-shared/nodejs/task-completion.mjs";
import { levelInfo } from "../layers/api-shared/nodejs/leveling.mjs";
import * as archive from "../functions/delete-task/logic.mjs";

const daily = { repeatType: "DAILY", repeatDays: [], startDate: "2026-10-05", active: true };
const weekly = { ...daily, repeatType: "WEEKLY", repeatDays: ["MON", "WED", "FRI"] };
const monthly = { ...daily, repeatType: "MONTHLY", startDate: "2026-01-31" };

test("create accepts Never, Daily, weekly/custom weekdays and monthly using the existing rule fields", () => {
  assert.equal(input.validateTaskCreate({ title: "Once" }).repeatType, "NONE");
  for (const rule of [daily, weekly, monthly, { ...weekly, repeatDays: ["MON"] }]) {
    const result = input.validateTaskCreate({ title: "Scheduled", ...rule, dueTime: "09:30" });
    assert.equal(result.repeatType, rule.repeatType);
    assert.equal(result.startDate, rule.startDate);
    assert.equal(result.dueTime, "09:30");
    assert.equal(result.taskSize, "NORMAL");
  }
});

test("server rejects malformed/impossible dates, invalid clock times, invalid rules, and client next occurrence", () => {
  for (const startDate of ["2026-02-29", "2026-04-31", "26-10-05", "2026-10-05T00:00:00Z", "2026-13-01", "", 123]) {
    assert.throws(() => input.validateTaskCreate({ title: "Task", startDate }), { code: "INVALID_START_DATE" });
  }
  for (const dueTime of ["24:00", "12:60", "9:30", "09:30Z", "", 930]) {
    assert.throws(() => input.validateTaskCreate({ title: "Task", dueTime }), { code: "INVALID_DUE_TIME" });
  }
  for (const repeatDays of [[], ["FUNDAY"], ["MON", "mon"]]) {
    assert.throws(() => input.validateTaskCreate({ title: "Task", repeatType: "WEEKLY", repeatDays }), { code: "INVALID_REPEAT_DAYS" });
  }
  assert.throws(() => input.validateTaskCreate({ title: "Task", repeatType: "YEARLY" }), { code: "INVALID_REPEAT_TYPE" });
  assert.throws(() => input.validateTaskCreate({ title: "Task", repeatType: "MONTHLY" }), { code: "INVALID_START_DATE" });
  assert.throws(() => input.validateTaskCreate({ title: "Task", nextScheduledDate: "2026-01-01" }), { code: "VALIDATION_ERROR" });
  assert.throws(() => input.validateTaskPatch({ timeZone: "UTC" }, daily), { code: "VALIDATION_ERROR" });
  assert.equal(input.validateTaskCreate({ title: "Task", startDate: "2028-02-29", dueTime: "00:00" }).startDate, "2028-02-29");
});

test("next dates derive from one task rule without future records or missed-occurrence backfill", () => {
  assert.equal(schedule.nextScheduledDate(daily, "2026-10-05", true), "2026-10-06");
  assert.equal(schedule.nextScheduledDate(weekly, "2026-10-05", true), "2026-10-07");
  assert.equal(schedule.nextScheduledDate({ ...weekly, repeatDays: ["MON"] }, "2026-10-05", true), "2026-10-12");
  assert.equal(schedule.nextScheduledDate(weekly, "2026-10-06"), "2026-10-07");
  assert.equal(schedule.scheduledOn(weekly, "2026-10-06"), false, "missed Monday does not create a Tuesday backlog");
  assert.equal(schedule.nextScheduledDate(daily, "2026-11-20"), "2026-11-20");
  assert.equal(schedule.nextScheduledDate({ ...daily, startDate: "2027-12-20" }, "2026-10-05"), "2027-12-20");
  assert.equal(schedule.scheduledOn(daily, "2026-10-04"), false);
  const once = { repeatType: "NONE", startDate: "2026-10-10" };
  assert.equal(schedule.nextScheduledDate(once, "2026-10-05"), "2026-10-10");
  assert.equal(schedule.scheduledOn(once, "2026-10-11"), true, "unfinished one-time tasks stay due");
  assert.equal(schedule.nextScheduledDate({ ...once, completed: true }, "2026-10-11"), null);
  for (const stopped of [{ ...weekly, archived: true }, { ...daily, active: false }]) {
    assert.equal(schedule.nextScheduledDate(stopped, "2026-10-05"), null);
    assert.equal(schedule.scheduledOn(stopped, "2026-10-05"), false);
  }
});

test("monthly recurrence clamps in February/April without drifting its original anchor", () => {
  assert.equal(schedule.nextScheduledDate(monthly, "2026-01-31", true), "2026-02-28");
  assert.equal(schedule.nextScheduledDate(monthly, "2026-02-28", true), "2026-03-31");
  assert.equal(schedule.nextScheduledDate(monthly, "2026-03-31", true), "2026-04-30");
  assert.equal(schedule.nextScheduledDate({ ...monthly, startDate: "2028-01-31" }, "2028-01-31", true), "2028-02-29");
  assert.equal(schedule.nextScheduledDate({ ...monthly, startDate: "2026-10-06" }, "2026-10-06", true), "2026-11-06");
  assert.equal(schedule.previousScheduledDate(monthly, "2026-03-31"), "2026-02-28");
  assert.equal(schedule.scheduledOn(monthly, "2026-03-28"), false);
  assert.equal(schedule.nextScheduledDate(monthly, "2026-12-31", true), "2027-01-31");
});

test("profile midnight, DST and timezone changes select calendar dates, not 24-hour offsets or device dates", () => {
  assert.equal(dates.localDate(new Date("2026-10-06T03:59:59Z"), "America/New_York"), "2026-10-05");
  assert.equal(dates.localDate(new Date("2026-10-06T04:00:00Z"), "America/New_York"), "2026-10-06");
  for (const [before, after, expected] of [
    ["2026-03-08T06:59:59Z", "2026-03-08T07:00:00Z", "2026-03-08"],
    ["2026-11-01T05:30:00Z", "2026-11-01T06:30:00Z", "2026-11-01"],
  ]) {
    assert.equal(dates.localDate(new Date(before), "America/New_York"), expected);
    assert.equal(dates.localDate(new Date(after), "America/New_York"), expected);
    const task = { repeatType: "DAILY", dueTime: "02:30", lastCompletedDate: expected };
    assert.equal(schedule.completedOn(task, dates.localDate(new Date(after), "America/New_York"), "America/New_York"), true);
  }
  const now = new Date("2026-10-05T03:00:00Z");
  assert.equal(schedule.scheduledOn(weekly, dates.localDate(now, "America/New_York")), false);
  assert.equal(schedule.scheduledOn(weekly, dates.localDate(now, "Asia/Tokyo")), true);
});

function complete(task, today, extra = {}) {
  return planCompletion({ task: { currentStreak: 0, bestStreak: 0, ...task }, today, now: `${today}T12:00:00Z`,
    profile: { xp: 0, coins: 0, worldPoints: 0, tasksCompleted: 0, timeZone: "UTC" },
    dailyStats: { tasksCompleted: 0, goalRewarded: false }, weeklyStats: { tasksCompleted: 0, goalRewarded: false },
    defaults: { dailyTarget: 3, weeklyTarget: 15, dailyWorldPoints: 25, weeklyWorldPoints: 100 },
    baseReward: rewards.rewardForTaskSize("NORMAL"), progressionForXp: levelInfo, ...extra });
}

test("weekly/monthly streaks count only required dates and reset after a missed required occurrence", () => {
  assert.equal(complete({ ...weekly, lastCompletedDate: "2026-10-05", currentStreak: 4 }, "2026-10-07").currentStreak, 5);
  assert.equal(complete({ ...weekly, lastCompletedDate: "2026-10-05", currentStreak: 4 }, "2026-10-09").currentStreak, 1);
  assert.equal(complete({ ...monthly, lastCompletedDate: "2026-02-28", currentStreak: 2 }, "2026-03-31").currentStreak, 3);
  assert.equal(complete({ ...monthly, lastCompletedDate: "2026-01-31", currentStreak: 2 }, "2026-03-31").currentStreak, 1);
  assert.throws(() => complete(weekly, "2026-10-06"), { code: "TASK_NOT_DUE" });
  assert.throws(() => complete(daily, "2026-10-04"), { code: "TASK_NOT_DUE" });
  assert.throws(() => complete({ ...monthly, archived: true }, "2026-03-31"), { code: "TASK_ARCHIVED" });
});

test("recurrence edits cannot erase same-day duplicate protection or change task/quest reward amounts", () => {
  for (const task of [
    { ...daily, completed: true, completedAt: "2026-10-05T09:00:00Z" },
    { repeatType: "NONE", lastCompletedDate: "2026-10-05" },
    { ...monthly, startDate: "2026-10-05", lastCompletedDate: "2026-10-05" },
  ]) assert.throws(() => complete(task, "2026-10-05"), { code: "TASK_ALREADY_COMPLETED" });
  assert.throws(() => complete(daily, "2026-10-05", { completionExists: true }), { code: "TASK_ALREADY_COMPLETED" });
  const plan = complete(monthly, "2026-03-31", {
    dailyStats: { tasksCompleted: 2, goalRewarded: false }, weeklyStats: { tasksCompleted: 14, goalRewarded: false } });
  assert.equal(plan.xp, 35); assert.equal(plan.coins, 4); assert.equal(plan.worldPoints, 125);
  assert.equal(plan.createCompletionRecord, true);
});

// Run real create/edit/list/archive handlers with local command objects. Never import AWS.
function apiFixture() {
  let now = "2026-10-05T03:00:00Z", conflictNext = false;
  const items = new Map(), writes = [];
  const profile = { PK: { S: "USER#test" }, SK: { S: "PROFILE" }, timeZone: { S: "America/New_York" } };
  items.set("PROFILE", profile);
  class GetItemCommand { constructor(input) { this.input = input; } }
  class PutItemCommand { constructor(input) { this.input = input; } }
  class UpdateItemCommand { constructor(input) { this.input = input; } }
  class QueryCommand { constructor(input) { this.input = input; } }
  class DynamoDBClient {
    async send(command) {
      const request = command.input;
      if (command instanceof GetItemCommand) return { Item: structuredClone(items.get(request.Key.SK.S)) };
      if (command instanceof QueryCommand) return { Items: structuredClone([...items.values()].filter(item => item.SK.S.startsWith(request.ExpressionAttributeValues[":prefix"]?.S ?? "TASK#"))) };
      writes.push(request);
      if (command instanceof PutItemCommand) { items.set(request.Item.SK.S, structuredClone(request.Item)); return {}; }
      assert.ok(command instanceof UpdateItemCommand);
      const current = items.get(request.Key.SK.S), values = request.ExpressionAttributeValues, names = request.ExpressionAttributeNames;
      if (!current || conflictNext || (values[":expectedUpdatedAt"] && current.updatedAt?.S !== values[":expectedUpdatedAt"].S)) {
        conflictNext = false;
        throw Object.assign(new Error("conflict"), { name: "ConditionalCheckFailedException" });
      }
      const [sets, removes] = request.UpdateExpression.replace(/^SET /, "").split(" REMOVE ");
      for (const set of sets.split(/, (?![^()]*\))/)) {
        const [name, value] = set.split(" = ");
        const optional = value.match(/^if_not_exists\((#\w+), (:\w+)\)$/);
        current[names[name]] = structuredClone(optional ? current[names[optional[1]]] ?? values[optional[2]] : values[value]);
      }
      for (const name of (removes ?? "").split(", ").filter(Boolean)) delete current[names[name]];
      return { Attributes: structuredClone(current) };
    }
  }
  const sdk = { DynamoDBClient, GetItemCommand, PutItemCommand, UpdateItemCommand, QueryCommand };
  const handlers = {};
  for (const name of ["create-task", "get-tasks", "update-task", "delete-task"]) {
    const imports = { "node:crypto": { createHash, randomUUID }, "@aws-sdk/client-dynamodb": sdk, "./logic.mjs": archive,
      "/opt/nodejs/http.mjs": http, "/opt/nodejs/task-input.mjs": input, "/opt/nodejs/task-rewards.mjs": rewards,
      "/opt/nodejs/dates.mjs": dates, "/opt/nodejs/task-schedule.mjs": schedule, "/opt/nodejs/task-rules.mjs": rules };
    imports["/opt/nodejs/notification-wakeup.mjs"] = wakeups;
    const source = readFileSync(new URL(`../functions/${name}/index.mjs`, import.meta.url), "utf8")
      .replace(/import\s*\{([^}]+)\}\s*from\s*"([^"]+)";/g, (_, members, path) => `const {${members.replace(/\bas\b/g, ":")}} = imports[${JSON.stringify(path)}];`)
      .replace("export const handler", "const handler");
    const Clock = class extends Date { constructor(value = now) { super(value); } };
    handlers[name] = new Function("imports", "Date", "process", `${source}\nreturn handler;`)(imports, Clock, { env: {} });
  }
  return { items, writes, profile, conflict: () => { conflictNext = true; }, setNow: value => { now = value; },
    async call(name, body, taskId) {
      const result = await handlers[name]({ requestContext: { authorizer: { jwt: { claims: { sub: "test" } } } },
        pathParameters: { taskId }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
      return { status: result.statusCode, ...(result.body ? JSON.parse(result.body) : {}) };
    } };
}

test("real create/list handlers store schedule once and derive availability from profile time", async () => {
  const f = apiFixture();
  const today = await f.call("create-task", { title: "Daily", repeatType: "DAILY", dueTime: "09:00" });
  const future = await f.call("create-task", { title: "Future", repeatType: "MONTHLY", startDate: "2026-10-31" });
  assert.equal(today.status, 201); assert.equal(today.startDate, "2026-10-04", "profile date differs from UTC");
  assert.equal(future.status, 201);
  let list = await f.call("get-tasks");
  assert.equal(list.time.date, "2026-10-04");
  assert.equal(list.tasks.find(task => task.taskId === today.taskId).isDueToday, true);
  assert.equal(list.tasks.find(task => task.taskId === future.taskId).isDueToday, false);
  assert.equal(list.tasks.find(task => task.taskId === future.taskId).nextScheduledDate, "2026-10-31");
  f.profile.timeZone = { S: "Asia/Tokyo" };
  list = await f.call("get-tasks");
  assert.equal(list.time.date, "2026-10-05");
  assert.equal(f.writes.length, 2, "reads never materialize occurrences");
});

test("real recurrence edit/removal keeps completion guards/history and only resets streak for changed rules", async () => {
  const f = apiFixture();
  const created = await f.call("create-task", { title: "Read", ...weekly });
  const stored = f.items.get(`TASK#${created.taskId}`);
  Object.assign(stored, { lastCompletedDate: { S: "2026-10-05" }, currentStreak: { N: "8" }, bestStreak: { N: "12" } });
  f.setNow("2026-10-05T12:00:00Z");
  let edited = await f.call("update-task", { dueTime: "10:00", repeatDays: ["FRI", "MON", "WED"] }, created.taskId);
  assert.equal(edited.status, 200); assert.equal(edited.currentStreak, 8, "same weekday set / new clock time is not a rule change");
  edited = await f.call("update-task", { repeatType: "MONTHLY", startDate: "2026-10-05" }, created.taskId);
  assert.equal(edited.status, 200); assert.equal(edited.currentStreak, 0); assert.equal(edited.bestStreak, 12);
  assert.equal(edited.lastCompletedDate, "2026-10-05"); assert.deepEqual(edited.repeatDays, []);
  assert.throws(() => complete(edited, "2026-10-05"), { code: "TASK_ALREADY_COMPLETED" });
  edited = await f.call("update-task", { repeatType: "NONE", startDate: null, dueTime: null }, created.taskId);
  assert.equal(edited.startDate, null); assert.equal(edited.dueTime, null); assert.equal(edited.repeatType, "NONE");
  assert.equal((await f.call("get-tasks")).tasks[0].isDueToday, false);
  assert.throws(() => complete(edited, "2026-10-05"), { code: "TASK_ALREADY_COMPLETED" });
  f.conflict();
  assert.equal((await f.call("update-task", { title: "Race" }, created.taskId)).error.code, "TASK_CHANGED");
  assert.equal(stored.title.S, "Read");
  assert.equal((await f.call("delete-task", undefined, created.taskId)).status, 204);
  assert.equal((await f.call("get-tasks")).tasks.length, 0);
  assert.equal((await f.call("update-task", { repeatType: "DAILY" }, created.taskId)).error.code, "TASK_ARCHIVED");
  assert.equal(stored.bestStreak.N, "12", "archive retains historical streak");
});
