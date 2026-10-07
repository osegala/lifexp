import {
    DynamoDBClient,
    GetItemCommand,
    UpdateItemCommand,
    QueryCommand,
    TransactWriteItemsCommand
} from "@aws-sdk/client-dynamodb";
import {
    authSubject,
    badRequest,
    conflict,
    handleApiError,
    internalServerError,
    jsonResponse as response,
    notFound,
    parseJsonBody,
    requireActivePlayer,
    requiredString,
    unauthorized
} from "/opt/nodejs/http.mjs";
import { validateTaskPatch } from "/opt/nodejs/task-input.mjs";
import { resolveTaskReward, rewardForTaskSize } from "/opt/nodejs/task-rewards.mjs";
import { notificationWakeups } from "/opt/nodejs/notification-wakeup.mjs";

const client = new DynamoDBClient({});
const TABLE_NAME = process.env.TABLE_NAME;
function storedRepeatDays(item) {
    if (item.repeatDays?.L) {
        return item.repeatDays.L.map((value) => value.S).filter(Boolean);
    }
    return item.repeatDays?.SS ?? [];
}

function taskResponse(item) {
    const repeatDays = storedRepeatDays(item);
    const reward = resolveTaskReward({
        taskSize: item.taskSize?.S,
        xpReward: item.xpReward?.N,
        coinReward: item.coinReward?.N
    });
    return {
        taskId: item.taskId?.S ?? item.SK.S.slice("TASK#".length),
        title: item.title?.S ?? "",
        description: item.description?.S ?? null,
        taskSize: reward.taskSize,
        repeatType: item.repeatType?.S ?? "NONE",
        repeatDays,
        startDate: item.startDate?.S ?? null,
        dueTime: item.dueTime?.S ?? null,
        active: item.active?.BOOL !== false,
        completed: item.completed?.BOOL === true,
        completedAt: item.completedAt?.S ?? null,
        currentStreak: Number(item.currentStreak?.N ?? 0),
        bestStreak: Number(item.bestStreak?.N ?? 0),
        xpReward: reward.xp,
        coinReward: reward.coins,
        lastCompletedDate: item.lastCompletedDate?.S ?? null,
        lastCompletedAt: item.lastCompletedAt?.S ?? null,
        createdAt: item.createdAt?.S ?? null,
        updatedAt: item.updatedAt?.S ?? null
    };
}

export const handler = async (event) => {
    const userId = authSubject(event);
    let taskId;

    if (!userId) {
        return unauthorized();
    }
    try {
        await requireActivePlayer(event, client, TABLE_NAME, GetItemCommand);
    } catch (error) {
        return handleApiError(error, "Update task active player check failed");
    }
    try {
        taskId = requiredString(event.pathParameters ?? {}, "taskId");
    } catch (error) {
        return handleApiError(error, "Update task path validation failed");
    }

    let body;
    try {
        body = parseJsonBody(event);
    } catch (error) {
        return handleApiError(error, "Update task JSON parsing failed");
    }

    const key = {
        PK: { S: `USER#${userId}` },
        SK: { S: `TASK#${taskId}` }
    };

    try {
        const existingResult = await client.send(new GetItemCommand({
            TableName: TABLE_NAME,
            Key: key,
            ConsistentRead: true
        }));
        const existing = existingResult.Item;

        if (!existing) {
            return notFound("TASK_NOT_FOUND", "Task not found.");
        }
        if (existing.archived?.BOOL === true) {
            return conflict("TASK_ARCHIVED", "Archived tasks cannot be edited.");
        }

        let patch;
        try {
            patch = validateTaskPatch(body, {
                repeatType: existing.repeatType?.S ?? "NONE",
                repeatDays: storedRepeatDays(existing),
                startDate: existing.startDate?.S ?? null
            });
        } catch (error) {
            return handleApiError(error, "Update task validation failed");
        }

        const names = { "#updatedAt": "updatedAt", "#archived": "archived" };
        const values = { ":updatedAt": { S: new Date().toISOString() }, ":false": { BOOL: false } };
        const setExpressions = ["#updatedAt = :updatedAt"];
        const removeExpressions = [];
        const versionCondition = existing.updatedAt?.S
            ? "#updatedAt = :expectedUpdatedAt" : "attribute_not_exists(#updatedAt)";
        if (existing.updatedAt?.S) values[":expectedUpdatedAt"] = existing.updatedAt;

        for (const field of ["startDate", "dueTime"]) {
            if (!(field in patch)) continue;
            names[`#${field}`] = field;
            if (patch[field] == null) removeExpressions.push(`#${field}`);
            else {
                values[`:${field}`] = { S: patch[field] };
                setExpressions.push(`#${field} = :${field}`);
            }
        }

        if ("title" in patch) {
            names["#title"] = "title";
            values[":title"] = { S: patch.title };
            setExpressions.push("#title = :title");
        }

        if ("description" in patch) {
            names["#description"] = "description";
            if (patch.description == null) {
                removeExpressions.push("#description");
            } else {
                values[":description"] = { S: patch.description };
                setExpressions.push("#description = :description");
            }
        }

        if ("active" in patch) {
            names["#active"] = "active";
            values[":active"] = { BOOL: patch.active };
            setExpressions.push("#active = :active");
        }

        if ("taskSize" in patch) {
            const reward = rewardForTaskSize(patch.taskSize);
            names["#taskSize"] = "taskSize";
            names["#xpReward"] = "xpReward";
            names["#coinReward"] = "coinReward";
            values[":taskSize"] = { S: patch.taskSize };
            values[":xpReward"] = { N: String(reward.xp) };
            values[":coinReward"] = { N: String(reward.coins) };
            setExpressions.push(
                "#taskSize = :taskSize",
                "#xpReward = :xpReward",
                "#coinReward = :coinReward"
            );
        }

        const repeatType = patch.repeatType ?? existing.repeatType?.S ?? "NONE";
        const scheduleChanged = repeatType !== (existing.repeatType?.S ?? "NONE")
            || ("repeatDays" in patch && [...patch.repeatDays].sort().join() !== storedRepeatDays(existing).sort().join())
            || ("startDate" in patch && patch.startDate !== (existing.startDate?.S ?? null));
        if (scheduleChanged) {
            // A new rule starts a new streak, but never erases completion/duplicate guards or best streak.
            names["#currentStreak"] = "currentStreak";
            values[":zero"] = { N: "0" };
            setExpressions.push("#currentStreak = :zero");
        }
        if ("repeatType" in patch) {
            names["#repeatType"] = "repeatType";
            values[":repeatType"] = { S: repeatType };
            setExpressions.push("#repeatType = :repeatType");
        }

        if ("repeatDays" in patch || ("repeatType" in patch && repeatType !== "WEEKLY")) {
            const repeatDays = repeatType === "WEEKLY"
                ? patch.repeatDays ?? storedRepeatDays(existing)
                : [];
            names["#repeatDays"] = "repeatDays";
            values[":repeatDays"] = { L: repeatDays.map((day) => ({ S: day })) };
            setExpressions.push("#repeatDays = :repeatDays");
        }

        const updateExpression = [
            `SET ${setExpressions.join(", ")}`,
            removeExpressions.length ? `REMOVE ${removeExpressions.join(", ")}` : ""
        ].filter(Boolean).join(" ");

        const request = {
            TableName: TABLE_NAME,
            Key: key,
            UpdateExpression: updateExpression,
            ExpressionAttributeNames: names,
            ExpressionAttributeValues: values,
            ConditionExpression: `attribute_exists(PK) AND attribute_exists(SK) AND (attribute_not_exists(#archived) OR #archived = :false) AND ${versionCondition}`,
            ReturnValues: "ALL_NEW"
        };
        const affectsReminders = ["repeatType", "repeatDays", "startDate", "dueTime", "active"].some(field => field in patch);
        const wakeups = affectsReminders ? await notificationWakeups(client, QueryCommand, TABLE_NAME, key.PK.S, values[":updatedAt"].S, taskId) : [];
        let result;
        if (wakeups.length) {
            const { ReturnValues: _returnValues, ...update } = request;
            await client.send(new TransactWriteItemsCommand({ TransactItems: [{ Update: update }, ...wakeups] }));
            result = { Attributes: (await client.send(new GetItemCommand({ TableName: TABLE_NAME, Key: key, ConsistentRead: true }))).Item };
        } else result = await client.send(new UpdateItemCommand(request));

        return response(200, taskResponse(result.Attributes));
    } catch (error) {
        if (["ConditionalCheckFailedException", "TransactionCanceledException"].includes(error.name)) {
            return conflict("TASK_CHANGED", "Task changed while saving. Refresh and try again.");
        }
        return internalServerError("Update task failed", error);
    }
};
