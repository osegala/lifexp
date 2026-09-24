import { randomUUID } from "node:crypto";
import {
    DynamoDBClient,
    GetItemCommand,
    QueryCommand,
    TransactWriteItemsCommand
} from "@aws-sdk/client-dynamodb";
import {
    buildCompletionHistory,
    CompletionError,
    isoWeekId,
    localDate,
    planCompletion,
    weekday,
    weekBounds
} from "./logic.mjs";
import {
    achievementCatalogFromItem,
    achievementPut,
    achievementResponse,
    earnedAchievementIdsFromItems,
    evaluateAchievementAwards
} from "/opt/nodejs/achievements.mjs";
import {
    buildingCatalogFromItem,
    percentageBonus,
    playerBuildingsFromItems,
    resolveBuildingEffects
} from "/opt/nodejs/building-effects.mjs";
import {
    authSubject,
    badRequest,
    errorResponse,
    handleApiError,
    internalServerError,
    jsonResponse as response,
    notFound,
    parseJsonBody,
    requiredString,
    unauthorized
} from "/opt/nodejs/http.mjs";

const client = new DynamoDBClient({});
const TABLE_NAME = process.env.TABLE_NAME;
const DEFAULTS = {
    xp: Number(process.env.DEFAULT_TASK_XP ?? 10),
    coins: Number(process.env.DEFAULT_TASK_COINS ?? 1),
    dailyTarget: Number(process.env.DAILY_TASK_TARGET ?? 3),
    weeklyTarget: Number(process.env.WEEKLY_TASK_TARGET ?? 15),
    dailyWorldPoints: Number(process.env.DAILY_WORLD_POINTS_REWARD ?? 25),
    weeklyWorldPoints: Number(process.env.WEEKLY_WORLD_POINTS_REWARD ?? 100)
};

function numberValue(attribute, fallback = 0) {
    const value = Number(attribute?.N ?? fallback);
    return Number.isFinite(value) ? value : fallback;
}

function optionalNumber(attribute) {
    return attribute?.N == null ? undefined : numberValue(attribute);
}

function repeatDays(item) {
    if (item.repeatDays?.L) {
        return item.repeatDays.L.map((value) => value.S).filter(Boolean);
    }
    return item.repeatDays?.SS ?? [];
}

function taskFrom(item, taskId) {
    return {
        taskId: item.taskId?.S ?? taskId,
        title: item.title?.S ?? "",
        description: item.description?.S ?? null,
        repeatType: item.repeatType?.S ?? "NONE",
        repeatDays: repeatDays(item),
        active: item.active?.BOOL !== false,
        archived: item.archived?.BOOL === true,
        completed: item.completed?.BOOL === true,
        completedAt: item.completedAt?.S ?? null,
        currentStreak: numberValue(item.currentStreak),
        bestStreak: numberValue(item.bestStreak),
        lastCompletedDate: item.lastCompletedDate?.S ?? null,
        lastCompletedAt: item.lastCompletedAt?.S ?? null,
        xpReward: optionalNumber(item.xpReward),
        coinReward: optionalNumber(item.coinReward),
        createdAt: item.createdAt?.S ?? null,
        updatedAt: item.updatedAt?.S ?? null
    };
}

function profileFrom(item) {
    return {
        displayName: item.displayName?.S ?? "Adventurer",
        timeZone: item.timeZone?.S ?? "UTC",
        xp: numberValue(item.xp),
        coins: numberValue(item.coins),
        worldPoints: numberValue(item.worldPoints),
        tasksCompleted: numberValue(item.tasksCompleted)
    };
}

function statsFrom(item) {
    return {
        tasksCompleted: numberValue(item?.tasksCompleted),
        goalRewarded: item?.goalRewarded?.BOOL === true,
        hasTasksCompleted: item?.tasksCompleted?.N != null
    };
}

async function getItem(key) {
    const result = await client.send(new GetItemCommand({
        TableName: TABLE_NAME,
        Key: key,
        ConsistentRead: true
    }));
    return result.Item;
}

async function queryPrefix(pk, prefix) {
    const items = [];
    let ExclusiveStartKey;

    do {
        const result = await client.send(new QueryCommand({
            TableName: TABLE_NAME,
            KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
            ExpressionAttributeValues: {
                ":pk": { S: pk },
                ":prefix": { S: prefix }
            },
            ConsistentRead: true,
            ExclusiveStartKey
        }));
        items.push(...(result.Items ?? []));
        ExclusiveStartKey = result.LastEvaluatedKey;
    } while (ExclusiveStartKey);

    return items;
}

function taskUpdate(taskKey, plan, today, now) {
    if (!plan.recurring) {
        return {
            Update: {
                TableName: TABLE_NAME,
                Key: taskKey,
                UpdateExpression: "SET #completed = :true, #completedAt = :now, #updatedAt = :now",
                ConditionExpression: "attribute_exists(PK) AND attribute_exists(SK) AND (attribute_not_exists(#archived) OR #archived = :false) AND (attribute_not_exists(#active) OR #active = :true) AND (attribute_not_exists(#completed) OR #completed = :false)",
                ExpressionAttributeNames: {
                    "#archived": "archived",
                    "#active": "active",
                    "#completed": "completed",
                    "#completedAt": "completedAt",
                    "#updatedAt": "updatedAt"
                },
                ExpressionAttributeValues: {
                    ":true": { BOOL: true },
                    ":false": { BOOL: false },
                    ":now": { S: now }
                }
            }
        };
    }

    return {
        Update: {
            TableName: TABLE_NAME,
            Key: taskKey,
            UpdateExpression: "SET #lastCompletedDate = :today, #lastCompletedAt = :now, #currentStreak = :currentStreak, #bestStreak = :bestStreak, #updatedAt = :now",
            ConditionExpression: "attribute_exists(PK) AND attribute_exists(SK) AND (attribute_not_exists(#archived) OR #archived = :false) AND (attribute_not_exists(#active) OR #active = :true) AND (attribute_not_exists(#lastCompletedDate) OR #lastCompletedDate <> :today)",
            ExpressionAttributeNames: {
                "#archived": "archived",
                "#active": "active",
                "#lastCompletedDate": "lastCompletedDate",
                "#lastCompletedAt": "lastCompletedAt",
                "#currentStreak": "currentStreak",
                "#bestStreak": "bestStreak",
                "#updatedAt": "updatedAt"
            },
            ExpressionAttributeValues: {
                ":true": { BOOL: true },
                ":today": { S: today },
                ":now": { S: now },
                ":currentStreak": { N: String(plan.currentStreak) },
                ":bestStreak": { N: String(plan.taskBestStreak) }
            }
        }
    };
}

function profileUpdate(profileKey, profileItem, plan, now) {
    const values = {
        ":xp": { N: String(plan.xp) },
        ":coins": { N: String(plan.coins) },
        ":one": { N: "1" },
        ":worldPoints": { N: String(plan.worldPoints) },
        ":level": { N: String(plan.progression.level) },
        ":now": { S: now }
    };
    const conditions = ["attribute_exists(PK)"];
    for (const field of ["xp", "coins", "worldPoints", "tasksCompleted"]) {
        const name = `#${field}`;
        const expected = `:expected${field[0].toUpperCase()}${field.slice(1)}`;
        if (profileItem[field]?.N == null) {
            conditions.push(`attribute_not_exists(${name})`);
        } else {
            conditions.push(`${name} = ${expected}`);
            values[expected] = { N: profileItem[field].N };
        }
    }

    return {
        Update: {
            TableName: TABLE_NAME,
            Key: profileKey,
            UpdateExpression: "SET #level = :level, #updatedAt = :now, #lastTaskCompletedAt = :now ADD #xp :xp, #coins :coins, #tasksCompleted :one, #worldPoints :worldPoints",
            ConditionExpression: conditions.join(" AND "),
            ExpressionAttributeNames: {
                "#xp": "xp",
                "#coins": "coins",
                "#tasksCompleted": "tasksCompleted",
                "#worldPoints": "worldPoints",
                "#level": "level",
                "#updatedAt": "updatedAt",
                "#lastTaskCompletedAt": "lastTaskCompletedAt"
            },
            ExpressionAttributeValues: values
        }
    };
}

function statsUpdate(userPk, period, date, state, goal, xp, coins, now) {
    const daily = period === "DAY";
    const names = {
        "#entityType": "entityType",
        "#period": daily ? "date" : "weekId",
        "#updatedAt": "updatedAt",
        "#tasksCompleted": "tasksCompleted",
        "#xpEarned": "xpEarned",
        "#coinsEarned": "coinsEarned"
    };
    const values = {
        ":entityType": { S: daily ? "DAILY_STATS" : "WEEKLY_STATS" },
        ":period": { S: date },
        ":updatedAt": { S: now },
        ":one": { N: "1" },
        ":xp": { N: String(xp) },
        ":coins": { N: String(coins) }
    };
    const sets = [
        "#entityType = :entityType",
        "#period = :period",
        "#updatedAt = :updatedAt"
    ];
    const additions = ["#tasksCompleted :one", "#xpEarned :xp", "#coinsEarned :coins"];
    const conditions = [];

    if (state.hasTasksCompleted) {
        values[":expectedTasksCompleted"] = { N: String(state.tasksCompleted) };
        conditions.push("#tasksCompleted = :expectedTasksCompleted");
    } else {
        conditions.push("attribute_not_exists(#tasksCompleted)");
    }

    if (goal.awarded) {
        names["#goalRewarded"] = "goalRewarded";
        names["#goalRewardedAt"] = "goalRewardedAt";
        values[":false"] = { BOOL: false };
        values[":true"] = { BOOL: true };
        values[":goalRewardedAt"] = { S: now };
        sets.push("#goalRewarded = :true", "#goalRewardedAt = :goalRewardedAt");
        conditions.push("(attribute_not_exists(#goalRewarded) OR #goalRewarded = :false)");
    }

    return {
        Update: {
            TableName: TABLE_NAME,
            Key: {
                PK: { S: userPk },
                SK: { S: `STATS#${period}#${date}` }
            },
            UpdateExpression: `SET ${sets.join(", ")} ADD ${additions.join(", ")}`,
            ConditionExpression: conditions.join(" AND "),
            ExpressionAttributeNames: names,
            ExpressionAttributeValues: values
        }
    };
}

function completionHistoryPut(userPk, history) {
    return {
        Put: {
            TableName: TABLE_NAME,
            Item: {
                PK: { S: userPk },
                SK: { S: `COMPLETION_HISTORY#${history.completedAt}#${history.completionId}` },
                entityType: { S: "TASK_COMPLETION_HISTORY" },
                completionId: { S: history.completionId },
                taskId: { S: history.taskId },
                taskTitle: { S: history.taskTitle },
                taskDescription: history.taskDescription == null
                    ? { NULL: true }
                    : { S: history.taskDescription },
                repeatType: { S: history.repeatType },
                repeatDays: { L: history.repeatDays.map((day) => ({ S: day })) },
                completedAt: { S: history.completedAt },
                localDate: { S: history.localDate },
                timeZone: { S: history.timeZone },
                xpEarned: { N: String(history.xpEarned) },
                coinsEarned: { N: String(history.coinsEarned) },
                worldPointsEarned: { N: String(history.worldPointsEarned) },
                currentStreak: { N: String(history.currentStreak) },
                bestStreak: { N: String(history.bestStreak) }
            },
            ConditionExpression: "attribute_not_exists(PK) AND attribute_not_exists(SK)"
        }
    };
}

function completionResponse(task, profile, plan, timeZone, today, now, weekStart, weekEnd) {
    return {
        task: {
            taskId: task.taskId,
            title: task.title,
            description: task.description,
            repeatType: task.repeatType,
            repeatDays: task.repeatDays,
            active: task.active,
            completed: plan.recurring ? task.completed : true,
            completedAt: plan.recurring ? task.completedAt : now,
            completedToday: true,
            isScheduledToday: true,
            isDueToday: false,
            currentStreak: plan.recurring ? plan.currentStreak : 0,
            bestStreak: plan.recurring ? plan.taskBestStreak : task.bestStreak,
            lastCompletedDate: plan.recurring ? today : task.lastCompletedDate,
            lastCompletedAt: plan.recurring ? now : task.lastCompletedAt,
            xpReward: plan.rewardBreakdown.base.xp,
            coinReward: plan.rewardBreakdown.base.coins,
            createdAt: task.createdAt,
            updatedAt: now
        },
        rewards: {
            xp: plan.xp,
            coins: plan.coins,
            worldPoints: plan.worldPoints,
            ...plan.rewardBreakdown
        },
        goalRewards: {
            daily: {
                awarded: plan.daily.awarded,
                worldPoints: plan.daily.worldPoints,
                tasksCompleted: plan.daily.tasksCompleted,
                target: plan.daily.target,
                goalRewarded: plan.daily.goalRewarded,
                date: today
            },
            weekly: {
                awarded: plan.weekly.awarded,
                worldPoints: plan.weekly.worldPoints,
                tasksCompleted: plan.weekly.tasksCompleted,
                target: plan.weekly.target,
                goalRewarded: plan.weekly.goalRewarded,
                weekId: isoWeekId(today),
                startDate: weekStart,
                endDate: weekEnd
            }
        },
        streak: plan.responseStreak,
        progression: plan.progression,
        player: {
            ...plan.player,
            displayName: profile.displayName,
            timeZone
        },
        time: {
            timeZone,
            date: today,
            weekday: weekday(today),
            completedAt: now
        },
        newAchievements: plan.newAchievements.map(achievementResponse)
    };
}

async function complete(userPk, taskId) {
    const taskKey = { PK: { S: userPk }, SK: { S: `TASK#${taskId}` } };
    const profileKey = { PK: { S: userPk }, SK: { S: "PROFILE" } };

    for (let attempt = 0; attempt < 3; attempt++) {
        const [profileItem, taskItem] = await Promise.all([
            getItem(profileKey),
            getItem(taskKey)
        ]);

        if (!profileItem) {
            return { statusCode: 404, code: "PROFILE_NOT_FOUND", message: "Player profile not found." };
        }
        if (!taskItem) {
            return { statusCode: 404, code: "TASK_NOT_FOUND", message: "Task not found." };
        }

        const profile = profileFrom(profileItem);
        const task = taskFrom(taskItem, taskId);
        const timeZone = profile.timeZone;
        const clock = new Date();
        let today;

        try {
            today = localDate(clock, timeZone);
        } catch (error) {
            if (error instanceof RangeError) {
                throw new Error("PROFILE.timeZone is invalid", { cause: error });
            }
            throw error;
        }

        const now = clock.toISOString();
        const { start: weekStart, end: weekEnd } = weekBounds(today);
        const weekId = isoWeekId(today);
        const recurring = task.repeatType === "DAILY" || task.repeatType === "WEEKLY";
        const completionKey = recurring
            ? { PK: { S: userPk }, SK: { S: `COMPLETION#${taskId}#${today}` } }
            : null;
        const dailyStatsKey = {
            PK: { S: userPk },
            SK: { S: `STATS#DAY#${today}` }
        };
        const weeklyStatsKey = {
            PK: { S: userPk },
            SK: { S: `STATS#WEEK#${weekId}` }
        };
        const [
            dailyStatsItem,
            weeklyStatsItem,
            catalogItems,
            userAchievementItems,
            completionItem,
            buildingCatalogItems,
            playerBuildingItems
        ] = await Promise.all([
            getItem(dailyStatsKey),
            getItem(weeklyStatsKey),
            queryPrefix("CATALOG#ACHIEVEMENTS", "ACHIEVEMENT#"),
            queryPrefix(userPk, "ACHIEVEMENT#"),
            completionKey ? getItem(completionKey) : null,
            queryPrefix("CATALOG#BUILDINGS", "BUILDING#"),
            queryPrefix(userPk, "BUILDING#")
        ]);
        const dailyStats = statsFrom(dailyStatsItem);
        const weeklyStats = statsFrom(weeklyStatsItem);
        const earnedAchievementIds = earnedAchievementIdsFromItems(userAchievementItems);
        const { effects } = resolveBuildingEffects(
            buildingCatalogItems.map(buildingCatalogFromItem),
            playerBuildingsFromItems(playerBuildingItems)
        );
        const baseXp = Math.max(0, task.xpReward ?? DEFAULTS.xp);
        const baseCoins = Math.max(0, task.coinReward ?? DEFAULTS.coins);
        let plan;

        try {
            plan = planCompletion({
                task,
                profile,
                dailyStats,
                weeklyStats,
                completionExists: Boolean(completionItem),
                today,
                now,
                defaults: DEFAULTS,
                rewardBonuses: {
                    xp: percentageBonus(baseXp, effects.taskXpBonusPercent),
                    coins: percentageBonus(baseCoins, effects.taskCoinBonusPercent),
                    dailyWorldPoints: effects.dailyWorldPointsBonus,
                    weeklyWorldPoints: effects.weeklyWorldPointsBonus
                }
            });
        } catch (error) {
            if (error instanceof CompletionError) {
                return { statusCode: error.statusCode, code: error.code, message: error.message };
            }
            throw error;
        }

        plan.newAchievements = evaluateAchievementAwards({
            catalog: catalogItems.map(achievementCatalogFromItem),
            earnedAchievementIds,
            progress: plan.achievementProgress,
            allowedTypes: [
                "TASKS_COMPLETED",
                "LEVEL_REACHED",
                "COINS_OWNED",
                "WORLD_POINTS_OWNED",
                "STREAK_REACHED",
                "ACHIEVEMENTS_EARNED"
            ],
            now
        });

        const transaction = [];

        if (plan.createCompletionRecord) {
            transaction.push({
                Put: {
                    TableName: TABLE_NAME,
                    Item: {
                        ...completionKey,
                        entityType: { S: "TASK_COMPLETION" },
                        taskId: { S: taskId },
                        completionDate: { S: today },
                        completedAt: { S: now },
                        repeatType: { S: task.repeatType },
                        xpAwarded: { N: String(plan.xp) },
                        coinsAwarded: { N: String(plan.coins) }
                    },
                    ConditionExpression: "attribute_not_exists(PK) AND attribute_not_exists(SK)"
                }
            });
        }

        const history = buildCompletionHistory({
            completionId: randomUUID(),
            task,
            plan,
            now,
            today,
            timeZone
        });
        transaction.push(completionHistoryPut(userPk, history));

        transaction.push(
            taskUpdate(taskKey, plan, today, now),
            profileUpdate(profileKey, profileItem, plan, now),
            statsUpdate(userPk, "DAY", today, dailyStats, plan.daily, plan.xp, plan.coins, now),
            statsUpdate(userPk, "WEEK", weekId, weeklyStats, plan.weekly, plan.xp, plan.coins, now),
            ...plan.newAchievements.map((achievement) => achievementPut(TABLE_NAME, userPk, achievement))
        );

        try {
            await client.send(new TransactWriteItemsCommand({
                TransactItems: transaction,
                ClientRequestToken: randomUUID()
            }));

            return {
                statusCode: 200,
                body: completionResponse(task, profile, plan, timeZone, today, now, weekStart, weekEnd)
            };
        } catch (error) {
            if (error.name !== "TransactionCanceledException" && error.name !== "TransactionConflictException") {
                throw error;
            }

            if (completionKey && await getItem(completionKey)) {
                return { statusCode: 409, code: "TASK_ALREADY_COMPLETED", message: "Task has already been completed today." };
            }

            if (!completionKey && (await getItem(taskKey))?.completed?.BOOL === true) {
                return { statusCode: 409, code: "TASK_ALREADY_COMPLETED", message: "Task has already been completed." };
            }
        }
    }

    throw new Error("Completion transaction could not be committed after retries");
}

export const handler = async (event) => {
    const userId = authSubject(event);
    let taskId;

    if (!userId) {
        return unauthorized();
    }
    try {
        taskId = requiredString(event.pathParameters ?? {}, "taskId");
    } catch (error) {
        return handleApiError(error, "Complete task path validation failed");
    }

    if (event.body) {
        try {
            const body = parseJsonBody(event);
            if (!body || Array.isArray(body) || typeof body !== "object" || Object.keys(body).length) {
                return badRequest("VALIDATION_ERROR", "Completion fields are managed by the server.");
            }
        } catch (error) {
            return handleApiError(error, "Complete task JSON parsing failed");
        }
    }

    try {
        const result = await complete(`USER#${userId}`, taskId);
        return result.statusCode === 200
            ? response(200, result.body)
            : errorResponse(result.statusCode, result.code, result.message, result.details);
    } catch (error) {
        return internalServerError("Complete task failed", error);
    }
};
