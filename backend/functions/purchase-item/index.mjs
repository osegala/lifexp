import {
    DynamoDBClient,
    GetItemCommand,
    QueryCommand,
    TransactWriteItemsCommand
} from "@aws-sdk/client-dynamodb";
import { planPurchase, PurchaseError } from "./logic.mjs";
import {
    achievementCatalogFromItem,
    achievementPut,
    achievementResponse,
    earnedAchievementIdsFromItems,
    evaluateAchievementAwards
} from "/opt/nodejs/achievements.mjs";
import {
    buildingCatalogFromItem,
    cosmeticOffer,
    playerBuildingsFromItems,
    resolveBuildingEffects
} from "/opt/nodejs/building-effects.mjs";
import {
    authSubject,
    conflict,
    errorResponse,
    handleApiError,
    internalServerError,
    jsonResponse as response,
    parseJsonBody,
    requireActivePlayer,
    requiredString,
    unauthorized,
    validateBodyFields
} from "/opt/nodejs/http.mjs";

const client = new DynamoDBClient({});
const TABLE_NAME = process.env.TABLE_NAME;
async function getItem(key) {
    return (await client.send(new GetItemCommand({
        TableName: TABLE_NAME,
        Key: key,
        ConsistentRead: true
    }))).Item;
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

function readCatalog(item, itemId) {
    if (!item) return null;
    return {
        itemId: item.itemId?.S ?? itemId,
        name: item.name?.S ?? itemId,
        category: item.category?.S ?? "unknown",
        assetKey: item.assetKey?.S ?? null,
        price: Number(item.price?.N ?? 0),
        requiredLevel: Number(item.requiredLevel?.N ?? 1),
        requiredAchievement: item.requiredAchievement?.S ?? null,
        active: item.active?.BOOL !== false
    };
}

export const handler = async (event) => {
    const userId = authSubject(event);
    if (!userId) return unauthorized();
    let activeProfile;
    try {
        ({ profile: activeProfile } = await requireActivePlayer(event, client, TABLE_NAME, GetItemCommand));
    } catch (error) {
        return handleApiError(error, "Purchase item active player check failed");
    }

    let body;
    let itemId;
    try {
        body = validateBodyFields(parseJsonBody(event), ["itemId"]);
        itemId = requiredString(body, "itemId");
    } catch (error) {
        return handleApiError(error, "Purchase item validation failed");
    }

    try {
        const userPk = `USER#${userId}`;
        const profileKey = { PK: { S: userPk }, SK: { S: "PROFILE" } };
        const catalog = readCatalog(await getItem({
            PK: { S: "CATALOG#COSMETICS" },
            SK: { S: `ITEM#${itemId}` }
        }), itemId);
        const [
            ownedItems,
            buildingCatalogItems,
            playerBuildingItems,
            achievementCatalogItems,
            earnedAchievementItems
        ] = await Promise.all([
            queryPrefix(userPk, "ITEM#"),
            queryPrefix("CATALOG#BUILDINGS", "BUILDING#"),
            queryPrefix(userPk, "BUILDING#"),
            queryPrefix("CATALOG#ACHIEVEMENTS", "ACHIEVEMENT#"),
            queryPrefix(userPk, "ACHIEVEMENT#")
        ]);
        const ownedItem = ownedItems.find((item) =>
            (item.itemId?.S ?? item.SK?.S?.slice("ITEM#".length)) === itemId
        );
        const earnedAchievementIds = earnedAchievementIdsFromItems(earnedAchievementItems);
        const { effects } = resolveBuildingEffects(
            buildingCatalogItems.map(buildingCatalogFromItem),
            playerBuildingsFromItems(playerBuildingItems)
        );
        const offer = catalog ? cosmeticOffer(catalog, effects) : null;

        let plan;
        try {
            plan = planPurchase(
                catalog,
                { xp: Number(activeProfile.xp?.N ?? 0), coins: Number(activeProfile.coins?.N ?? 0) },
                {
                    owned: Boolean(ownedItem),
                    hasRequiredAchievement: !catalog?.requiredAchievement || earnedAchievementIds.has(catalog.requiredAchievement),
                    offer
                }
            );
        } catch (error) {
            if (error instanceof PurchaseError) {
                return errorResponse(error.statusCode, error.code, error.message, error.details);
            }
            throw error;
        }

        const now = new Date().toISOString();
        const newAchievements = evaluateAchievementAwards({
            catalog: achievementCatalogItems.map(achievementCatalogFromItem),
            earnedAchievementIds,
            progress: {
                coins: plan.remainingCoins,
                cosmeticsOwned: ownedItems.length + 1
            },
            allowedTypes: ["COINS_OWNED", "COSMETICS_OWNED", "ACHIEVEMENTS_EARNED"],
            now
        });
        const ownership = {
            PK: { S: userPk },
            SK: { S: `ITEM#${itemId}` },
            itemId: { S: itemId },
            name: { S: catalog.name },
            category: { S: catalog.category },
            purchasedAt: { S: now },
            purchasePrice: { N: String(plan.price) }
        };
        if (catalog.assetKey) ownership.assetKey = { S: catalog.assetKey };

        await client.send(new TransactWriteItemsCommand({ TransactItems: [
            {
                Update: {
                    TableName: TABLE_NAME,
                    Key: profileKey,
                    UpdateExpression: "ADD #coins :negativePrice SET #updatedAt = :now",
                    ConditionExpression: "attribute_exists(PK) AND attribute_exists(SK) AND #coins = :expectedCoins AND #coins >= :price",
                    ExpressionAttributeNames: { "#coins": "coins", "#updatedAt": "updatedAt" },
                    ExpressionAttributeValues: {
                        ":negativePrice": { N: String(-plan.price) },
                        ":price": { N: String(plan.price) },
                        ":expectedCoins": activeProfile.coins ?? { N: "0" },
                        ":now": { S: now }
                    }
                }
            },
            {
                Put: {
                    TableName: TABLE_NAME,
                    Item: ownership,
                    ConditionExpression: "attribute_not_exists(PK) AND attribute_not_exists(SK)"
                }
            },
            ...newAchievements.map((achievement) => achievementPut(TABLE_NAME, userPk, achievement))
        ] }));

        return response(200, {
            purchased: true,
            item: {
                itemId,
                name: catalog.name,
                category: catalog.category,
                price: plan.price,
                catalogPrice: plan.catalogPrice,
                effectivePrice: plan.effectivePrice,
                discountPercent: plan.discountPercent
            },
            player: { coins: plan.remainingCoins },
            newAchievements: newAchievements.map(achievementResponse)
        });
    } catch (error) {
        if (error.name === "TransactionCanceledException") {
            return conflict("PURCHASE_CONFLICT", "Purchase conflicted with another update. Please try again.");
        }
        return internalServerError("Purchase item failed", error);
    }
};
