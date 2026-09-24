import { DynamoDBClient, GetItemCommand, UpdateItemCommand } from "@aws-sdk/client-dynamodb";
import { ProfilePatchError, validateProfilePatch } from "./logic.mjs";
import {
    authSubject,
    badRequest,
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
    try { patch = validateProfilePatch(body); }
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
            values[`:${field}`] = { S: value };
            assignments.push(`#${field} = :${field}`);
        }
        const result = await client.send(new UpdateItemCommand({
            TableName: TABLE_NAME,
            Key: { PK: { S: `USER#${userId}` }, SK: { S: "PROFILE" } },
            UpdateExpression: `SET ${assignments.join(", ")}`,
            ConditionExpression: "attribute_exists(PK) AND attribute_exists(SK)",
            ExpressionAttributeNames: names,
            ExpressionAttributeValues: values,
            ReturnValues: "ALL_NEW"
        }));

        return response(200, {
            message: "Profile updated",
            displayName: result.Attributes?.displayName?.S ?? "Adventurer",
            timeZone: result.Attributes?.timeZone?.S ?? "UTC",
            updatedAt: result.Attributes?.updatedAt?.S ?? values[":updatedAt"].S
        });
    } catch (error) {
        if (error.name === "ConditionalCheckFailedException") {
            return notFound("PROFILE_NOT_FOUND", "Player profile not found.");
        }
        return internalServerError("Update profile failed", error);
    }
};
