import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { activityStreak } from "../layers/api-shared/nodejs/activity-streak.mjs";
import * as goalsLogic from "../functions/get-goals/logic.mjs";
import * as completionLogic from "../functions/complete-task/logic.mjs";
import * as taskSchedule from "../layers/api-shared/nodejs/task-schedule.mjs";
import * as http from "../layers/api-shared/nodejs/http.mjs";
import * as leveling from "../layers/api-shared/nodejs/leveling.mjs";
import * as rewards from "../layers/api-shared/nodejs/task-rewards.mjs";
import * as achievements from "../layers/progression-shared/nodejs/achievements.mjs";
import * as buildings from "../layers/progression-shared/nodejs/building-effects.mjs";

const day = (date, count = 1) => ({ SK: { S: `STATS#DAY#${date}` }, date: { S: date }, tasksCompleted: { N: String(count) } });
test("daily activity deduplicates dates, counts any completed task, and keeps a streak through today", () => {
    const history = [day("2026-10-03", 4), day("2026-10-04", 8), day("2026-10-04", 8), day("2026-10-05", 0)];
    assert.deepEqual(activityStreak(history, "2026-10-05"), { currentDays: 2, longestDays: 2, completedToday: false });
    assert.deepEqual(activityStreak(history, "2026-10-05", true), { currentDays: 3, longestDays: 3, completedToday: true });
    assert.deepEqual(activityStreak([...history, day("2026-10-05", 10)], "2026-10-05", true),
        { currentDays: 3, longestDays: 3, completedToday: true });
});

test("a missed whole local day breaks current streak, not longest streak", () => {
    const history = [day("2026-10-02"), day("2026-10-03")];
    assert.deepEqual(activityStreak(history, "2026-10-05"), { currentDays: 0, longestDays: 2, completedToday: false });
    assert.deepEqual(activityStreak(history, "2026-10-05", true), { currentDays: 1, longestDays: 2, completedToday: true });
    assert.deepEqual(activityStreak([], "2026-10-05"), { currentDays: 0, longestDays: 0, completedToday: false });
});

test("quests and activity streak use profile local dates around midnight and timezone changes", () => {
    const now = new Date("2026-10-05T03:59:59Z");
    const east = goalsLogic.localDate(now, "America/New_York");
    assert.equal(east, "2026-10-04");
    assert.equal(completionLogic.localDate(now, "America/New_York"), east);
    assert.equal(goalsLogic.localDate(new Date("2026-10-05T04:00:00Z"), "America/New_York"), "2026-10-05");
    assert.equal(goalsLogic.isoWeekId(east), "2026-W40");
    assert.equal(goalsLogic.isoWeekId("2026-10-05"), "2026-W41");
    assert.equal(goalsLogic.isoWeekId("2027-01-01"), "2026-W53");
    const history = [day(east)];
    assert.equal(activityStreak(history, goalsLogic.localDate(now, "Asia/Tokyo")).completedToday, false);
    assert.equal(activityStreak(history, goalsLogic.localDate(now, "Asia/Tokyo")).currentDays, 1);
    // Moving back across the date line must not pull tomorrow's bucket into current streak.
    assert.equal(activityStreak(history, "2026-10-03").currentDays, 0);
    assert.equal(activityStreak(history, "2026-10-03").longestDays, 1);
});

test("server reset delays use next local midnight on 23/25-hour DST days", () => {
    for (const [start, hours] of [["2026-03-08T05:00:00Z", 23], ["2026-11-01T04:00:00Z", 25]]) {
        const now = new Date(start);
        assert.equal(goalsLogic.millisecondsUntilNextDay(now, "America/New_York"), hours * 3600000);
        assert.equal(activityStreak([day("2026-03-07"), day("2026-03-08")], "2026-03-09", true).currentDays, 3);
    }
    assert.equal(goalsLogic.millisecondsUntilNextDay(new Date("2026-10-05T03:59:59.900Z"), "America/New_York"), 100);
});

// Execute the real Lambda handlers with in-memory command boundaries: no AWS SDK
// is imported and no network is possible. Other logic modules are production code.
async function fixture() {
    let now = "2026-10-05T16:00:00Z";
    const items = new Map();
    const key = item => `${item.PK.S}|${item.SK.S}`;
    const put = (sk, fields, pk = "USER#test") => {
        const item = { PK: { S: pk }, SK: { S: sk }, ...fields };
        items.set(key(item), item);
        return item;
    };
    const get = sk => items.get(`USER#test|${sk}`);
    put("PROFILE", { timeZone: { S: "America/New_York" }, xp: { N: "0" }, coins: { N: "0" }, worldPoints: { N: "10" }, tasksCompleted: { N: "0" } });
    const calls = [];
    class GetItemCommand { constructor(input) { this.input = input; } }
    class QueryCommand { constructor(input) { this.input = input; } }
    class TransactWriteItemsCommand { constructor(input) { this.input = input; } }
    let failNext = false;
    class DynamoDBClient {
        async send(command) {
            const input = command.input;
            calls.push(command);
            if (command instanceof GetItemCommand) return { Item: structuredClone(items.get(key(input.Key))) };
            if (command instanceof QueryCommand) {
                const values = input.ExpressionAttributeValues;
                const matching = [...items.values()].filter(item => item.PK.S === values[":pk"].S && item.SK.S.startsWith(values[":prefix"].S));
                const offset = input.ExclusiveStartKey ? matching.findIndex(item => key(item) === key(input.ExclusiveStartKey)) + 1 : 0;
                const page = matching.slice(offset, offset + 2); // Exercise pagination.
                return { Items: structuredClone(page), LastEvaluatedKey: offset + 2 < matching.length ? page.at(-1) : undefined };
            }
            assert.ok(command instanceof TransactWriteItemsCommand);
            if (failNext) { failNext = false; throw Object.assign(new Error("conflict"), { name: "TransactionConflictException" }); }
            for (const entry of input.TransactItems) {
                if (entry.Put) {
                    assert.equal(items.has(key(entry.Put.Item)), false, "conditional put must not overwrite history/completion");
                    items.set(key(entry.Put.Item), structuredClone(entry.Put.Item));
                } else {
                    const update = entry.Update;
                    const current = items.get(key(update.Key)) ?? { ...update.Key };
                    const names = update.ExpressionAttributeNames, values = update.ExpressionAttributeValues;
                    const [sets, adds] = update.UpdateExpression.replace(/^SET /, "").split(" ADD ");
                    for (const set of sets.split(", ")) {
                        const [name, value] = set.split(" = ");
                        current[names[name]] = structuredClone(values[value]);
                    }
                    for (const add of (adds ?? "").split(", ").filter(Boolean)) {
                        const [name, value] = add.split(" ");
                        current[names[name]] = { N: String(Number(current[names[name]]?.N ?? 0) + Number(values[value].N)) };
                    }
                    items.set(key(current), current);
                }
            }
            return {};
        }
    }
    const sdk = { DynamoDBClient, GetItemCommand, QueryCommand, TransactWriteItemsCommand };
    function handler(name, logic) {
        const imports = {
            "node:crypto": { randomUUID }, "@aws-sdk/client-dynamodb": sdk, "./logic.mjs": logic,
            "/opt/nodejs/task-completion.mjs": completionLogic, "/opt/nodejs/task-schedule.mjs": taskSchedule,
            "/opt/nodejs/http.mjs": http, "/opt/nodejs/leveling.mjs": leveling, "/opt/nodejs/task-rewards.mjs": rewards,
            "/opt/nodejs/achievements.mjs": achievements, "/opt/nodejs/building-effects.mjs": buildings,
            "/opt/nodejs/activity-streak.mjs": { activityStreak }
        };
        const source = readFileSync(new URL(`../functions/${name}/index.mjs`, import.meta.url), "utf8")
            .replace(/import\s*\{([^}]+)\}\s*from\s*"([^"]+)";/g, (_, members, path) =>
                `const {${members.replace(/\bas\b/g, ":")}} = imports[${JSON.stringify(path)}];`)
            .replace("export const handler", "const handler");
        const Clock = class extends Date { constructor(value = now) { super(value); } };
        return new Function("imports", "Date", "process", `${source}\nreturn handler;`)(imports, Clock, { env: {} });
    }
    const complete = handler("complete-task", completionLogic), goals = handler("get-goals", goalsLogic);
    const event = { requestContext: { authorizer: { jwt: { claims: { sub: "test" } } } } };
    return {
        put, get, calls, setNow: value => { now = value; }, conflict: () => { failNext = true; },
        task: (id, repeatType = "NONE") => put(`TASK#${id}`, { taskId: { S: id }, title: { S: id }, taskSize: { S: "QUICK" }, repeatType: { S: repeatType }, active: { BOOL: true } }),
        complete: async id => { const result = await complete({ ...event, pathParameters: { taskId: id } }); return { status: result.statusCode, ...JSON.parse(result.body) }; },
        goals: async () => { const result = await goals(event); assert.equal(result.statusCode, 200); return JSON.parse(result.body); }
    };
}

test("real completion/read handlers persist daily+weekly rewards once, preview building bonuses, and retry safely", async () => {
    const f = await fixture();
    f.put("BUILDING#garden", { effectsByLevel: { L: [{ M: { level: { N: "1" }, effects: { L: [
        { M: { type: { S: "DAILY_WORLD_POINTS_BONUS" }, value: { N: "7" } } },
        { M: { type: { S: "WEEKLY_WORLD_POINTS_BONUS" }, value: { N: "13" } } }
    ] } } }] } }, "CATALOG#BUILDINGS");
    f.put("STATS#WEEK#2026-W41", { tasksCompleted: { N: "12" } });
    const initial = await f.goals();
    assert.equal(initial.daily.tasks.reward.worldPoints, 32);
    assert.equal(initial.weekly.tasks.reward.worldPoints, 113);
    for (let i = 1; i <= 4; i++) {
        f.task(`task${i}`);
        if (i === 3) f.conflict();
        const result = await f.complete(`task${i}`);
        assert.equal(result.status, 200);
        assert.equal(result.goalRewards.daily.tasksCompleted, i);
        assert.equal(result.goalRewards.weekly.tasksCompleted, 12 + i);
        assert.equal(result.activityStreak.currentDays, 1);
        assert.equal(result.activityStreak.increased, i === 1);
        assert.equal(result.rewards.worldPoints, i === 3 ? 145 : 0);
        assert.equal(result.goalRewards.daily.awarded, i === 3);
        assert.equal(result.goalRewards.weekly.awarded, i === 3);
    }
    assert.equal((await f.complete("task3")).status, 409);
    assert.equal(f.get("PROFILE").worldPoints.N, "155");
    assert.equal(f.get("STATS#DAY#2026-10-05").tasksCompleted.N, "4");
    const status = await f.goals();
    assert.equal(status.daily.tasks.reward.granted, true);
    assert.equal(status.weekly.tasks.reward.granted, true);
    assert.equal(status.daily.tasks.reward.earnedWorldPoints, 32);
    assert.equal(status.weekly.tasks.reward.earnedWorldPoints, 113);
    assert.equal(status.player.worldPoints, 155);
    assert.ok(status.daily.tasks.reward.grantedAt);
    const transactions = f.calls.filter(call => call.input.TransactItems);
    const award = transactions.flatMap(call => call.input.TransactItems).find(entry => entry.Update?.ExpressionAttributeNames["#goalWorldPoints"]);
    assert.match(award.Update.ConditionExpression, /#tasksCompleted = :expectedTasksCompleted/);
    assert.match(award.Update.ConditionExpression, /attribute_not_exists\(#goalRewarded\) OR #goalRewarded = :false/);
    // Historical award stays exact if a later catalog change removes the preview bonus.
    f.put("BUILDING#garden", {}, "CATALOG#BUILDINGS");
    assert.equal((await f.goals()).daily.tasks.reward.earnedWorldPoints, 32);
});

test("recurring duplicates, next-day activity, reset, pagination and timezone changes remain server-owned", async () => {
    const f = await fixture();
    f.task("daily", "DAILY");
    assert.equal((await f.complete("daily")).activityStreak.currentDays, 1);
    assert.equal((await f.complete("daily")).status, 409);
    f.setNow("2026-10-06T03:59:59Z");
    assert.equal((await f.complete("daily")).status, 409, "still yesterday in profile timezone");
    f.setNow("2026-10-06T04:00:00Z");
    assert.equal((await f.goals()).daily.tasks.current, 0);
    assert.equal((await f.complete("daily")).activityStreak.currentDays, 2);
    f.setNow("2026-10-07T16:00:00Z");
    assert.equal((await f.complete("daily")).activityStreak.currentDays, 3);
    assert.equal((await f.goals()).streak.longestDays, 3, "all query pages included");
    f.setNow("2026-10-09T16:00:00Z");
    assert.equal((await f.goals()).streak.currentDays, 0);
    assert.equal((await f.complete("daily")).activityStreak.currentDays, 1);
    assert.equal((await f.goals()).streak.longestDays, 3);
    f.setNow("2026-10-12T03:59:59Z");
    assert.equal((await f.goals()).week, "2026-W41");
    f.get("PROFILE").timeZone = { S: "Asia/Tokyo" };
    const changed = await f.goals();
    assert.equal(changed.date, "2026-10-12");
    assert.equal(changed.week, "2026-W42");
    assert.equal(changed.weekly.tasks.current, 0);
    assert.equal(changed.streak.completedToday, false);
});

test("monthly handler reuses transactional rewards/history and same-date guards survive recurrence removal", async () => {
    const f = await fixture();
    const stored = f.task("month", "MONTHLY");
    stored.startDate = { S: "2026-01-31" };
    stored.dueTime = { S: "09:00" };
    stored.updatedAt = { S: "2026-01-01T00:00:00Z" };
    f.setNow("2026-01-31T17:00:00Z");
    f.conflict();
    const first = await f.complete("month");
    assert.equal(first.status, 200); assert.equal(first.task.nextScheduledDate, "2026-02-28");
    assert.equal((await f.complete("month")).status, 409);
    f.get("TASK#month").repeatType = { S: "NONE" };
    assert.equal((await f.complete("month")).status, 409, "removing recurrence cannot award a second same-day completion");
    f.get("TASK#month").repeatType = { S: "MONTHLY" };
    f.setNow("2026-02-27T17:00:00Z");
    assert.equal((await f.complete("month")).status, 400);
    f.setNow("2026-02-28T17:00:00Z");
    const second = await f.complete("month");
    assert.equal(second.status, 200); assert.equal(second.task.nextScheduledDate, "2026-03-31");
    assert.equal(second.streak.current, 2); assert.equal(second.activityStreak.currentDays, 1);
    assert.equal(f.get("PROFILE").tasksCompleted.N, "2");
    assert.equal(f.get("PROFILE").xp.N, "20");
    const writes = f.calls.filter(call => call.input.TransactItems).flatMap(call => call.input.TransactItems);
    const taskWrite = writes.find(entry => entry.Update?.Key.SK.S === "TASK#month").Update;
    assert.match(taskWrite.ConditionExpression, /#updatedAt = :expectedUpdatedAt/);
    assert.deepEqual(taskWrite.ExpressionAttributeValues[":false"], { BOOL: false });
    const profileWrite = writes.find(entry => entry.Update?.Key.SK.S === "PROFILE").Update;
    assert.match(profileWrite.ConditionExpression, /#timeZone = :expectedTimeZone/);
    assert.ok(writes.some(entry => entry.Put?.Item.SK.S.startsWith("COMPLETION_HISTORY#")));
});

test("a lost success response followed by retry or recurrence edits never repeats rewards or quest increments", async () => {
    const f = await fixture();
    f.task("timeout", "NONE");
    // The write commits, but pretend the client never received its success response.
    await f.complete("timeout");
    const profile = structuredClone(f.get("PROFILE"));
    const day = structuredClone(f.get("STATS#DAY#2026-10-05"));
    const week = structuredClone(f.get("STATS#WEEK#2026-W41"));
    for (const repeatType of ["NONE", "DAILY", "WEEKLY", "MONTHLY", "NONE"]) {
        Object.assign(f.get("TASK#timeout"), { repeatType: { S: repeatType }, repeatDays: { L: [{ S: "MON" }] }, startDate: { S: "2026-10-05" } });
        assert.equal((await f.complete("timeout")).status, 409);
        assert.deepEqual(f.get("PROFILE"), profile);
        assert.deepEqual(f.get("STATS#DAY#2026-10-05"), day);
        assert.deepEqual(f.get("STATS#WEEK#2026-W41"), week);
    }
});

test("every recurring transaction expression binds all attribute names and values", async () => {
    const f = await fixture();
    for (const type of ["DAILY", "WEEKLY", "MONTHLY"]) {
        const row = f.task(type, type);
        row.startDate = { S: "2026-10-05" }; row.repeatDays = { L: [{ S: "MON" }] };
        assert.equal((await f.complete(type)).status, 200);
    }
    for (const command of f.calls.filter(call => call.input.TransactItems)) {
        for (const entry of command.input.TransactItems) {
            const operation = entry.Update ?? entry.Put;
            const expression = `${operation.ConditionExpression ?? ""} ${operation.UpdateExpression ?? ""}`;
            for (const value of expression.match(/:\w+/g) ?? []) assert.ok(operation.ExpressionAttributeValues?.[value], `Missing ${value}`);
            for (const name of expression.match(/#\w+/g) ?? []) assert.ok(operation.ExpressionAttributeNames?.[name], `Missing ${name}`);
        }
    }
});
