import {
    DynamoDBClient,
    GetItemCommand
} from "@aws-sdk/client-dynamodb";
import {
    effectiveEntitlement,
    entitlementFromItem
} from "./logic.mjs";
import { authSubject, internalServerError, jsonResponse as response, unauthorized } from "/opt/nodejs/http.mjs";

const client = new DynamoDBClient({});
const TABLE_NAME = process.env.TABLE_NAME;

export const handler = async (event) => {
    const userId = authSubject(event);
    if (!userId) {
        return unauthorized();
    }

    try {
        const result = await client.send(new GetItemCommand({
            TableName: TABLE_NAME,
            Key: {
                PK: { S: `USER#${userId}` },
                SK: { S: "ENTITLEMENTS" }
            },
            ConsistentRead: true
        }));

        return response(200, effectiveEntitlement(entitlementFromItem(result.Item)));
    } catch (error) {
        return internalServerError("Get entitlements failed", error);
    }
};
