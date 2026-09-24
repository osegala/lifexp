import { DynamoDBClient, GetItemCommand, UpdateItemCommand } from "@aws-sdk/client-dynamodb";
import { notificationSchedule } from "/opt/nodejs/scheduling.mjs";
import {
    PreferenceError,
    preferenceUpdateRequest,
    preferencesFromItem,
    validatePreferencePatch
} from "/opt/nodejs/preferences.mjs";
import {
    authSubject,
    badRequest,
    handleApiError,
    internalServerError,
    jsonResponse as response,
    notFound,
    parseJsonBody,
    unauthorized
} from "/opt/nodejs/http.mjs";

const client = new DynamoDBClient({});
const TABLE_NAME = process.env.TABLE_NAME;
export const handler = async (event) => {
    const userId = authSubject(event);
    if (!userId) return unauthorized();

    let body;
    try { body = parseJsonBody(event); }
    catch (error) { return handleApiError(error, "Update preferences JSON parsing failed"); }

    try {
        const userPk = `USER#${userId}`;
        const getItem = (SK) => client.send(new GetItemCommand({
            TableName: TABLE_NAME,
            Key: { PK: { S: userPk }, SK: { S: SK } },
            ConsistentRead: true
        }));
        const [existing, profileResult] = await Promise.all([
            getItem("PREFERENCES"),
            getItem("PROFILE")
        ]);
        if (!profileResult.Item) return notFound("PROFILE_NOT_FOUND", "Player profile not found.");

        const { patch, resolved } = validatePreferencePatch(body, preferencesFromItem(existing.Item));
        const now = new Date();
        const schedule = notificationSchedule({
            enabled: resolved.notificationsEnabled && resolved.dailyReminderEnabled,
            timeZone: profileResult.Item.timeZone?.S ?? "UTC",
            localTime: resolved.dailyReminderTime,
            daysOfWeek: [],
            identifier: `${userId}#DAILY`
        }, now);
        const result = await client.send(new UpdateItemCommand(preferenceUpdateRequest(
            TABLE_NAME,
            userId,
            patch,
            schedule,
            now.toISOString()
        )));
        return response(200, preferencesFromItem(result.Attributes));
    } catch (error) {
        if (error instanceof PreferenceError) {
            const code = error.message.startsWith("dailyReminderTime")
                ? "INVALID_REMINDER_TIME"
                : "VALIDATION_ERROR";
            return badRequest(code, `${error.message}.`);
        }
        return internalServerError("Update preferences failed", error);
    }
};
