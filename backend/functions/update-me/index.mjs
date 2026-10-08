import { DynamoDBClient, GetItemCommand, UpdateItemCommand, QueryCommand, TransactWriteItemsCommand } from "@aws-sdk/client-dynamodb";
import { notificationWakeups } from "/opt/nodejs/notification-wakeup.mjs";
import { ProfilePatchError, validateProfilePatch } from "./logic.mjs";
import {
    APPEARANCE_VALUES,
    normalizeAppearance
} from "/opt/nodejs/appearance.mjs";
import {
    authSubject,
    badRequest,
    conflict,
    handleApiError,
    internalServerError,
    jsonResponse as response,
    notFound,
    parseJsonBody,
    requireActivePlayer,
    unauthorized
} from "/opt/nodejs/http.mjs";

const client = new DynamoDBClient({});
const TABLE_NAME = process.env.TABLE_NAME;
export const handler = async (event) => {
    const userId = authSubject(event);
    if (!userId) return unauthorized();
    try {
        await requireActivePlayer(event, client, TABLE_NAME, GetItemCommand);
    } catch (error) {
        return handleApiError(error, "Update profile active player check failed");
    }

    let body;
    try { body = parseJsonBody(event); }
    catch (error) { return handleApiError(error, "Update profile JSON parsing failed"); }

    let patch;
    try { patch = validateProfilePatch(body, APPEARANCE_VALUES); }
    catch (error) {
        if (error instanceof ProfilePatchError) return badRequest(error.code, error.message);
        throw error;
    }

    try {
        const names = { "#updatedAt": "updatedAt" };
        const values = { ":updatedAt": { S: new Date().toISOString() } };
        const assignments = ["#updatedAt = :updatedAt"];
        for (const [field, value] of Object.entries(patch)) {
            names[`#${field}`] = field;
            values[`:${field}`] = typeof value === "boolean" ? { BOOL: value } : { S: value };
            assignments.push(`#${field} = :${field}`);
        }
        const request = {
            TableName: TABLE_NAME,
            Key: { PK: { S: `USER#${userId}` }, SK: { S: "PROFILE" } },
            UpdateExpression: `SET ${assignments.join(", ")}`,
            ConditionExpression: "attribute_exists(PK) AND attribute_exists(SK)",
            ExpressionAttributeNames: names,
            ExpressionAttributeValues: values,
            ReturnValues: "ALL_NEW"
        };
        let result;
        if ("timeZone" in patch) {
            const wakeups = await notificationWakeups(client, QueryCommand, TABLE_NAME, `USER#${userId}`, values[":updatedAt"].S);
            const preferences = (await client.send(new GetItemCommand({ TableName: TABLE_NAME, Key: { PK: request.Key.PK, SK: { S: "PREFERENCES" } }, ConsistentRead: true }))).Item;
            if (preferences?.GSI1PK) wakeups.push({ Update: { TableName: TABLE_NAME, Key: { PK: preferences.PK, SK: preferences.SK },
                UpdateExpression: "SET GSI1SK = :sort", ConditionExpression: "#updated = :updated",
                ExpressionAttributeNames: { "#updated": "updatedAt" }, ExpressionAttributeValues: { ":updated": preferences.updatedAt, ":sort": { S: `${values[":updatedAt"].S}#PREFERENCES` } } } });
            const { ReturnValues: _returnValues, ...update } = request;
            await client.send(new TransactWriteItemsCommand({ TransactItems: [{ Update: update }, ...wakeups] }));
            result = { Attributes: (await client.send(new GetItemCommand({ TableName: TABLE_NAME, Key: request.Key, ConsistentRead: true }))).Item };
        } else result = await client.send(new UpdateItemCommand(request));

        const appearance = normalizeAppearance(result.Attributes);
        return response(200, {
            message: "Profile updated",
            displayName: result.Attributes?.displayName?.S ?? "Adventurer",
            timeZone: result.Attributes?.timeZone?.S ?? "UTC",
            ...appearance,
            onboardingCompleted: result.Attributes?.onboardingCompleted?.BOOL ?? true,
            updatedAt: result.Attributes?.updatedAt?.S ?? values[":updatedAt"].S
        });
    } catch (error) {
        if (error.name === "TransactionCanceledException") return conflict("PROFILE_CHANGED", "Profile or reminders changed. Reload and try again.");
        if (error.name === "ConditionalCheckFailedException") {
            return notFound("PROFILE_NOT_FOUND", "Player profile not found.");
        }
        return internalServerError("Update profile failed", error);
    }
};
