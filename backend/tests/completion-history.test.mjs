import test from "node:test";
import assert from "node:assert/strict";
import {
    decodeCursor,
    encodeCursor,
    historyItem,
    historyQuery,
    HistoryQueryError
} from "../functions/get-completion-history/logic.mjs";

test("completion history queries newest first with a bounded default page", () => {
    const query = historyQuery("Evrenthia-Dev", "USER#user-1");
    assert.equal(query.ScanIndexForward, false);
    assert.equal(query.Limit, 50);
    assert.equal(query.KeyConditionExpression, "PK = :pk AND begins_with(SK, :prefix)");
});

test("completion history supports task filtering and opaque pagination", () => {
    const sortKey = "COMPLETION_HISTORY#2026-09-23T12:00:00.000Z#completion-1";
    const cursor = encodeCursor(sortKey);
    const query = historyQuery("Evrenthia-Dev", "USER#user-1", {
        taskId: "task-1",
        limit: "25",
        cursor
    });

    assert.notEqual(cursor, sortKey);
    assert.equal(decodeCursor(cursor), sortKey);
    assert.equal(query.FilterExpression, "#taskId = :taskId");
    assert.deepEqual(query.ExpressionAttributeValues[":taskId"], { S: "task-1" });
    assert.deepEqual(query.ExclusiveStartKey, {
        PK: { S: "USER#user-1" },
        SK: { S: sortKey }
    });
    assert.throws(
        () => historyQuery("Evrenthia-Dev", "USER#user-1", { cursor: "invalid" }),
        (error) => error instanceof HistoryQueryError && error.message === "Invalid cursor"
    );
});

test("completion history maps snapshots without exposing DynamoDB keys", () => {
    const item = historyItem({
        PK: { S: "USER#user-1" },
        SK: { S: "COMPLETION_HISTORY#2026-09-23T12:00:00.000Z#completion-1" },
        completionId: { S: "completion-1" },
        taskId: { S: "task-1" },
        taskTitle: { S: "Original title" },
        taskDescription: { NULL: true },
        repeatType: { S: "WEEKLY" },
        repeatDays: { L: [{ S: "MON" }, { S: "FRI" }] },
        completedAt: { S: "2026-09-23T12:00:00.000Z" },
        localDate: { S: "2026-09-23" },
        timeZone: { S: "America/New_York" },
        xpEarned: { N: "10" },
        coinsEarned: { N: "1" },
        worldPointsEarned: { N: "25" },
        currentStreak: { N: "3" },
        bestStreak: { N: "5" }
    });

    assert.equal(item.taskTitle, "Original title");
    assert.equal(item.taskDescription, null);
    assert.deepEqual(item.repeatDays, ["MON", "FRI"]);
    assert.equal(item.worldPointsEarned, 25);
    assert.equal("PK" in item, false);
    assert.equal("SK" in item, false);
});
