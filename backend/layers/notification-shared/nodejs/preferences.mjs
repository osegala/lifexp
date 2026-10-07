export const DEFAULT_PREFERENCES = Object.freeze({
    notificationsEnabled: true,
    dailyReminderEnabled: false,
    dailyReminderTime: null,
    dailyQuestReminderEnabled: false,
    dailyQuestReminderTime: "18:00",
    streakReminderEnabled: false,
    streakReminderTime: "20:00",
    quietHoursEnabled: false,
    quietHoursStart: "22:00",
    quietHoursEnd: "07:00",
    weeklySummaryEnabled: false,
    taskRemindersEnabled: true,
    soundEnabled: true,
    hapticsEnabled: true
});

const BOOLEAN_FIELDS = [
    "notificationsEnabled",
    "dailyReminderEnabled",
    "dailyQuestReminderEnabled",
    "streakReminderEnabled",
    "quietHoursEnabled",
    "weeklySummaryEnabled",
    "taskRemindersEnabled",
    "soundEnabled",
    "hapticsEnabled"
];
const TIME_FIELDS = ["dailyReminderTime", "dailyQuestReminderTime", "streakReminderTime", "quietHoursStart", "quietHoursEnd"];
const ALLOWED_FIELDS = new Set([...BOOLEAN_FIELDS, ...TIME_FIELDS]);
const LOCAL_TIME = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

export class PreferenceError extends Error {}

export function validLocalTime(value) {
    return typeof value === "string" && LOCAL_TIME.test(value);
}

export function resolvePreferences(stored = {}) {
    const resolved = { ...DEFAULT_PREFERENCES };
    for (const field of BOOLEAN_FIELDS) {
        if (typeof stored[field] === "boolean") resolved[field] = stored[field];
    }
    for (const field of TIME_FIELDS) if (validLocalTime(stored[field]) || (field === "dailyReminderTime" && stored[field] === null)) resolved[field] = stored[field];
    return resolved;
}

export function preferencesFromItem(item) {
    const stored = {};
    for (const field of BOOLEAN_FIELDS) stored[field] = item?.[field]?.BOOL;
    for (const field of TIME_FIELDS) stored[field] = item?.[field]?.S ?? DEFAULT_PREFERENCES[field];
    return {
        ...resolvePreferences(stored),
        nextDueAt: item?.nextDueAt?.S ?? null
    };
}

export function validatePreferencePatch(body, current = DEFAULT_PREFERENCES) {
    if (!body || typeof body !== "object" || Array.isArray(body)) {
        throw new PreferenceError("Request body must be a JSON object");
    }
    const fields = Object.keys(body);
    const invalid = fields.filter((field) => !ALLOWED_FIELDS.has(field));
    if (invalid.length) throw new PreferenceError(`Fields cannot be edited: ${invalid.join(", ")}`);
    if (!fields.length) throw new PreferenceError("At least one editable field is required");

    const patch = {};
    for (const field of BOOLEAN_FIELDS) {
        if (!Object.hasOwn(body, field)) continue;
        if (typeof body[field] !== "boolean") throw new PreferenceError(`${field} must be a boolean`);
        patch[field] = body[field];
    }
    for (const field of TIME_FIELDS) if (Object.hasOwn(body, field)) {
        if (!(field === "dailyReminderTime" && body[field] === null) && !validLocalTime(body[field])) throw new PreferenceError(`${field} must be a local time in HH:MM format`);
        patch[field] = body[field];
    }

    const resolved = { ...resolvePreferences(current), ...patch };
    if (resolved.dailyReminderEnabled && !resolved.dailyReminderTime) {
        throw new PreferenceError("dailyReminderTime is required when dailyReminderEnabled is true");
    }
    if (resolved.quietHoursEnabled && resolved.quietHoursStart === resolved.quietHoursEnd) throw new PreferenceError("Quiet hours must have different start and end times");
    return { patch, resolved };
}

export function preferenceUpdateRequest(tableName, userId, patch, schedule, now) {
    const names = { "#updatedAt": "updatedAt" };
    const values = { ":updatedAt": { S: now } };
    const set = ["#updatedAt = :updatedAt"];
    const remove = [];

    for (const [field, value] of Object.entries(patch)) {
        names[`#${field}`] = field;
        if (field === "dailyReminderTime" && value === null) {
            remove.push(`#${field}`);
        } else {
            values[`:${field}`] = typeof value === "boolean" ? { BOOL: value } : { S: value };
            set.push(`#${field} = :${field}`);
        }
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
        Key: { PK: { S: `USER#${userId}` }, SK: { S: "PREFERENCES" } },
        UpdateExpression: [`SET ${set.join(", ")}`, remove.length ? `REMOVE ${remove.join(", ")}` : ""]
            .filter(Boolean).join(" "),
        ExpressionAttributeNames: names,
        ExpressionAttributeValues: values,
        ReturnValues: "ALL_NEW"
    };
}
