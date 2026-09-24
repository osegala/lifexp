import { DynamoDBClient, QueryCommand } from "@aws-sdk/client-dynamodb";
import {
    encodeCursor,
    historyItem,
    historyQuery,
    HistoryQueryError
} from "./logic.mjs";
import { authSubject, badRequest, internalServerError, jsonResponse as response, unauthorized } from "/opt/nodejs/http.mjs";

const client = new DynamoDBClient({});
const TABLE_NAME = process.env.TABLE_NAME;

export const handler = async (event) => {
    const userId = authSubject(event);
    if (!userId) {
        return unauthorized();
    }

    try {
        const result = await client.send(new QueryCommand(historyQuery(
            TABLE_NAME,
            `USER#${userId}`,
            event.queryStringParameters ?? {}
        )));
        return response(200, {
            items: (result.Items ?? []).map(historyItem),
            nextCursor: encodeCursor(result.LastEvaluatedKey?.SK?.S)
        });
    } catch (error) {
        if (error instanceof HistoryQueryError) {
            return badRequest("VALIDATION_ERROR", error.message);
        }
        return internalServerError("Get completion history failed", error);
    }
};
