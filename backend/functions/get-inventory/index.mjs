import { DynamoDBClient, GetItemCommand, QueryCommand } from "@aws-sdk/client-dynamodb";
import { buildInventory } from "./logic.mjs";
import {
    authSubject,
    handleApiError,
    internalServerError,
    jsonResponse as response,
    requireActivePlayer,
    unauthorized
} from "/opt/nodejs/http.mjs";

const client = new DynamoDBClient({});
const TABLE_NAME = process.env.TABLE_NAME;
const queryPrefix = (pk, prefix) => client.send(new QueryCommand({
    TableName: TABLE_NAME,
    KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
    ExpressionAttributeValues: { ":pk": { S: pk }, ":prefix": { S: prefix } }
}));

export const handler = async (event) => {
    const userId = authSubject(event);
    if (!userId) return unauthorized();
    try {
        await requireActivePlayer(event, client, TABLE_NAME, GetItemCommand);
    } catch (error) {
        return handleApiError(error, "Get inventory active player check failed");
    }

    try {
        const userPk = `USER#${userId}`;
        const [ownedResult, catalogResult, equipmentResult] = await Promise.all([
            queryPrefix(userPk, "ITEM#"),
            queryPrefix("CATALOG#COSMETICS", "ITEM#"),
            client.send(new GetItemCommand({
                TableName: TABLE_NAME,
                Key: { PK: { S: userPk }, SK: { S: "EQUIPMENT" } },
                ConsistentRead: true
            }))
        ]);

        const owned = (ownedResult.Items ?? []).map((item) => ({
            itemId: item.itemId?.S ?? item.SK?.S?.replace("ITEM#", ""),
            name: item.name?.S,
            category: item.category?.S,
            assetKey: item.assetKey?.S,
            purchasedAt: item.purchasedAt?.S,
            purchasePrice: Number(item.purchasePrice?.N ?? 0)
        })).filter((item) => item.itemId);
        const catalog = new Map((catalogResult.Items ?? []).map((item) => [item.itemId?.S, {
            name: item.name?.S,
            category: item.category?.S,
            assetKey: item.assetKey?.S
        }]).filter(([itemId]) => itemId));
        const storedEquipment = {};
        for (const slot of ["tunic", "pants", "boots", "hat", "hair", "pet", "aura", "background"]) {
            storedEquipment[slot] = equipmentResult.Item?.[slot]?.S ?? null;
        }

        return response(200, buildInventory(owned, catalog, storedEquipment));
    } catch (error) {
        return internalServerError("Get inventory failed", error);
    }
};
