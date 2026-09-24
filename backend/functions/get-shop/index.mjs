import { DynamoDBClient, GetItemCommand, QueryCommand } from "@aws-sdk/client-dynamodb";
import { buildShopItems, levelFromXp } from "./logic.mjs";
import {
    buildingCatalogFromItem,
    cosmeticOffer,
    playerBuildingsFromItems,
    resolveBuildingEffects
} from "/opt/nodejs/building-effects.mjs";
import { authSubject, internalServerError, jsonResponse as response, notFound, unauthorized } from "/opt/nodejs/http.mjs";

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

    try {
        const userPk = `USER#${userId}`;
        const [
            profileResult,
            catalogResult,
            ownedResult,
            achievementsResult,
            buildingCatalogResult,
            playerBuildingsResult
        ] = await Promise.all([
            client.send(new GetItemCommand({
                TableName: TABLE_NAME,
                Key: { PK: { S: userPk }, SK: { S: "PROFILE" } },
                ConsistentRead: true
            })),
            queryPrefix("CATALOG#COSMETICS", "ITEM#"),
            queryPrefix(userPk, "ITEM#"),
            queryPrefix(userPk, "ACHIEVEMENT#"),
            queryPrefix("CATALOG#BUILDINGS", "BUILDING#"),
            queryPrefix(userPk, "BUILDING#")
        ]);

        if (!profileResult.Item) {
            return notFound("PROFILE_NOT_FOUND", "Player profile not found.");
        }

        const xp = Number(profileResult.Item.xp?.N ?? 0);
        const coins = Number(profileResult.Item.coins?.N ?? 0);
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

        return response(200, {
            player: { level, coins },
            items: buildShopItems(offers, ownedIds, achievementIds, coins, level)
        });
    } catch (error) {
        return internalServerError("Get shop failed", error);
    }
};
