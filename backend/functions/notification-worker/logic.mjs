export const MAX_DELIVERY_LATENESS_MS = 5 * 60 * 1000;

function list(item, field) {
    return item?.[field]?.L?.map((value) => value.S).filter(Boolean)
        ?? item?.[field]?.SS
        ?? [];
}

export function notificationType(config) {
    if (config?.SK?.S === "PREFERENCES") return "DAILY";
    return config?.type?.S === "TASK" ? "TASK" : null;
}

export function schedulingConfig(config, profile, preferences) {
    const type = notificationType(config);
    if (!profile || !type) return null;
    if (type === "DAILY") {
        return {
            enabled: preferences.notificationsEnabled && preferences.dailyReminderEnabled,
            timeZone: profile.timeZone?.S ?? "UTC",
            localTime: preferences.dailyReminderTime,
            daysOfWeek: [],
            identifier: `${config.PK.S.slice("USER#".length)}#DAILY`
        };
    }
    return {
        enabled: config.enabled?.BOOL === true,
        timeZone: profile.timeZone?.S ?? "UTC",
        localTime: config.localTime?.S,
        daysOfWeek: list(config, "daysOfWeek"),
        identifier: `${config.PK.S.slice("USER#".length)}#${config.reminderId?.S}`
    };
}

export function evaluateDelivery({ config, preferences, task, devices, occurrenceValid, now }) {
    const type = notificationType(config);
    if (!type) return { deliver: false, reason: "INVALID_CONFIGURATION", devices: [] };
    if (!occurrenceValid) return { deliver: false, reason: "STALE_SCHEDULE", devices: [] };

    const dueAt = Date.parse(config.nextDueAt?.S ?? "");
    if (!Number.isFinite(dueAt) || now.getTime() - dueAt > MAX_DELIVERY_LATENESS_MS) {
        return { deliver: false, reason: "MISSED_DELIVERY_WINDOW", devices: [] };
    }

    if (!preferences.notificationsEnabled) {
        return { deliver: false, reason: "NOTIFICATIONS_DISABLED", devices: [] };
    }
    if (type === "DAILY" && !preferences.dailyReminderEnabled) {
        return { deliver: false, reason: "DAILY_REMINDER_DISABLED", devices: [] };
    }
    if (type === "TASK") {
        if (!preferences.taskRemindersEnabled) {
            return { deliver: false, reason: "TASK_REMINDERS_DISABLED", devices: [] };
        }
        if (!task) return { deliver: false, reason: "TASK_MISSING", devices: [] };
        if (task.archived?.BOOL === true) return { deliver: false, reason: "TASK_ARCHIVED", devices: [] };
        if (task.active?.BOOL !== true) return { deliver: false, reason: "TASK_INACTIVE", devices: [] };
    }

    const enabledDevices = devices.filter((device) => device.enabled?.BOOL === true && device.pushToken?.S);
    if (!enabledDevices.length) {
        return { deliver: false, reason: "NO_ENABLED_DEVICES", devices: [] };
    }
    return { deliver: true, reason: null, devices: enabledDevices };
}

export function dueQueryRequest(tableName, now, limit) {
    return {
        TableName: tableName,
        IndexName: "NotificationDueIndex",
        KeyConditionExpression: "#duePartition = :duePartition AND #dueSort <= :boundary",
        ExpressionAttributeNames: {
            "#duePartition": "GSI1PK",
            "#dueSort": "GSI1SK"
        },
        ExpressionAttributeValues: {
            ":duePartition": { S: "NOTIFICATION_DUE" },
            ":boundary": { S: `${now.toISOString()}#\uffff` }
        },
        Limit: limit,
        ScanIndexForward: true
    };
}

export function claimRequest(tableName, indexItem, claimedAt) {
    const dueKey = indexItem.GSI1SK.S;
    return {
        TableName: tableName,
        Key: { PK: indexItem.PK, SK: indexItem.SK },
        UpdateExpression: "SET #deliveryClaimKey = :dueKey, #deliveryClaimedAt = :claimedAt",
        ConditionExpression: "#dueSort = :dueKey AND (attribute_not_exists(#deliveryClaimKey) OR #deliveryClaimKey <> :dueKey)",
        ExpressionAttributeNames: {
            "#dueSort": "GSI1SK",
            "#deliveryClaimKey": "deliveryClaimKey",
            "#deliveryClaimedAt": "deliveryClaimedAt"
        },
        ExpressionAttributeValues: {
            ":dueKey": { S: dueKey },
            ":claimedAt": { S: claimedAt }
        },
        ReturnValues: "ALL_NEW"
    };
}

export function advanceRequest(tableName, config, dueKey, schedule, attemptedAt) {
    const names = {
        "#dueSort": "GSI1SK",
        "#deliveryClaimKey": "deliveryClaimKey",
        "#deliveryClaimedAt": "deliveryClaimedAt",
        "#lastDeliveryKey": "lastDeliveryKey",
        "#lastAttemptedAt": "lastAttemptedAt",
        "#nextDueAt": "nextDueAt",
        "#duePartition": "GSI1PK"
    };
    const values = {
        ":dueKey": { S: dueKey },
        ":attemptedAt": { S: attemptedAt }
    };
    const set = ["#lastDeliveryKey = :dueKey", "#lastAttemptedAt = :attemptedAt"];
    const remove = ["#deliveryClaimKey", "#deliveryClaimedAt"];
    if (schedule) {
        values[":nextDueAt"] = { S: schedule.nextDueAt };
        values[":duePartition"] = { S: schedule.GSI1PK };
        values[":nextDueSort"] = { S: schedule.GSI1SK };
        set.push("#nextDueAt = :nextDueAt", "#duePartition = :duePartition", "#dueSort = :nextDueSort");
    } else {
        remove.push("#nextDueAt", "#duePartition", "#dueSort");
    }
    return {
        TableName: tableName,
        Key: { PK: config.PK, SK: config.SK },
        UpdateExpression: `SET ${set.join(", ")} REMOVE ${remove.join(", ")}`,
        ConditionExpression: "#dueSort = :dueKey AND #deliveryClaimKey = :dueKey",
        ExpressionAttributeNames: names,
        ExpressionAttributeValues: values
    };
}

export function releaseClaimRequest(tableName, config, dueKey) {
    return {
        TableName: tableName,
        Key: { PK: config.PK, SK: config.SK },
        UpdateExpression: "REMOVE #deliveryClaimKey, #deliveryClaimedAt",
        ConditionExpression: "#deliveryClaimKey = :dueKey",
        ExpressionAttributeNames: {
            "#deliveryClaimKey": "deliveryClaimKey",
            "#deliveryClaimedAt": "deliveryClaimedAt"
        },
        ExpressionAttributeValues: { ":dueKey": { S: dueKey } }
    };
}

export function deliveryRecord({
    userPk,
    deliveryId,
    attemptedAt,
    localDate,
    type,
    config,
    device,
    status,
    errorCode
}) {
    const item = {
        PK: { S: userPk },
        SK: { S: `NOTIFICATION_DELIVERY#${attemptedAt}#${deliveryId}` },
        entityType: { S: "NOTIFICATION_DELIVERY" },
        deliveryId: { S: deliveryId },
        notificationType: { S: type },
        provider: { S: device?.pushProvider?.S ?? "EXPO" },
        status: { S: status },
        attemptedAt: { S: attemptedAt }
    };
    if (localDate) item.localDate = { S: localDate };
    if (config.reminderId?.S) item.reminderId = config.reminderId;
    if (config.taskId?.S) item.taskId = config.taskId;
    if (device?.deviceId?.S) item.deviceId = device.deviceId;
    if (errorCode) item.errorCode = { S: errorCode };
    return item;
}
