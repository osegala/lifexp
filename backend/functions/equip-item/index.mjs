import { DynamoDBClient, GetItemCommand, UpdateItemCommand } from "@aws-sdk/client-dynamodb";
import { EquipError, planEquip } from "./logic.mjs";
import {
    authSubject,
    errorResponse,
    handleApiError,
    internalServerError,
    jsonResponse as response,
    parseJsonBody,
    requiredString,
    unauthorized,
    validateBodyFields
} from "/opt/nodejs/http.mjs";

const client = new DynamoDBClient({});
const TABLE_NAME = process.env.TABLE_NAME;
const SLOTS = ["tunic", "pants", "boots", "hat", "hair", "pet", "aura", "background"];
const getItem = async (key) => (await client.send(new GetItemCommand({ TableName: TABLE_NAME, Key: key, ConsistentRead: true }))).Item;
const readEquipment = (item) => Object.fromEntries(SLOTS.map((slot) => [slot, item?.[slot]?.S ?? null]));

export const handler = async (event) => {
    const userId = authSubject(event);
    if (!userId) return unauthorized();
    let body;
    let itemId;
    try {
        body = validateBodyFields(parseJsonBody(event), ["itemId"]);
        itemId = requiredString(body, "itemId");
    } catch (error) {
        return handleApiError(error, "Equip item validation failed");
    }

    try {
        const userPk = `USER#${userId}`;
        const [owned, catalogItem] = await Promise.all([
            getItem({ PK: { S: userPk }, SK: { S: `ITEM#${itemId}` } }),
            getItem({ PK: { S: "CATALOG#COSMETICS" }, SK: { S: `ITEM#${itemId}` } })
        ]);
        const catalog = catalogItem ? {
            itemId: catalogItem.itemId?.S ?? itemId,
            name: catalogItem.name?.S ?? itemId,
            category: catalogItem.category?.S ?? "unknown",
            active: catalogItem.active?.BOOL !== false
        } : null;
        let plan;
        try { plan = planEquip(Boolean(owned), catalog); }
        catch (error) {
            if (error instanceof EquipError) return errorResponse(error.statusCode, error.code, error.message);
            throw error;
        }
        const now = new Date().toISOString();
        const result = await client.send(new UpdateItemCommand({
            TableName: TABLE_NAME,
            Key: { PK: { S: userPk }, SK: { S: "EQUIPMENT" } },
            UpdateExpression: "SET #slot = :itemId, #updatedAt = :now",
            ExpressionAttributeNames: { "#slot": plan.slot, "#updatedAt": "updatedAt" },
            ExpressionAttributeValues: { ":itemId": { S: itemId }, ":now": { S: now } },
            ReturnValues: "ALL_NEW"
        }));
        return response(200, {
            equipped: true,
            item: { itemId, name: catalog.name, category: catalog.category, slot: plan.slot },
            equipment: readEquipment(result.Attributes)
        });
    } catch (error) {
        return internalServerError("Equip item failed", error);
    }
};
