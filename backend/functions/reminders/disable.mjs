import { DynamoDBClient, UpdateItemCommand } from "@aws-sdk/client-dynamodb";
import {
    disableReminderRequest,
    validReminderId
} from "./logic.mjs";
import {
    authSubject,
    badRequest,
    internalServerError,
    noContent,
    notFound,
    unauthorized
} from "/opt/nodejs/http.mjs";

const client = new DynamoDBClient({});
const TABLE_NAME = process.env.TABLE_NAME;
export const handler = async (event) => {
    const userId = authSubject(event);
    const reminderId = event.pathParameters?.reminderId;
    if (!userId) return unauthorized();
    if (!validReminderId(reminderId)) return badRequest("VALIDATION_ERROR", "reminderId is invalid.");

    try {
        await client.send(new UpdateItemCommand(disableReminderRequest(
            TABLE_NAME,
            userId,
            reminderId,
            new Date().toISOString()
        )));
        return noContent();
    } catch (error) {
        if (error.name === "ConditionalCheckFailedException") {
            return notFound("REMINDER_NOT_FOUND", "Reminder not found.");
        }
        return internalServerError("Disable reminder failed", error);
    }
};
