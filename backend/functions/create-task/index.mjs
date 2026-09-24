import { randomUUID } from "node:crypto";
import {
    DynamoDBClient,
    PutItemCommand
} from "@aws-sdk/client-dynamodb";
import {
    authSubject,
    handleApiError,
    internalServerError,
    jsonResponse as response,
    parseJsonBody,
    unauthorized
} from "/opt/nodejs/http.mjs";
import { validateTaskCreate } from "/opt/nodejs/task-input.mjs";

const client = new DynamoDBClient({});
const TABLE_NAME = process.env.TABLE_NAME;
export const handler = async (event) => {
    const userId = authSubject(event);
    if (!userId) {
        return unauthorized();
    }

    let input;
    try {
        input = validateTaskCreate(parseJsonBody(event));
    } catch (error) {
        return handleApiError(error, "Create task validation failed");
    }

    const taskId = randomUUID();
    const now = new Date().toISOString();
    const { repeatType, repeatDays } = input;
    const userPk = `USER#${userId}`;
    const item = {
        PK: { S: userPk },
        SK: { S: `TASK#${taskId}` },
        entityType: { S: "TASK" },
        taskId: { S: taskId },
        title: { S: input.title },
        repeatType: { S: repeatType },
        repeatDays: { L: repeatDays.map((day) => ({ S: day })) },
        active: { BOOL: input.active },
        completed: { BOOL: false },
        currentStreak: { N: "0" },
        bestStreak: { N: "0" },
        xpReward: { N: "10" },
        coinReward: { N: "1" },
        createdAt: { S: now },
        updatedAt: { S: now }
    };

    if (input.description != null) {
        item.description = { S: input.description };
    }

    try {
        await client.send(new PutItemCommand({
            TableName: TABLE_NAME,
            Item: item,
            ConditionExpression: "attribute_not_exists(PK) AND attribute_not_exists(SK)"
        }));

        return response(201, {
            taskId,
            title: item.title.S,
            description: item.description?.S ?? null,
            repeatType,
            repeatDays,
            active: item.active.BOOL,
            completed: false,
            currentStreak: 0,
            bestStreak: 0,
            xpReward: 10,
            coinReward: 1,
            createdAt: now,
            updatedAt: now
        });
    } catch (error) {
        return internalServerError("Create task failed", error);
    }
};
