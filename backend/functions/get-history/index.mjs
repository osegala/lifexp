import {
    DynamoDBClient,
    GetItemCommand,
    QueryCommand
} from "@aws-sdk/client-dynamodb";
import {
    localDate,
    shiftDate,
    summarize
} from "./logic.mjs";
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

function dayFrom(item) {
    return {
        date: item.date?.S ?? item.SK.S.slice("STATS#DAY#".length),
        tasksCompleted: Number(item.tasksCompleted?.N ?? 0),
        xpEarned: Number(item.xpEarned?.N ?? 0),
        coinsEarned: Number(item.coinsEarned?.N ?? 0),
        goalRewarded: item.goalRewarded?.BOOL ?? false,
        goalRewardedAt: item.goalRewardedAt?.S ?? null
    };
}

export const handler = async (event) => {
    const userId = authSubject(event);
    if (!userId) {
        return unauthorized();
    }
    let profile;
    try {
        ({ profile } = await requireActivePlayer(event, client, TABLE_NAME, GetItemCommand));
    } catch (error) {
        return handleApiError(error, "Get history active player check failed");
    }

    try {
        const userPk = `USER#${userId}`;
        const timeZone = profile.timeZone?.S ?? "America/New_York";
        const today = localDate(new Date(), timeZone);
        const start = shiftDate(today, -29);
        const result = await client.send(new QueryCommand({
            TableName: TABLE_NAME,
            KeyConditionExpression: "PK = :pk AND SK BETWEEN :start AND :end",
            ExpressionAttributeValues: {
                ":pk": { S: userPk },
                ":start": { S: `STATS#DAY#${start}` },
                ":end": { S: `STATS#DAY#${today}` }
            },
            ConsistentRead: true
        }));
        const days = (result.Items ?? [])
            .map(dayFrom)
            .sort((left, right) => right.date.localeCompare(left.date));

        return response(200, {
            timeZone,
            range: { start, end: today, days: 30 },
            summary: summarize(days, today),
            days
        });
    } catch (error) {
        return internalServerError("Get history failed", error);
    }
};
