import { randomUUID } from "node:crypto";
import { DynamoDBClient, GetItemCommand, PutItemCommand } from "@aws-sdk/client-dynamodb";
import { notificationSchedule } from "/opt/nodejs/scheduling.mjs";
import {
    ReminderError,
    assertTaskCanReceiveReminder,
    reminderIdFor,
    reminderItem,
    reminderPutRequest,
    reminderResponse,
    validateReminderCreate
} from "./logic.mjs";
import {
    authSubject,
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
    if (!userId) return unauthorized();
    let profile;
    try {
        ({ profile } = await requireActivePlayer(event, client, TABLE_NAME, GetItemCommand));
    } catch (error) {
        return handleApiError(error, "Create reminder active player check failed");
    }

    let body;
    try { body = parseJsonBody(event); }
    catch (error) { return handleApiError(error, "Create reminder JSON parsing failed"); }

    let reminderId;
    let timeZone;
    let values;
    try {
        values = validateReminderCreate(body);
        reminderId = values.clientRequestId
            ? reminderIdFor(userId, values.clientRequestId)
            : randomUUID();
        const userPk = `USER#${userId}`;
        const [task, priorReminder] = await Promise.all([
            values.taskId
                ? getItem({ PK: { S: userPk }, SK: { S: `TASK#${values.taskId}` } })
                : Promise.resolve(null),
            values.clientRequestId
                ? getItem({ PK: { S: userPk }, SK: { S: `REMINDER#${reminderId}` } })
                : Promise.resolve(null)
        ]);
        timeZone = profile.timeZone?.S ?? "UTC";
        if (priorReminder?.clientRequestId?.S === values.clientRequestId) {
            return response(200, {
                timeZone,
                reminder: reminderResponse(priorReminder),
                idempotent: true
            });
        }
        assertTaskCanReceiveReminder(task);

        const now = new Date();
        const schedule = notificationSchedule({
            enabled: values.enabled,
            timeZone,
            localTime: values.localTime,
            daysOfWeek: values.daysOfWeek,
            identifier: `${userId}#${reminderId}`
        }, now);
        const item = reminderItem(userId, reminderId, values, schedule, now.toISOString());
        await client.send(new PutItemCommand(reminderPutRequest(TABLE_NAME, item)));
        return response(201, {
            timeZone,
            reminder: reminderResponse(item),
            idempotent: false
        });
    } catch (error) {
        if (error instanceof ReminderError) return errorResponse(error.statusCode, error.code, error.message);
        if (error.name === "ConditionalCheckFailedException" && values?.clientRequestId && reminderId) {
            try {
                const existing = await getItem({
                    PK: { S: `USER#${userId}` },
                    SK: { S: `REMINDER#${reminderId}` }
                });
                if (existing?.clientRequestId?.S === values.clientRequestId) {
                    return response(200, {
                        timeZone,
                        reminder: reminderResponse(existing),
                        idempotent: true
                    });
                }
            } catch (readError) {
                return internalServerError("Read idempotent reminder failed", readError);
            }
        }
        if (error.name === "ConditionalCheckFailedException") {
            return conflict("REMINDER_ALREADY_EXISTS", "Reminder already exists.");
        }
        return internalServerError("Create reminder failed", error);
    }
};
