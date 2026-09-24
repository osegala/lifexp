import { DynamoDBClient, GetItemCommand, QueryCommand } from "@aws-sdk/client-dynamodb";
import { buildShopItems } from "./logic.mjs";
import {
    achievementCatalogFromItem,
    achievementProgress,
    dailyGoalCompletionCount
} from "/opt/nodejs/achievements.mjs";
import {
    buildingCatalogFromItem,
    cosmeticOffer,
    playerBuildingsFromItems,
    resolveBuildingEffects
} from "/opt/nodejs/building-effects.mjs";
import {
    authSubject,
    handleApiError,
    internalServerError,
    jsonResponse as response,
    notFound,
    requireActivePlayer,
    unauthorized
} from "/opt/nodejs/http.mjs";
import { levelFromXp } from "/opt/nodejs/leveling.mjs";

const client = new DynamoDBClient({});
const TABLE_NAME = process.env.TABLE_NAME;

const queryPrefix = (pk, prefix) => client.send(new QueryCommand({
    TableName: TABLE_NAME,
    KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
    ExpressionAttributeValues: { ":pk": { S: pk }, ":prefix": { S: prefix } }
}));

function catalogItem(item) {
    return {
        itemId: item.itemId?.S,
        name: item.name?.S,
        category: item.category?.S,
        price: Number(item.price?.N ?? 0),
        requiredLevel: Number(item.requiredLevel?.N ?? 1),
        requiredAchievement: item.requiredAchievement?.S ?? null,
        assetKey: item.assetKey?.S ?? null,
        active: item.active?.BOOL !== false,
        sortOrder: Number(item.sortOrder?.N ?? 0)
    };
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
        return handleApiError(error, "Get shop active player check failed");
    }

    try {
        const userPk = `USER#${userId}`;
        const [
            catalogResult,
            ownedResult,
            achievementsResult,
            buildingCatalogResult,
            playerBuildingsResult,
            achievementCatalogResult,
            dailyStatsResult
        ] = await Promise.all([
            queryPrefix("CATALOG#COSMETICS", "ITEM#"),
            queryPrefix(userPk, "ITEM#"),
            queryPrefix(userPk, "ACHIEVEMENT#"),
            queryPrefix("CATALOG#BUILDINGS", "BUILDING#"),
            queryPrefix(userPk, "BUILDING#"),
            queryPrefix("CATALOG#ACHIEVEMENTS", "ACHIEVEMENT#"),
            queryPrefix(userPk, "STATS#DAY#")
        ]);

        const xp = Number(profile.xp?.N ?? 0);
        const coins = Number(profile.coins?.N ?? 0);
        const level = levelFromXp(xp);
        const ownedIds = new Set((ownedResult.Items ?? []).map((item) => item.itemId?.S).filter(Boolean));
        const achievementIds = new Set((achievementsResult.Items ?? [])
            .map((item) => item.achievementId?.S ?? item.SK?.S?.replace("ACHIEVEMENT#", ""))
            .filter(Boolean));
        const catalog = (catalogResult.Items ?? []).map(catalogItem).filter((item) => item.itemId);
        const { effects } = resolveBuildingEffects(
            (buildingCatalogResult.Items ?? []).map(buildingCatalogFromItem),
            playerBuildingsFromItems(playerBuildingsResult.Items)
        );
        const offers = catalog.map((item) => ({ ...item, ...cosmeticOffer(item, effects) }));
        const progress = {
            tasksCompleted: Number(profile.tasksCompleted?.N ?? 0),
            level,
            coins,
            dailyGoalsCompleted: dailyGoalCompletionCount(dailyStatsResult.Items)
        };
        const requirements = new Map((achievementCatalogResult.Items ?? [])
            .map(achievementCatalogFromItem)
            .filter((achievement) => achievement.active)
            .map((achievement) => [achievement.achievementId, {
                achievementId: achievement.achievementId,
                name: achievement.name,
                description: achievement.description,
                type: achievement.type,
                requiredValue: achievement.requiredValue,
                currentValue: achievementProgress(achievement, progress) ?? 0
            }]));

        return response(200, {
            player: { level, coins },
            items: buildShopItems(offers, ownedIds, achievementIds, coins, level, requirements)
        });
    } catch (error) {
        return internalServerError("Get shop failed", error);
    }
};
