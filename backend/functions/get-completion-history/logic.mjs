const PREFIX = "COMPLETION_HISTORY#";

export class HistoryQueryError extends Error {}

export function encodeCursor(sortKey) {
    return sortKey
        ? Buffer.from(JSON.stringify({ sk: sortKey })).toString("base64url")
        : null;
}

export function decodeCursor(cursor) {
    if (!cursor) return null;
    try {
        const { sk } = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
        if (typeof sk !== "string" || !sk.startsWith(PREFIX)) throw new Error();
        return sk;
    } catch {
        throw new HistoryQueryError("Invalid cursor");
    }
}

export function historyQuery(tableName, userPk, query = {}) {
    const limit = query.limit == null ? 50 : Number(query.limit);
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
        throw new HistoryQueryError("limit must be an integer between 1 and 100");
    }
    if (query.before && query.cursor) {
        throw new HistoryQueryError("before and cursor cannot be used together");
    }

    const values = {
        ":pk": { S: userPk },
        ":prefix": { S: PREFIX }
    };
    const input = {
        TableName: tableName,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
        ExpressionAttributeValues: values,
        ScanIndexForward: false,
        ConsistentRead: true,
        Limit: limit
    };

    if (query.before) {
        const date = new Date(query.before);
        if (Number.isNaN(date.valueOf())) {
            throw new HistoryQueryError("before must be a valid timestamp");
        }
        values[":before"] = { S: `${PREFIX}${date.toISOString()}` };
        input.KeyConditionExpression = "PK = :pk AND SK BETWEEN :prefix AND :before";
    }

    const cursorSortKey = decodeCursor(query.cursor);
    if (cursorSortKey) {
        input.ExclusiveStartKey = {
            PK: { S: userPk },
            SK: { S: cursorSortKey }
        };
    }

    if (query.taskId != null) {
        const taskId = String(query.taskId).trim();
        if (!taskId || taskId.length > 128) throw new HistoryQueryError("taskId must be between 1 and 128 characters");
        input.FilterExpression = "#taskId = :taskId";
        input.ExpressionAttributeNames = { "#taskId": "taskId" };
        values[":taskId"] = { S: taskId };
    }

    return input;
}

export function historyItem(item) {
    return {
        completionId: item.completionId?.S ?? "",
        taskId: item.taskId?.S ?? "",
        taskTitle: item.taskTitle?.S ?? "",
        taskDescription: item.taskDescription?.NULL ? null : item.taskDescription?.S ?? null,
        repeatType: item.repeatType?.S ?? "NONE",
        repeatDays: (item.repeatDays?.L ?? []).map((day) => day.S).filter(Boolean),
        completedAt: item.completedAt?.S ?? null,
        localDate: item.localDate?.S ?? null,
        timeZone: item.timeZone?.S ?? "UTC",
        xpEarned: Number(item.xpEarned?.N ?? 0),
        coinsEarned: Number(item.coinsEarned?.N ?? 0),
        worldPointsEarned: Number(item.worldPointsEarned?.N ?? 0),
        currentStreak: Number(item.currentStreak?.N ?? 0),
        bestStreak: Number(item.bestStreak?.N ?? 0)
    };
}
