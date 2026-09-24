import { DynamoDBClient, GetItemCommand } from "@aws-sdk/client-dynamodb";
import { preferencesFromItem } from "/opt/nodejs/preferences.mjs";
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
export const handler = async (event) => {
    const userId = authSubject(event);
    if (!userId) return unauthorized();
    try {
        await requireActivePlayer(event, client, TABLE_NAME, GetItemCommand);
    } catch (error) {
        return handleApiError(error, "Get preferences active player check failed");
    }

    try {
        const result = await client.send(new GetItemCommand({
            TableName: TABLE_NAME,
            Key: { PK: { S: `USER#${userId}` }, SK: { S: "PREFERENCES" } },
            ConsistentRead: true
        }));
        return response(200, preferencesFromItem(result.Item));
    } catch (error) {
        return internalServerError("Get preferences failed", error);
    }
};
