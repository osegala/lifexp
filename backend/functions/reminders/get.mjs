import { DynamoDBClient, GetItemCommand, QueryCommand } from "@aws-sdk/client-dynamodb";
import { reminderListResponse } from "./logic.mjs";
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
const getItem = async (key) => (await client.send(new GetItemCommand({
    TableName: TABLE_NAME,
    Key: key,
    ConsistentRead: true
}))).Item;
async function queryPrefix(pk, prefix) {
    const items = [];
    let ExclusiveStartKey;
    do {
        const result = await client.send(new QueryCommand({
            TableName: TABLE_NAME,
            KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
            ExpressionAttributeValues: { ":pk": { S: pk }, ":prefix": { S: prefix } },
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
    let profile;
    try {
        ({ profile } = await requireActivePlayer(event, client, TABLE_NAME, GetItemCommand));
    } catch (error) {
        return handleApiError(error, "Get reminders active player check failed");
    }

    try {
        const userPk = `USER#${userId}`;
        const [preferenceItem, reminders, devices] = await Promise.all([
            getItem({ PK: { S: userPk }, SK: { S: "PREFERENCES" } }),
            queryPrefix(userPk, "REMINDER#"),
            queryPrefix(userPk, "DEVICE#")
        ]);
        const taskReminders = reminders.filter((reminder) => reminder.type?.S === "TASK");
        const taskIds = [...new Set(taskReminders
            .map((reminder) => reminder.taskId?.S)
            .filter(Boolean))];
        const tasks = (await Promise.all(taskIds.map((taskId) => getItem({
            PK: { S: userPk },
            SK: { S: `TASK#${taskId}` }
        })))).filter(Boolean);

        return response(200, reminderListResponse(taskReminders, profile, preferenceItem, devices, tasks));
    } catch (error) {
        return internalServerError("Get reminders failed", error);
    }
};
