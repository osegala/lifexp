import {
    DynamoDBClient,
    GetItemCommand,
    QueryCommand
} from "@aws-sdk/client-dynamodb";
import {
    achievementSummary,
    buildAchievements,
    levelInfo
} from "./logic.mjs";
import {
    achievementCatalogFromItem,
    achievementProgress
} from "/opt/nodejs/achievements.mjs";
import {
    buildingCatalogFromItem,
    playerBuildingsFromItems,
    resolveBuildingEffects
} from "/opt/nodejs/building-effects.mjs";
import { authSubject, internalServerError, jsonResponse as response, notFound, unauthorized } from "/opt/nodejs/http.mjs";

const client = new DynamoDBClient({});
const TABLE_NAME = process.env.TABLE_NAME;

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

export const handler = async (event) => {
    const userId = authSubject(event);
    if (!userId) {
        return unauthorized();
    }

    try {
        const userPk = `USER#${userId}`;
        const [
            profileResult,
            catalogItems,
            earnedItems,
            taskItems,
            buildingCatalogItems,
            playerBuildingItems,
            ownedItems
        ] = await Promise.all([
            client.send(new GetItemCommand({
                TableName: TABLE_NAME,
                Key: { PK: { S: userPk }, SK: { S: "PROFILE" } },
                ConsistentRead: true
            })),
            queryPrefix("CATALOG#ACHIEVEMENTS", "ACHIEVEMENT#"),
            queryPrefix(userPk, "ACHIEVEMENT#"),
            queryPrefix(userPk, "TASK#"),
            queryPrefix("CATALOG#BUILDINGS", "BUILDING#"),
            queryPrefix(userPk, "BUILDING#"),
            queryPrefix(userPk, "ITEM#")
        ]);
        const profile = profileResult.Item;

        if (!profile) {
            return notFound("PROFILE_NOT_FOUND", "Player profile not found.");
        }

        const totalXp = Number(profile.xp?.N ?? 0);
        const levels = levelInfo(totalXp);
        const buildingState = resolveBuildingEffects(
            buildingCatalogItems.map(buildingCatalogFromItem),
            playerBuildingsFromItems(playerBuildingItems)
        );
        const player = {
            level: levels.level,
            totalXp,
            xpIntoLevel: levels.xpIntoLevel,
            xpForNextLevel: levels.xpForNextLevel,
            xpToNextLevel: levels.xpToNextLevel,
            coins: Number(profile.coins?.N ?? 0),
            worldPoints: Number(profile.worldPoints?.N ?? 0),
            tasksCompleted: Number(profile.tasksCompleted?.N ?? 0),
            bestStreak: Math.max(0, ...taskItems.map((task) => Number(task.bestStreak?.N ?? 0)))
        };
        const progress = {
            ...player,
            streak: player.bestStreak,
            buildingLevels: buildingState.levels,
            totalBuildingLevels: [...buildingState.levels.values()].reduce((sum, level) => sum + level, 0),
            cosmeticsOwned: ownedItems.length,
            achievementsEarned: earnedItems.length
        };
        const earnedById = new Map(earnedItems.map((item) => [
            item.achievementId?.S ?? item.SK.S.slice("ACHIEVEMENT#".length),
            {
                earnedAt: item.earnedAt?.S ?? null,
                progressValue: item.progressValue?.N === undefined
                    ? null
                    : Number(item.progressValue.N)
            }
        ]));
        const catalog = catalogItems.map(achievementCatalogFromItem).map((achievement) => {
            const currentValue = achievementProgress(achievement, progress);
            return {
                ...achievement,
                currentValue: currentValue ?? 0,
                supported: currentValue !== null
            };
        });
        const achievements = buildAchievements(catalog, earnedById);

        return response(200, {
            summary: achievementSummary(achievements),
            player,
            achievements
        });
    } catch (error) {
        return internalServerError("Get achievements failed", error);
    }
};
