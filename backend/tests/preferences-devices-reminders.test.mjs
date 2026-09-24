import test from "node:test";
import assert from "node:assert/strict";
import {
    DEFAULT_PREFERENCES,
    PreferenceError,
    preferenceUpdateRequest,
    preferencesFromItem,
    validatePreferencePatch
} from "../layers/notification-shared/nodejs/preferences.mjs";
import {
    DeviceError,
    deviceResponse,
    disableDeviceRequest,
    registerDeviceRequest,
    validateRegistration
} from "../functions/devices/logic.mjs";
import {
    ReminderError,
    assertTaskCanReceiveReminder,
    disableReminderRequest,
    effectiveReminderState,
    reminderItem,
    reminderListResponse,
    validateReminderCreate
} from "../functions/reminders/logic.mjs";

const now = "2026-09-23T12:00:00.000Z";
const deviceId = "device-12345678";
const reminderId = "123e4567-e89b-42d3-a456-426614174000";

test("missing preferences resolve to documented defaults", () => {
    assert.deepEqual(preferencesFromItem(), { ...DEFAULT_PREFERENCES, nextDueAt: null });
});

test("preference patches are partial and preserve other settings", () => {
    const { patch, resolved } = validatePreferencePatch({ soundEnabled: false }, DEFAULT_PREFERENCES);
    assert.deepEqual(patch, { soundEnabled: false });
    assert.equal(resolved.soundEnabled, false);
    assert.equal(resolved.notificationsEnabled, true);
    assert.equal(resolved.taskRemindersEnabled, true);
});

test("invalid daily reminder times and enabling without a time are rejected", () => {
    assert.throws(
        () => validatePreferencePatch({ dailyReminderTime: "24:00" }),
        PreferenceError
    );
    assert.throws(
        () => validatePreferencePatch({ dailyReminderEnabled: true }),
        /dailyReminderTime is required/
    );
    assert.equal(validatePreferencePatch({
        dailyReminderEnabled: true,
        dailyReminderTime: "19:30"
    }).resolved.dailyReminderTime, "19:30");
});

test("preference updates cannot duplicate or modify PROFILE.timeZone", () => {
    assert.throws(() => validatePreferencePatch({ timeZone: "UTC" }), PreferenceError);
    const request = preferenceUpdateRequest("Evrenthia-Dev", "user-123", { soundEnabled: false }, null, now);
    assert.deepEqual(request.Key.SK, { S: "PREFERENCES" });
    assert.doesNotMatch(JSON.stringify(request), /timeZone|PROFILE/);
});

test("valid Expo registrations are accepted", () => {
    assert.deepEqual(validateRegistration({
        deviceId,
        pushProvider: "EXPO",
        pushToken: "ExponentPushToken[abcdefgh12345678]",
        platform: "IOS"
    }), {
        deviceId,
        pushProvider: "EXPO",
        pushToken: "ExponentPushToken[abcdefgh12345678]",
        platform: "IOS"
    });
});

test("invalid device providers and platforms are rejected", () => {
    const registration = {
        deviceId,
        pushProvider: "EXPO",
        pushToken: "ExpoPushToken[abcdefgh12345678]",
        platform: "ANDROID"
    };
    assert.throws(() => validateRegistration({ ...registration, pushProvider: "APNS" }), DeviceError);
    assert.throws(() => validateRegistration({ ...registration, platform: "WEB" }), DeviceError);
});

test("token refresh updates the same device key while preserving createdAt", () => {
    const first = registerDeviceRequest("Evrenthia-Dev", "user-123", validateRegistration({
        deviceId,
        pushProvider: "EXPO",
        pushToken: "ExpoPushToken[firsttoken123]",
        platform: "ANDROID"
    }), now);
    const refreshed = registerDeviceRequest("Evrenthia-Dev", "user-123", validateRegistration({
        deviceId,
        pushProvider: "EXPO",
        pushToken: "ExpoPushToken[secondtoken456]",
        platform: "ANDROID"
    }), "2026-09-24T12:00:00.000Z");
    assert.deepEqual(first.Key, refreshed.Key);
    assert.notDeepEqual(first.ExpressionAttributeValues[":pushToken"], refreshed.ExpressionAttributeValues[":pushToken"]);
    assert.match(first.UpdateExpression, /if_not_exists\(#createdAt, :now\)/);
});

test("device responses hide push tokens", () => {
    const result = deviceResponse({
        PK: { S: "USER#user-123" },
        SK: { S: `DEVICE#${deviceId}` },
        pushProvider: { S: "EXPO" },
        pushToken: { S: "ExpoPushToken[private-token]" },
        platform: { S: "IOS" },
        enabled: { BOOL: true }
    });
    assert.equal(result.deviceId, deviceId);
    assert.equal(Object.hasOwn(result, "pushToken"), false);
    assert.doesNotMatch(JSON.stringify(result), /private-token|\bPK\b|\bSK\b/);
});

test("device deletion soft-disables and remains idempotent", () => {
    const request = disableDeviceRequest("Evrenthia-Dev", "user-123", deviceId, now);
    assert.match(request.UpdateExpression, /SET #enabled = :false/);
    assert.deepEqual(request.ExpressionAttributeValues[":false"], { BOOL: false });
    assert.equal(request.ConditionExpression, "attribute_exists(PK) AND attribute_exists(SK)");
    assert.doesNotMatch(JSON.stringify(request), /DeleteItem|#enabled = :true/);
});

test("TASK reminders require an owned active non-archived task", () => {
    const values = validateReminderCreate({
        type: "TASK",
        taskId: "task-123",
        localTime: "08:00"
    });
    assert.doesNotThrow(() => assertTaskCanReceiveReminder({ active: { BOOL: true } }));
    assert.throws(() => assertTaskCanReceiveReminder(), (error) => error instanceof ReminderError && error.statusCode === 404);
    const item = reminderItem("user-123", reminderId, values, null, now);
    assert.deepEqual(item.PK, { S: "USER#user-123" });
    assert.deepEqual(item.taskId, { S: "task-123" });
});

test("archived and inactive tasks cannot receive new reminders", () => {
    assert.throws(
        () => assertTaskCanReceiveReminder({ active: { BOOL: false } }),
        /Inactive tasks/
    );
    assert.throws(
        () => assertTaskCanReceiveReminder({ active: { BOOL: true }, archived: { BOOL: true } }),
        /Archived tasks/
    );
});

test("reminders reject invalid local times and direct DAILY creation", () => {
    assert.throws(
        () => validateReminderCreate({ type: "TASK", taskId: "task-123", localTime: "8:00" }),
        /HH:MM/
    );
    assert.throws(
        () => validateReminderCreate({ type: "DAILY", taskId: "task-123", localTime: "08:00" }),
        /PATCH \/preferences/
    );
});

test("reminder deletion soft-disables rather than removes", () => {
    const request = disableReminderRequest("Evrenthia-Dev", "user-123", reminderId, now);
    assert.match(request.UpdateExpression, /#enabled = :enabled/);
    assert.deepEqual(request.ExpressionAttributeValues[":enabled"], { BOOL: false });
    assert.doesNotMatch(JSON.stringify(request), /DeleteItem/);
});

test("archiving a task makes its existing reminder effectively undeliverable", () => {
    const reminder = { type: { S: "TASK" }, enabled: { BOOL: true } };
    const preferences = {
        notificationsEnabled: true,
        taskRemindersEnabled: true,
        dailyReminderEnabled: false
    };
    assert.equal(effectiveReminderState(reminder, preferences, true, {
        active: { BOOL: true },
        archived: { BOOL: false }
    }), true);
    assert.equal(effectiveReminderState(reminder, preferences, true, {
        active: { BOOL: false },
        archived: { BOOL: true }
    }), false);
});

test("reminder responses use PROFILE.timeZone and exclude raw DynamoDB keys", () => {
    const reminder = reminderItem("user-123", reminderId, {
        type: "TASK",
        taskId: "task-123",
        enabled: true,
        localTime: "08:00",
        daysOfWeek: ["MON", "WED"]
    }, null, now);
    const result = reminderListResponse(
        [reminder],
        { timeZone: { S: "America/New_York" } },
        { notificationsEnabled: { BOOL: true }, taskRemindersEnabled: { BOOL: true } },
        [{ enabled: { BOOL: true } }],
        [{ SK: { S: "TASK#task-123" }, active: { BOOL: true }, archived: { BOOL: false } }]
    );
    assert.equal(result.timeZone, "America/New_York");
    assert.equal(result.reminders[0].effectiveNotificationsEnabled, true);
    assert.doesNotMatch(JSON.stringify(result), /"PK"|"SK"/);
});
