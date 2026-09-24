import { createHash } from "node:crypto";

const LOCAL_TIME = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const TASK_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const REMINDER_ID = /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|req-[0-9a-f]{32})$/i;
const CLIENT_REQUEST_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/;
const WEEKDAYS = new Set(["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]);
const CREATE_FIELDS = new Set(["type", "taskId", "enabled", "localTime", "daysOfWeek", "clientRequestId"]);
const PATCH_FIELDS = new Set(["enabled", "localTime", "daysOfWeek"]);

export class ReminderError extends Error {
    constructor(code, message, statusCode = 400) {
        super(message);
        this.code = code;
        this.statusCode = statusCode;
    }
}

export function validReminderId(value) {
    return typeof value === "string" && REMINDER_ID.test(value);
}

export function reminderIdFor(userId, clientRequestId) {
    return `req-${createHash("sha256").update(`${userId}\0${clientRequestId}`).digest("hex").slice(0, 32)}`;
}

function normalizeDays(value) {
    if (value === undefined) return [];
    if (!Array.isArray(value)) throw new ReminderError("VALIDATION_ERROR", "daysOfWeek must be an array.");
    const days = [...new Set(value.map((day) => typeof day === "string" ? day.toUpperCase() : ""))];
    if (days.some((day) => !WEEKDAYS.has(day))) {
        throw new ReminderError("VALIDATION_ERROR", "daysOfWeek may only contain MON, TUE, WED, THU, FRI, SAT, or SUN.");
    }
    return days;
}

function validateObject(body, allowed) {
    if (!body || typeof body !== "object" || Array.isArray(body)) {
        throw new ReminderError("VALIDATION_ERROR", "Request body must be a JSON object.");
    }
    const invalid = Object.keys(body).filter((field) => !allowed.has(field));
    if (invalid.length) throw new ReminderError("VALIDATION_ERROR", `Fields cannot be edited: ${invalid.join(", ")}.`);
}

export function validateReminderCreate(body) {
    validateObject(body, CREATE_FIELDS);
    const type = typeof body.type === "string" ? body.type.toUpperCase() : "";
    if (type === "DAILY") {
        throw new ReminderError("INVALID_REMINDER_TYPE", "The global daily reminder is managed through PATCH /preferences.");
    }
    if (type !== "TASK") {
        throw new ReminderError("INVALID_REMINDER_TYPE", "type must be TASK.");
    }
    if (typeof body.localTime !== "string" || !LOCAL_TIME.test(body.localTime)) {
        throw new ReminderError("INVALID_REMINDER_TIME", "localTime must be a local time in HH:MM format.");
    }
    if (Object.hasOwn(body, "enabled") && typeof body.enabled !== "boolean") {
        throw new ReminderError("VALIDATION_ERROR", "enabled must be a boolean.");
    }

    const taskId = typeof body.taskId === "string" ? body.taskId.trim() : null;
    if (type === "TASK" && !TASK_ID.test(taskId ?? "")) {
        throw new ReminderError("VALIDATION_ERROR", "taskId is required for TASK reminders.");
    }
    const clientRequestId = body.clientRequestId == null ? null : String(body.clientRequestId).trim();
    if (clientRequestId !== null && !CLIENT_REQUEST_ID.test(clientRequestId)) {
        throw new ReminderError("VALIDATION_ERROR", "clientRequestId must be 8 to 128 letters, numbers, dots, underscores, colons, or hyphens.");
    }

    return {
        type,
        taskId,
        enabled: body.enabled ?? true,
        localTime: body.localTime,
        daysOfWeek: normalizeDays(body.daysOfWeek),
        clientRequestId
    };
}

export function validateReminderPatch(body) {
    validateObject(body, PATCH_FIELDS);
    if (!Object.keys(body).length) throw new ReminderError("VALIDATION_ERROR", "At least one editable field is required.");

    const patch = {};
    if (Object.hasOwn(body, "enabled")) {
        if (typeof body.enabled !== "boolean") throw new ReminderError("VALIDATION_ERROR", "enabled must be a boolean.");
        patch.enabled = body.enabled;
    }
    if (Object.hasOwn(body, "localTime")) {
        if (typeof body.localTime !== "string" || !LOCAL_TIME.test(body.localTime)) {
            throw new ReminderError("INVALID_REMINDER_TIME", "localTime must be a local time in HH:MM format.");
        }
        patch.localTime = body.localTime;
    }
    if (Object.hasOwn(body, "daysOfWeek")) patch.daysOfWeek = normalizeDays(body.daysOfWeek);
    return patch;
}

export function assertTaskCanReceiveReminder(task) {
    if (!task) throw new ReminderError("TASK_NOT_FOUND", "Task not found.", 404);
    if (task.archived?.BOOL === true) throw new ReminderError("TASK_ARCHIVED", "Archived tasks cannot receive reminders.", 409);
    if (task.active?.BOOL !== true) throw new ReminderError("TASK_INACTIVE", "Inactive tasks cannot receive reminders.", 409);
}

function storedDays(item) {
    return item.daysOfWeek?.L?.map((value) => value.S).filter(Boolean)
        ?? item.daysOfWeek?.SS
        ?? [];
}

export function reminderResponse(item, effectiveNotificationsEnabled) {
    const reminder = {
        reminderId: item.reminderId?.S ?? item.SK?.S?.slice("REMINDER#".length) ?? "",
        type: item.type?.S ?? null,
        taskId: item.taskId?.S ?? null,
        enabled: item.enabled?.BOOL === true,
        localTime: item.localTime?.S ?? null,
        daysOfWeek: storedDays(item),
        nextDueAt: item.nextDueAt?.S ?? null,
        createdAt: item.createdAt?.S ?? null,
        updatedAt: item.updatedAt?.S ?? null
    };
    if (typeof effectiveNotificationsEnabled === "boolean") {
        reminder.effectiveNotificationsEnabled = effectiveNotificationsEnabled;
    }
    return reminder;
}

export function effectiveReminderState(reminder, preferences, hasEnabledDevice, task) {
    if (!preferences.notificationsEnabled || !hasEnabledDevice || reminder.enabled?.BOOL !== true) return false;
    if (reminder.type?.S !== "TASK" || !preferences.taskRemindersEnabled) return false;
    return Boolean(task) && task.active?.BOOL === true && task.archived?.BOOL !== true;
}

export function reminderListResponse(reminders, profile, preferenceItem, devices, tasks) {
    const preferences = {
        notificationsEnabled: preferenceItem?.notificationsEnabled?.BOOL ?? true,
        taskRemindersEnabled: preferenceItem?.taskRemindersEnabled?.BOOL ?? true
    };
    const hasEnabledDevice = devices.some((device) => device.enabled?.BOOL === true);
    const tasksById = new Map(tasks.map((task) => [
        task.taskId?.S ?? task.SK?.S?.slice("TASK#".length),
        task
    ]));

    return {
        timeZone: profile.timeZone?.S ?? "UTC",
        reminders: reminders.map((reminder) => reminderResponse(
            reminder,
            effectiveReminderState(
                reminder,
                preferences,
                hasEnabledDevice,
                tasksById.get(reminder.taskId?.S)
            )
        ))
    };
}

export function reminderValuesFromItem(item) {
    return {
        type: item.type?.S,
        taskId: item.taskId?.S,
        enabled: item.enabled?.BOOL === true,
        localTime: item.localTime?.S,
        daysOfWeek: storedDays(item),
        clientRequestId: item.clientRequestId?.S ?? null
    };
}

export function reminderItem(userId, reminderId, values, schedule, now) {
    const item = {
        PK: { S: `USER#${userId}` },
        SK: { S: `REMINDER#${reminderId}` },
        entityType: { S: "REMINDER" },
        reminderId: { S: reminderId },
        type: { S: values.type },
        enabled: { BOOL: values.enabled },
        localTime: { S: values.localTime },
        daysOfWeek: { L: values.daysOfWeek.map((day) => ({ S: day })) },
        createdAt: { S: now },
        updatedAt: { S: now }
    };
    item.taskId = { S: values.taskId };
    if (values.clientRequestId) item.clientRequestId = { S: values.clientRequestId };
    if (schedule) {
        item.nextDueAt = { S: schedule.nextDueAt };
        item.GSI1PK = { S: schedule.GSI1PK };
        item.GSI1SK = { S: schedule.GSI1SK };
    }
    return item;
}

export function reminderPutRequest(tableName, item) {
    return {
        TableName: tableName,
        Item: item,
        ConditionExpression: "attribute_not_exists(PK) AND attribute_not_exists(SK)"
    };
}

export function reminderUpdateRequest(tableName, userId, reminderId, patch, schedule, now) {
    const names = { "#updatedAt": "updatedAt" };
    const values = { ":updatedAt": { S: now } };
    const set = ["#updatedAt = :updatedAt"];
    const remove = [];
    for (const [field, value] of Object.entries(patch)) {
        names[`#${field}`] = field;
        values[`:${field}`] = Array.isArray(value)
            ? { L: value.map((day) => ({ S: day })) }
            : typeof value === "boolean" ? { BOOL: value } : { S: value };
        set.push(`#${field} = :${field}`);
    }
    for (const field of ["nextDueAt", "GSI1PK", "GSI1SK"]) {
        names[`#${field}`] = field;
        if (schedule) {
            values[`:${field}`] = { S: schedule[field] };
            set.push(`#${field} = :${field}`);
        } else {
            remove.push(`#${field}`);
        }
    }
    return {
        TableName: tableName,
        Key: { PK: { S: `USER#${userId}` }, SK: { S: `REMINDER#${reminderId}` } },
        UpdateExpression: [`SET ${set.join(", ")}`, remove.length ? `REMOVE ${remove.join(", ")}` : ""]
            .filter(Boolean).join(" "),
        ConditionExpression: "attribute_exists(PK) AND attribute_exists(SK)",
        ExpressionAttributeNames: names,
        ExpressionAttributeValues: values,
        ReturnValues: "ALL_NEW"
    };
}

export function disableReminderRequest(tableName, userId, reminderId, now) {
    return reminderUpdateRequest(tableName, userId, reminderId, { enabled: false }, null, now);
}
