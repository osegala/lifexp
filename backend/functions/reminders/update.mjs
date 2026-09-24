import { DynamoDBClient, GetItemCommand, UpdateItemCommand } from "@aws-sdk/client-dynamodb";
import { notificationSchedule } from "/opt/nodejs/scheduling.mjs";
import {
    ReminderError,
    assertTaskCanReceiveReminder,
    reminderResponse,
    reminderUpdateRequest,
    reminderValuesFromItem,
    validReminderId,
    validateReminderPatch
} from "./logic.mjs";
import {
    authSubject,
    badRequest,
    conflict,
    errorResponse,
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
const getItem = async (key) => (await client.send(new GetItemCommand({
    TableName: TABLE_NAME,
    Key: key,
    ConsistentRead: true
}))).Item;

export const handler = async (event) => {
    const userId = authSubject(event);
    const reminderId = event.pathParameters?.reminderId;
    if (!userId) return unauthorized();
    let profile;
    try {
        ({ profile } = await requireActivePlayer(event, client, TABLE_NAME, GetItemCommand));
    } catch (error) {
        return handleApiError(error, "Update reminder active player check failed");
    }
    if (!validReminderId(reminderId)) return badRequest("VALIDATION_ERROR", "reminderId is invalid.");

    let body;
    try { body = parseJsonBody(event); }
    catch (error) { return handleApiError(error, "Update reminder JSON parsing failed"); }

    try {
        const patch = validateReminderPatch(body);
        const userPk = `USER#${userId}`;
        const existing = await getItem({ PK: { S: userPk }, SK: { S: `REMINDER#${reminderId}` } });
        if (!existing) return notFound("REMINDER_NOT_FOUND", "Reminder not found.");

        const values = { ...reminderValuesFromItem(existing), ...patch };
        if (values.type !== "TASK") {
            return conflict("INVALID_REMINDER_TYPE", "Only TASK reminder records are supported.");
        }
        const task = await getItem({ PK: { S: userPk }, SK: { S: `TASK#${values.taskId}` } });
        assertTaskCanReceiveReminder(task);
        const timeZone = profile.timeZone?.S ?? "UTC";
        const now = new Date();
        const schedule = notificationSchedule({
            enabled: values.enabled,
            timeZone,
            localTime: values.localTime,
            daysOfWeek: values.daysOfWeek,
            identifier: `${userId}#${reminderId}`
        }, now);

        const result = await client.send(new UpdateItemCommand(reminderUpdateRequest(
            TABLE_NAME,
            userId,
            reminderId,
            patch,
            schedule,
            now.toISOString()
        )));
        return response(200, {
            timeZone,
            reminder: reminderResponse(result.Attributes)
        });
    } catch (error) {
        if (error instanceof ReminderError) return errorResponse(error.statusCode, error.code, error.message);
        if (error.name === "ConditionalCheckFailedException") {
            return notFound("REMINDER_NOT_FOUND", "Reminder not found.");
        }
        return internalServerError("Update reminder failed", error);
    }
};
