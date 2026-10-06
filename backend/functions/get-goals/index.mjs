import {
    DynamoDBClient,
    GetItemCommand,
    QueryCommand
} from "@aws-sdk/client-dynamodb";
import {
    buildGoal,
    isoWeekId,
    localDate,
    millisecondsUntilNextDay
} from "./logic.mjs";
import {
    authSubject,
    handleApiError,
    internalServerError,
    jsonResponse as response,
    requireActivePlayer,
    unauthorized
} from "/opt/nodejs/http.mjs";
import { activityStreak } from "/opt/nodejs/activity-streak.mjs";
import { buildingCatalogFromItem, playerBuildingsFromItems, resolveBuildingEffects } from "/opt/nodejs/building-effects.mjs";

const client = new DynamoDBClient({});
const TABLE_NAME = process.env.TABLE_NAME;
const DAILY_TASK_TARGET = Number(process.env.DAILY_TASK_TARGET ?? 3);
const WEEKLY_TASK_TARGET = Number(process.env.WEEKLY_TASK_TARGET ?? 15);
const DAILY_WORLD_POINTS_REWARD = Number(process.env.DAILY_WORLD_POINTS_REWARD ?? 25);
const WEEKLY_WORLD_POINTS_REWARD = Number(process.env.WEEKLY_WORLD_POINTS_REWARD ?? 100);

async function getItem(key) {
    const result = await client.send(new GetItemCommand({
        TableName: TABLE_NAME,
        Key: key,
        ConsistentRead: true
    }));
    return result.Item ?? {};
}

function number(item, field) {
    return Number(item[field]?.N ?? 0);
}

async function queryPrefix(pk, prefix) {
    const items = [];
    let ExclusiveStartKey;
    do {
        const result = await client.send(new QueryCommand({
            TableName: TABLE_NAME,
            KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
            ExpressionAttributeValues: { ":pk": { S: pk }, ":prefix": { S: prefix } },
            ConsistentRead: true,
            ExclusiveStartKey
        }));
        items.push(...(result.Items ?? []));
        ExclusiveStartKey = result.LastEvaluatedKey;
    } while (ExclusiveStartKey);
    return items;
}

export const handler = async (event) => {
    const userId = authSubject(event);
    if (!userId) {
        return unauthorized();
    }
    let profile;
    try {
        ({ profile } = await requireActivePlayer(event, client, TABLE_NAME, GetItemCommand));
    } catch (error) {
        return handleApiError(error, "Get goals active player check failed");
    }

    try {
        const userPk = `USER#${userId}`;
        const timeZone = profile.timeZone?.S ?? "UTC";
        const now = new Date();
        const date = localDate(now, timeZone);
        const week = isoWeekId(date);
        const [dailyItems, weekly, buildingCatalog, playerBuildings] = await Promise.all([
            queryPrefix(userPk, "STATS#DAY#"),
            getItem({ PK: { S: userPk }, SK: { S: `STATS#WEEK#${week}` } }),
            queryPrefix("CATALOG#BUILDINGS", "BUILDING#"),
            queryPrefix(userPk, "BUILDING#")
        ]);
        const daily = dailyItems.find((item) => item.SK?.S === `STATS#DAY#${date}`) ?? {};
        const { effects } = resolveBuildingEffects(
            buildingCatalog.map(buildingCatalogFromItem), playerBuildingsFromItems(playerBuildings)
        );
        const dailyTasksCompleted = number(daily, "tasksCompleted");
        const weeklyTasksCompleted = number(weekly, "tasksCompleted");

        return response(200, {
            timeZone,
            date,
            week,
            refreshAfterMs: Math.max(0, millisecondsUntilNextDay(now, timeZone) - (new Date() - now)),
            streak: activityStreak(dailyItems, date),
            player: {
                worldPoints: number(profile, "worldPoints")
            },
            daily: {
                tasks: buildGoal(
                    dailyTasksCompleted,
                    DAILY_TASK_TARGET,
                    DAILY_WORLD_POINTS_REWARD + effects.dailyWorldPointsBonus,
                    daily.goalRewarded?.BOOL ?? false,
                    daily.goalRewardedAt?.S ?? null,
                    daily.goalWorldPoints?.N == null ? undefined : number(daily, "goalWorldPoints")
                ),
                stats: {
                    tasksCompleted: dailyTasksCompleted,
                    xpEarned: number(daily, "xpEarned"),
                    coinsEarned: number(daily, "coinsEarned")
                }
            },
            weekly: {
                tasks: buildGoal(
                    weeklyTasksCompleted,
                    WEEKLY_TASK_TARGET,
                    WEEKLY_WORLD_POINTS_REWARD + effects.weeklyWorldPointsBonus,
                    weekly.goalRewarded?.BOOL ?? false,
                    weekly.goalRewardedAt?.S ?? null,
                    weekly.goalWorldPoints?.N == null ? undefined : number(weekly, "goalWorldPoints")
                ),
                stats: {
                    tasksCompleted: weeklyTasksCompleted,
                    xpEarned: number(weekly, "xpEarned"),
                    coinsEarned: number(weekly, "coinsEarned")
                }
            }
        });
    } catch (error) {
        return internalServerError("Get goals failed", error);
    }
};
