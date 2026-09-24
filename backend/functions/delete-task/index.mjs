import {
    DynamoDBClient,
    GetItemCommand,
    UpdateItemCommand
} from "@aws-sdk/client-dynamodb";
import { archiveTaskRequest } from "./logic.mjs";
import {
    authSubject,
    handleApiError,
    internalServerError,
    noContent,
    notFound,
    requireActivePlayer,
    requiredString,
    unauthorized
} from "/opt/nodejs/http.mjs";

const client = new DynamoDBClient({});
const TABLE_NAME = process.env.TABLE_NAME;

export const handler = async (event) => {
    const userId = authSubject(event);
    let taskId;

    if (!userId) {
        return unauthorized();
    }
    try {
        await requireActivePlayer(event, client, TABLE_NAME, GetItemCommand);
    } catch (error) {
        return handleApiError(error, "Archive task active player check failed");
    }
    try {
        taskId = requiredString(event.pathParameters ?? {}, "taskId");
    } catch (error) {
        return handleApiError(error, "Archive task path validation failed");
    }

    try {
        await client.send(new UpdateItemCommand(archiveTaskRequest(
            TABLE_NAME,
            {
                PK: { S: `USER#${userId}` },
                SK: { S: `TASK#${taskId}` }
            },
            new Date().toISOString()
        )));

        return noContent();
    } catch (error) {
        if (error.name === "ConditionalCheckFailedException") {
            return notFound("TASK_NOT_FOUND", "Task not found.");
        }
        return internalServerError("Archive task failed", error);
    }
};
