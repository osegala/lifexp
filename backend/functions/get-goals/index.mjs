import {
    DynamoDBClient,
    GetItemCommand
} from "@aws-sdk/client-dynamodb";
import {
    buildGoal,
    isoWeekId,
    localDate
} from "./logic.mjs";
import { authSubject, internalServerError, jsonResponse as response, notFound, unauthorized } from "/opt/nodejs/http.mjs";

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

export const handler = async (event) => {
    const userId = authSubject(event);
    if (!userId) {
        return unauthorized();
    }

    try {
        const userPk = `USER#${userId}`;
        const profile = await getItem({ PK: { S: userPk }, SK: { S: "PROFILE" } });

        if (!profile.PK) {
            return notFound("PROFILE_NOT_FOUND", "Player profile not found.");
        }

        const timeZone = profile.timeZone?.S ?? "America/New_York";
        const date = localDate(new Date(), timeZone);
        const week = isoWeekId(date);
        const [daily, weekly] = await Promise.all([
            getItem({ PK: { S: userPk }, SK: { S: `STATS#DAY#${date}` } }),
            getItem({ PK: { S: userPk }, SK: { S: `STATS#WEEK#${week}` } })
        ]);
        const dailyTasksCompleted = number(daily, "tasksCompleted");
        const weeklyTasksCompleted = number(weekly, "tasksCompleted");

        return response(200, {
            timeZone,
            date,
            week,
            player: {
                worldPoints: number(profile, "worldPoints")
            },
            daily: {
                tasks: buildGoal(
                    dailyTasksCompleted,
                    DAILY_TASK_TARGET,
                    DAILY_WORLD_POINTS_REWARD,
                    daily.goalRewarded?.BOOL ?? false,
                    daily.goalRewardedAt?.S ?? null
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
                    WEEKLY_WORLD_POINTS_REWARD,
                    weekly.goalRewarded?.BOOL ?? false,
                    weekly.goalRewardedAt?.S ?? null
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
