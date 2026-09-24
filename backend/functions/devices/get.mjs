import { DynamoDBClient, QueryCommand } from "@aws-sdk/client-dynamodb";
import { deviceResponse } from "./logic.mjs";
import { authSubject, internalServerError, jsonResponse as response, unauthorized } from "/opt/nodejs/http.mjs";

const client = new DynamoDBClient({});
const TABLE_NAME = process.env.TABLE_NAME;
async function getDevices(userId) {
    const items = [];
    let ExclusiveStartKey;
    do {
        const result = await client.send(new QueryCommand({
            TableName: TABLE_NAME,
            KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
            ExpressionAttributeValues: {
                ":pk": { S: `USER#${userId}` },
                ":prefix": { S: "DEVICE#" }
            },
            ExclusiveStartKey
        }));
        items.push(...(result.Items ?? []));
        ExclusiveStartKey = result.LastEvaluatedKey;
    } while (ExclusiveStartKey);
    return items;
}

export const handler = async (event) => {
    const userId = authSubject(event);
    if (!userId) return unauthorized();

    try {
        const devices = (await getDevices(userId)).map(deviceResponse)
            .sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""));
        return response(200, { devices });
    } catch (error) {
        return internalServerError("Get devices failed", error);
    }
};
