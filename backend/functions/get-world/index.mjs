import {
    DynamoDBClient,
    GetItemCommand,
    QueryCommand
} from "@aws-sdk/client-dynamodb";
import { buildWorld } from "./logic.mjs";
import {
    buildingCatalogFromItem,
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
    let profile;
    try {
        ({ profile } = await requireActivePlayer(event, client, TABLE_NAME, GetItemCommand));
    } catch (error) {
        return handleApiError(error, "Get world active player check failed");
    }

    try {
        const userPk = `USER#${userId}`;
        const [catalogItems, buildingItems] = await Promise.all([
            queryPrefix("CATALOG#BUILDINGS", "BUILDING#"),
            queryPrefix(userPk, "BUILDING#")
        ]);

        const catalog = catalogItems.map(buildingCatalogFromItem);
        const playerBuildings = playerBuildingsFromItems(buildingItems);
        const resolved = resolveBuildingEffects(catalog, playerBuildings);
        const worldPoints = Number(profile.worldPoints?.N ?? 0);

        return response(200, {
            worldPoints,
            effects: resolved.effects,
            buildings: buildWorld(catalog, playerBuildings, worldPoints, resolved.activeEffectsByBuilding)
        });
    } catch (error) {
        return internalServerError("Get world failed", error);
    }
};
