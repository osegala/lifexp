import {
    DynamoDBClient,
    GetItemCommand
} from "@aws-sdk/client-dynamodb";
import { readEntitlement } from "/opt/nodejs/entitlements.mjs";
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
    if (!userId) {
        return unauthorized();
    }
    try {
        await requireActivePlayer(event, client, TABLE_NAME, GetItemCommand);
    } catch (error) {
        return handleApiError(error, "Get entitlements active player check failed");
    }

    try {
        return response(200, await readEntitlement(client, TABLE_NAME, userId, GetItemCommand));
    } catch (error) {
        return internalServerError("Get entitlements failed", error);
    }
};
