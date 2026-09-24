import { ApiError } from "./http.mjs";
import { isTaskSize } from "./task-rewards.mjs";

const EDITABLE_FIELDS = new Set(["title", "description", "repeatType", "repeatDays", "active", "taskSize"]);
export const PROTECTED_TASK_FIELDS = new Set([
    "completed", "completedAt", "currentStreak", "bestStreak", "lastCompletedDate",
    "lastCompletedAt", "xpReward", "coinReward", "timeZone", "archived", "archivedAt"
]);
const REPEAT_TYPES = new Set(["NONE", "DAILY", "WEEKLY"]);
const WEEKDAYS = new Set(["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]);

function invalid(code, message, field, fieldCode = "INVALID") {
    throw new ApiError(400, code, message, field ? [{ field, code: fieldCode, message }] : undefined);
}

function validateObject(body) {
    if (!body || Array.isArray(body) || typeof body !== "object") {
        invalid("VALIDATION_ERROR", "Request body must be a JSON object.");
    }
    const fields = Object.keys(body);
    const protectedFields = fields.filter((field) => PROTECTED_TASK_FIELDS.has(field));
    if (protectedFields.length) {
        throw new ApiError(400, "VALIDATION_ERROR", "Server-managed task fields cannot be changed.",
            protectedFields.map((field) => ({
                field,
                code: "SERVER_MANAGED",
                message: `${field} is managed by the server.`
            })));
    }
    const unsupported = fields.filter((field) => !EDITABLE_FIELDS.has(field));
    if (unsupported.length) {
        throw new ApiError(400, "VALIDATION_ERROR", "Request contains unsupported task fields.",
            unsupported.map((field) => ({ field, code: "UNSUPPORTED_FIELD", message: `${field} is not supported.` })));
    }
    return fields;
}

function normalizeTitle(value, required) {
    if (value === undefined && !required) return undefined;
    if (typeof value !== "string" || !value.trim()) {
        invalid("VALIDATION_ERROR", required ? "title is required." : "title must not be blank.", "title", required ? "REQUIRED" : "INVALID_FORMAT");
    }
    const title = value.trim();
    if (title.length > 200) invalid("VALIDATION_ERROR", "title must be at most 200 characters.", "title", "TOO_LONG");
    return title;
}

function normalizeDescription(value) {
    if (value === undefined) return undefined;
    if (value !== null && (typeof value !== "string" || value.length > 2000)) {
        invalid("VALIDATION_ERROR", "description must be null or a string of at most 2000 characters.", "description");
    }
    return value === null || !value.trim() ? null : value.trim();
}

function normalizeRepeatType(value) {
    const repeatType = typeof value === "string" ? value.toUpperCase() : "";
    if (!REPEAT_TYPES.has(repeatType)) {
        invalid("INVALID_REPEAT_TYPE", "repeatType must be NONE, DAILY, or WEEKLY.", "repeatType");
    }
    return repeatType;
}

function normalizeRepeatDays(value) {
    if (!Array.isArray(value)) invalid("INVALID_REPEAT_DAYS", "repeatDays must be an array.", "repeatDays");
    const days = value.map((day) => typeof day === "string" ? day.toUpperCase() : "");
    if (days.some((day) => !WEEKDAYS.has(day))) {
        invalid("INVALID_REPEAT_DAYS", "repeatDays contains an invalid weekday.", "repeatDays");
    }
    if (new Set(days).size !== days.length) {
        invalid("INVALID_REPEAT_DAYS", "repeatDays must not contain duplicate weekdays.", "repeatDays", "DUPLICATE");
    }
    return days;
}

function normalizeTaskSize(value) {
    const taskSize = typeof value === "string" ? value.toUpperCase() : "";
    if (!isTaskSize(taskSize)) {
        invalid(
            "INVALID_TASK_SIZE",
            "taskSize must be QUICK, SMALL, NORMAL, CHALLENGING, or BIG.",
            "taskSize"
        );
    }
    return taskSize;
}

function validateSchedule(repeatType, repeatDays) {
    if (repeatType === "WEEKLY" && repeatDays.length === 0) {
        invalid("INVALID_REPEAT_DAYS", "repeatDays is required for WEEKLY tasks.", "repeatDays", "REQUIRED");
    }
    if (repeatType !== "WEEKLY" && repeatDays.length > 0) {
        invalid("INVALID_REPEAT_DAYS", "repeatDays is only valid for WEEKLY tasks.", "repeatDays");
    }
}

export function validateTaskCreate(body) {
    validateObject(body);
    const repeatType = normalizeRepeatType(body.repeatType ?? "NONE");
    const repeatDays = normalizeRepeatDays(body.repeatDays ?? []);
    validateSchedule(repeatType, repeatDays);
    if (body.active !== undefined && typeof body.active !== "boolean") {
        invalid("VALIDATION_ERROR", "active must be a boolean.", "active");
    }
    return {
        title: normalizeTitle(body.title, true),
        description: normalizeDescription(body.description) ?? null,
        taskSize: normalizeTaskSize(body.taskSize ?? "NORMAL"),
        repeatType,
        repeatDays,
        active: body.active ?? true
    };
}

export function validateTaskPatch(body, existing) {
    const fields = validateObject(body);
    if (!fields.length) invalid("VALIDATION_ERROR", "At least one editable field is required.");

    const patch = {};
    if (Object.hasOwn(body, "title")) patch.title = normalizeTitle(body.title, false);
    if (Object.hasOwn(body, "description")) patch.description = normalizeDescription(body.description);
    if (Object.hasOwn(body, "taskSize")) patch.taskSize = normalizeTaskSize(body.taskSize);
    if (Object.hasOwn(body, "active")) {
        if (typeof body.active !== "boolean") invalid("VALIDATION_ERROR", "active must be a boolean.", "active");
        patch.active = body.active;
    }
    if (Object.hasOwn(body, "repeatType")) patch.repeatType = normalizeRepeatType(body.repeatType);
    if (Object.hasOwn(body, "repeatDays")) patch.repeatDays = normalizeRepeatDays(body.repeatDays);

    const repeatType = patch.repeatType ?? existing.repeatType ?? "NONE";
    const repeatDays = Object.hasOwn(patch, "repeatDays")
        ? patch.repeatDays
        : Object.hasOwn(patch, "repeatType") && repeatType !== "WEEKLY"
            ? []
            : existing.repeatDays ?? [];
    validateSchedule(repeatType, repeatDays);
    if (Object.hasOwn(patch, "repeatType") && repeatType !== "WEEKLY") patch.repeatDays = [];
    return patch;
}
