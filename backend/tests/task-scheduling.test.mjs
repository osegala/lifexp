import test from "node:test";
import assert from "node:assert/strict";
import {
    effectiveCurrentStreak,
    isArchived,
    isScheduledOn,
    visibleTasks,
    wasCompletedOn
} from "../functions/get-tasks/task-rules.mjs";
import { archiveTaskRequest } from "../functions/delete-task/logic.mjs";
import { BLOCKED_FIELDS, isArchivedTask } from "../functions/update-task/logic.mjs";

const weeklyTask = {
    active: { BOOL: true },
    repeatType: { S: "WEEKLY" },
    repeatDays: { L: [{ S: "MON" }, { S: "WED" }, { S: "FRI" }] },
    currentStreak: { N: "4" },
    bestStreak: { N: "6" },
    lastCompletedDate: { S: "2026-09-18" }
};

test("weekly scheduling preserves a streak through unscheduled days", () => {
    assert.equal(isScheduledOn(weeklyTask, "2026-09-21"), true);
    assert.equal(isScheduledOn(weeklyTask, "2026-09-22"), false);
    assert.equal(effectiveCurrentStreak(weeklyTask, "2026-09-21"), 4);
    assert.equal(effectiveCurrentStreak(weeklyTask, "2026-09-23"), 0);
});

test("a one-time task completed today remains scheduled but is not due", () => {
    const task = {
        active: { BOOL: true },
        repeatType: { S: "NONE" },
        completed: { BOOL: true },
        completedAt: { S: "2026-09-22T14:00:00.000Z" }
    };
    const completedToday = wasCompletedOn(task, "2026-09-22", "America/New_York");
    const scheduledToday = isScheduledOn(task, "2026-09-22", completedToday);

    assert.equal(completedToday, true);
    assert.equal(scheduledToday, true);
    assert.equal(scheduledToday && !completedToday, false);
    assert.equal(isScheduledOn(task, "2026-09-23", false), false);
});

test("DELETE archives the task without removing its DynamoDB item", () => {
    const request = archiveTaskRequest(
        "Evrenthia-Dev",
        { PK: { S: "USER#user-1" }, SK: { S: "TASK#task-1" } },
        "2026-09-23T12:00:00.000Z"
    );

    assert.equal(request.UpdateExpression.includes("#archived = :true"), true);
    assert.equal(request.UpdateExpression.includes("#active = :false"), true);
    assert.equal(request.UpdateExpression.includes("if_not_exists(#archivedAt, :now)"), true);
    assert.deepEqual(request.Key, {
        PK: { S: "USER#user-1" },
        SK: { S: "TASK#task-1" }
    });
});

test("archived tasks are excluded by default and unscheduled", () => {
    const active = { taskId: "active", archived: false };
    const archived = { taskId: "archived", archived: true };

    assert.deepEqual(visibleTasks([active, archived]), [active]);
    assert.deepEqual(visibleTasks([active, archived], true), [active, archived]);
    assert.equal(isArchived({ archived: { BOOL: true } }), true);
    assert.equal(isScheduledOn({
        archived: { BOOL: true },
        active: { BOOL: true },
        repeatType: { S: "DAILY" }
    }, "2026-09-23"), false);
});

test("archived tasks are rejected by normal PATCH logic", () => {
    assert.equal(isArchivedTask({ archived: { BOOL: true } }), true);
    assert.equal(isArchivedTask({ archived: { BOOL: false } }), false);
    assert.equal(BLOCKED_FIELDS.has("archived"), true);
    assert.equal(BLOCKED_FIELDS.has("archivedAt"), true);
});
