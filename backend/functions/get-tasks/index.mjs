import {
    DynamoDBClient,
    GetItemCommand,
    QueryCommand
} from "@aws-sdk/client-dynamodb";
import {
    effectiveCurrentStreak,
    isArchived,
    isScheduledOn,
    localDate,
    repeatDays,
    visibleTasks,
    wasCompletedOn,
    weekday
} from "./task-rules.mjs";
import {
    authSubject,
    badRequest,
    internalServerError,
    jsonResponse as response,
    notFound,
    unauthorized
} from "/opt/nodejs/http.mjs";

const client = new DynamoDBClient({});
const TABLE_NAME = process.env.TABLE_NAME;

function userIdFrom(event) {
    return authSubject(event);
}

async function queryTasks(userPk) {
    const items = [];
    let ExclusiveStartKey;

    do {
        const result = await client.send(new QueryCommand({
            TableName: TABLE_NAME,
            KeyConditionExpression: "PK = :pk AND begins_with(SK, :task)",
            ExpressionAttributeValues: {
                ":pk": { S: userPk },
                ":task": { S: "TASK#" }
            },
            ExclusiveStartKey,
            ConsistentRead: true
        }));

        items.push(...(result.Items ?? []));
        ExclusiveStartKey = result.LastEvaluatedKey;
    } while (ExclusiveStartKey);

    return items;
}

function taskResponse(item, today, timeZone) {
    const archived = isArchived(item);
    const completedToday = wasCompletedOn(item, today, timeZone);
    const scheduled = isScheduledOn(item, today, completedToday);
    const completed = item.completed?.BOOL === true;

    return {
        taskId: item.taskId?.S ?? item.SK.S.slice("TASK#".length),
        title: item.title?.S ?? "",
        description: item.description?.S ?? null,
        repeatType: item.repeatType?.S ?? "NONE",
        repeatDays: repeatDays(item),
        active: item.active?.BOOL !== false,
        archived,
        archivedAt: item.archivedAt?.S ?? null,
        completed,
        completedAt: item.completedAt?.S ?? null,
        isScheduledToday: scheduled,
        completedToday,
        isDueToday: scheduled && !completedToday,
        currentStreak: effectiveCurrentStreak(item, today),
        bestStreak: Number(item.bestStreak?.N ?? 0),
        xpReward: Number(item.xpReward?.N ?? 10),
        coinReward: Number(item.coinReward?.N ?? 1),
        lastCompletedDate: item.lastCompletedDate?.S ?? null,
        lastCompletedAt: item.lastCompletedAt?.S ?? null,
        createdAt: item.createdAt?.S ?? null,
        updatedAt: item.updatedAt?.S ?? null
    };
}

export const handler = async (event) => {
    const userId = userIdFrom(event);

    if (!userId) {
        return unauthorized();
    }

    try {
        const userPk = `USER#${userId}`;
        const profileResult = await client.send(new GetItemCommand({
            TableName: TABLE_NAME,
            Key: { PK: { S: userPk }, SK: { S: "PROFILE" } },
            ConsistentRead: true
        }));

        if (!profileResult.Item) {
            return notFound("PROFILE_NOT_FOUND", "Player profile not found.");
        }

        const timeZone = profileResult.Item.timeZone?.S ?? "UTC";
        let today;

        try {
            today = localDate(new Date(), timeZone);
        } catch (error) {
            if (error instanceof RangeError) {
                return internalServerError("Get tasks found an invalid profile time zone", error);
            }
            throw error;
        }

        const includeArchivedValue = event.queryStringParameters?.includeArchived;
        if (includeArchivedValue !== undefined && !["true", "false"].includes(includeArchivedValue)) {
            return badRequest("VALIDATION_ERROR", "includeArchived must be true or false.");
        }
        const includeArchived = includeArchivedValue === "true";
        const allTasks = (await queryTasks(userPk))
            .map((item) => taskResponse(item, today, timeZone))
            .sort((left, right) => (right.createdAt ?? "").localeCompare(left.createdAt ?? ""));
        const summaryTasks = allTasks.filter((task) => !task.archived);
        const tasks = visibleTasks(allTasks, includeArchived);

        return response(200, {
            time: {
                timeZone,
                date: today,
                weekday: weekday(today)
            },
            summary: {
                total: summaryTasks.length,
                active: summaryTasks.filter((task) => task.active).length,
                scheduledToday: summaryTasks.filter((task) => task.isScheduledToday).length,
                dueToday: summaryTasks.filter((task) => task.isDueToday).length,
                completedToday: summaryTasks.filter((task) => task.completedToday).length
            },
            tasks
        });
    } catch (error) {
        return internalServerError("Get tasks failed", error);
    }
};
