import { DynamoDBClient, GetItemCommand, UpdateItemCommand } from "@aws-sdk/client-dynamodb";
import { equipmentSlot } from "./logic.mjs";
import {
    authSubject,
    badRequest,
    conflict,
    handleApiError,
    internalServerError,
    jsonResponse as response,
    notFound,
    parseJsonBody,
    requiredString,
    unauthorized,
    validateBodyFields
} from "/opt/nodejs/http.mjs";

const client = new DynamoDBClient({});
const TABLE_NAME = process.env.TABLE_NAME;
const SLOTS = ["tunic", "pants", "boots", "hat", "hair", "pet", "aura", "background"];
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
        return handleApiError(error, "Unequip item validation failed");
    }

    try {
        const userPk = `USER#${userId}`;
        const catalogItem = (await client.send(new GetItemCommand({
            TableName: TABLE_NAME,
            Key: { PK: { S: "CATALOG#COSMETICS" }, SK: { S: `ITEM#${itemId}` } },
            ConsistentRead: true
        }))).Item;
        if (!catalogItem) return notFound("ITEM_NOT_FOUND", "Cosmetic catalog item not found.");
        const category = catalogItem.category?.S ?? "unknown";
        const slot = equipmentSlot(category);
        if (!slot) return badRequest("VALIDATION_ERROR", "This cosmetic cannot be unequipped.");

        const result = await client.send(new UpdateItemCommand({
            TableName: TABLE_NAME,
            Key: { PK: { S: userPk }, SK: { S: "EQUIPMENT" } },
            UpdateExpression: "SET #updatedAt = :now REMOVE #slot",
            ConditionExpression: "attribute_exists(PK) AND #slot = :itemId",
            ExpressionAttributeNames: { "#updatedAt": "updatedAt", "#slot": slot },
            ExpressionAttributeValues: { ":now": { S: new Date().toISOString() }, ":itemId": { S: itemId } },
            ReturnValues: "ALL_NEW"
        }));
        return response(200, {
            unequipped: true,
            item: { itemId, name: catalogItem.name?.S ?? itemId, category, slot },
            equipment: readEquipment(result.Attributes)
        });
    } catch (error) {
        if (error.name === "ConditionalCheckFailedException") {
            return conflict("ITEM_NOT_EQUIPPED", "This item is not currently equipped.");
        }
        return internalServerError("Unequip item failed", error);
    }
};
