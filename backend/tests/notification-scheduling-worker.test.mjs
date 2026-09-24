import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
    isScheduledOccurrence,
    nextDueAt,
    notificationSchedule
} from "../layers/notification-shared/nodejs/scheduling.mjs";
import {
    preferenceUpdateRequest,
    preferencesFromItem
} from "../layers/notification-shared/nodejs/preferences.mjs";
import {
    disableReminderRequest,
    reminderIdFor,
    reminderItem,
    reminderPutRequest,
    reminderResponse,
    validateReminderCreate
} from "../functions/reminders/logic.mjs";
import {
    claimRequest,
    deliveryRecord,
    dueQueryRequest,
    evaluateDelivery
} from "../functions/notification-worker/logic.mjs";
import {
    createExpoProvider,
    deliveryMode
} from "../functions/notification-worker/push-provider.mjs";

const now = new Date("2026-09-23T12:00:30.000Z");
const backend = fileURLToPath(new URL("../", import.meta.url));
const taskConfig = {
    PK: { S: "USER#user-123" },
    SK: { S: "REMINDER#reminder-123" },
    type: { S: "TASK" },
    reminderId: { S: "reminder-123" },
    taskId: { S: "task-123" },
    enabled: { BOOL: true },
    nextDueAt: { S: "2026-09-23T12:00:00.000Z" }
};
const preferences = {
    notificationsEnabled: true,
    dailyReminderEnabled: false,
    dailyReminderTime: null,
    weeklySummaryEnabled: false,
    taskRemindersEnabled: true,
    soundEnabled: true,
    hapticsEnabled: true,
    nextDueAt: null
};
const activeTask = {
    active: { BOOL: true },
    archived: { BOOL: false },
    title: { S: "Practice sword drills" }
};
const enabledDevice = {
    deviceId: { S: "device-123" },
    pushProvider: { S: "EXPO" },
    pushToken: { S: "ExpoPushToken[private-token-123]" },
    enabled: { BOOL: true }
};

test("global daily reminders are configured only through preferences", () => {
    assert.throws(
        () => validateReminderCreate({ type: "DAILY", localTime: "08:00" }),
        /PATCH \/preferences/
    );
    const schedule = notificationSchedule({
        enabled: true,
        timeZone: "America/New_York",
        localTime: "08:00",
        daysOfWeek: [],
        identifier: "user-123#DAILY"
    }, now);
    const request = preferenceUpdateRequest(
        "Evrenthia-Dev",
        "user-123",
        { dailyReminderEnabled: true, dailyReminderTime: "08:00" },
        schedule,
        now.toISOString()
    );
    assert.deepEqual(request.Key.SK, { S: "PREFERENCES" });
    assert.match(request.UpdateExpression, /#GSI1PK = :GSI1PK/);
});

test("clientRequestId deterministically scopes idempotency to one user", () => {
    const first = reminderIdFor("user-123", "request-12345678");
    assert.equal(first, reminderIdFor("user-123", "request-12345678"));
    assert.notEqual(first, reminderIdFor("user-456", "request-12345678"));
    assert.match(first, /^req-[0-9a-f]{32}$/);

    const values = validateReminderCreate({
        type: "TASK",
        taskId: "task-123",
        localTime: "08:00",
        clientRequestId: "request-12345678"
    });
    const item = reminderItem("user-123", first, values, null, now.toISOString());
    const request = reminderPutRequest("Evrenthia-Dev", item);
    assert.deepEqual(request.Item.SK, { S: `REMINDER#${first}` });
    assert.equal(request.ConditionExpression, "attribute_not_exists(PK) AND attribute_not_exists(SK)");
});

test("nextDueAt converts local wall-clock time to UTC", () => {
    assert.equal(nextDueAt({
        timeZone: "America/New_York",
        localTime: "09:00"
    }, new Date("2026-01-15T12:00:00.000Z")), "2026-01-15T14:00:00.000Z");
    assert.equal(nextDueAt({
        timeZone: "Asia/Tokyo",
        localTime: "09:00"
    }, new Date("2026-01-15T23:30:00.000Z")), "2026-01-16T00:00:00.000Z");
});

test("nextDueAt is DST-safe for missing and repeated local times", () => {
    assert.equal(nextDueAt({
        timeZone: "America/New_York",
        localTime: "02:30"
    }, new Date("2026-03-08T05:00:00.000Z")), "2026-03-09T06:30:00.000Z");
    assert.equal(nextDueAt({
        timeZone: "America/New_York",
        localTime: "01:30"
    }, new Date("2026-11-01T04:00:00.000Z")), "2026-11-01T05:30:00.000Z");
});

test("nextDueAt honors configured weekdays", () => {
    const due = nextDueAt({
        timeZone: "UTC",
        localTime: "08:00",
        daysOfWeek: ["MON", "WED"]
    }, new Date("2026-09-23T09:00:00.000Z"));
    assert.equal(due, "2026-09-28T08:00:00.000Z");
    assert.equal(isScheduledOccurrence(due, {
        timeZone: "UTC",
        localTime: "08:00",
        daysOfWeek: ["MON", "WED"]
    }), true);
});

test("disabling daily preferences removes sparse due-index fields", () => {
    const request = preferenceUpdateRequest(
        "Evrenthia-Dev",
        "user-123",
        { dailyReminderEnabled: false },
        null,
        now.toISOString()
    );
    assert.match(request.UpdateExpression, /REMOVE #nextDueAt, #GSI1PK, #GSI1SK/);
});

test("disabling a task reminder removes sparse due-index fields", () => {
    const request = disableReminderRequest(
        "Evrenthia-Dev",
        "user-123",
        "123e4567-e89b-42d3-a456-426614174000",
        now.toISOString()
    );
    assert.match(request.UpdateExpression, /REMOVE #nextDueAt, #GSI1PK, #GSI1SK/);
});

test("worker skips archived and inactive tasks", () => {
    for (const [task, reason] of [
        [{ active: { BOOL: true }, archived: { BOOL: true } }, "TASK_ARCHIVED"],
        [{ active: { BOOL: false }, archived: { BOOL: false } }, "TASK_INACTIVE"]
    ]) {
        assert.equal(evaluateDelivery({
            config: taskConfig,
            preferences,
            task,
            devices: [enabledDevice],
            occurrenceValid: true,
            now
        }).reason, reason);
    }
});

test("worker respects global and task notification preferences", () => {
    assert.equal(evaluateDelivery({
        config: taskConfig,
        preferences: { ...preferences, notificationsEnabled: false },
        task: activeTask,
        devices: [enabledDevice],
        occurrenceValid: true,
        now
    }).reason, "NOTIFICATIONS_DISABLED");
    assert.equal(evaluateDelivery({
        config: taskConfig,
        preferences: { ...preferences, taskRemindersEnabled: false },
        task: activeTask,
        devices: [enabledDevice],
        occurrenceValid: true,
        now
    }).reason, "TASK_REMINDERS_DISABLED");
});

test("canonical resolver defaults missing task and global notification booleans to true", () => {
    const empty = preferencesFromItem();
    const partial = preferencesFromItem({
        dailyReminderEnabled: { BOOL: true },
        dailyReminderTime: { S: "08:00" }
    });
    assert.equal(empty.taskRemindersEnabled, true);
    assert.equal(empty.notificationsEnabled, true);
    assert.equal(partial.taskRemindersEnabled, true);
    assert.equal(partial.notificationsEnabled, true);
});

test("worker processes TASK reminders when sparse preferences omit taskRemindersEnabled", () => {
    const sparsePreferences = preferencesFromItem({
        notificationsEnabled: { BOOL: true }
    });
    const decision = evaluateDelivery({
        config: taskConfig,
        preferences: sparsePreferences,
        task: activeTask,
        devices: [enabledDevice],
        occurrenceValid: true,
        now
    });
    assert.equal(decision.deliver, true);
    assert.equal(decision.reason, null);
});

test("explicit false preference values still disable worker delivery", () => {
    const taskDisabled = preferencesFromItem({ taskRemindersEnabled: { BOOL: false } });
    const notificationsDisabled = preferencesFromItem({ notificationsEnabled: { BOOL: false } });
    assert.equal(evaluateDelivery({
        config: taskConfig,
        preferences: taskDisabled,
        task: activeTask,
        devices: [enabledDevice],
        occurrenceValid: true,
        now
    }).reason, "TASK_REMINDERS_DISABLED");
    assert.equal(evaluateDelivery({
        config: taskConfig,
        preferences: notificationsDisabled,
        task: activeTask,
        devices: [enabledDevice],
        occurrenceValid: true,
        now
    }).reason, "NOTIFICATIONS_DISABLED");
});

test("GET preferences and NotificationWorker import the same canonical resolver", () => {
    const getPreferencesSource = readFileSync(`${backend}/functions/preferences/get.mjs`, "utf8");
    const workerSource = readFileSync(`${backend}/functions/notification-worker/index.mjs`, "utf8");
    for (const source of [getPreferencesSource, workerSource]) {
        assert.match(source, /preferencesFromItem.*\/opt\/nodejs\/preferences\.mjs/s);
    }

    const raw = {
        dailyReminderEnabled: { BOOL: true },
        dailyReminderTime: { S: "19:30" },
        soundEnabled: { BOOL: false }
    };
    assert.deepEqual(preferencesFromItem(raw), {
        notificationsEnabled: true,
        dailyReminderEnabled: true,
        dailyReminderTime: "19:30",
        weeklySummaryEnabled: false,
        taskRemindersEnabled: true,
        soundEnabled: false,
        hapticsEnabled: true,
        nextDueAt: null
    });
});

test("worker produces no push targets without an enabled device", () => {
    const decision = evaluateDelivery({
        config: taskConfig,
        preferences,
        task: activeTask,
        devices: [{ ...enabledDevice, enabled: { BOOL: false } }],
        occurrenceValid: true,
        now
    });
    assert.equal(decision.deliver, false);
    assert.equal(decision.reason, "NO_ENABLED_DEVICES");
    assert.deepEqual(decision.devices, []);
});

test("conditional claim prevents overlapping workers from claiming one occurrence", () => {
    const request = claimRequest("Evrenthia-Dev", {
        PK: taskConfig.PK,
        SK: taskConfig.SK,
        GSI1SK: { S: "2026-09-23T12:00:00.000Z#user-123#reminder-123" }
    }, now.toISOString());
    assert.match(request.ConditionExpression, /#dueSort = :dueKey/);
    assert.match(request.ConditionExpression, /#deliveryClaimKey <> :dueKey/);
});

test("delivery history never stores a push token", () => {
    const record = deliveryRecord({
        userPk: "USER#user-123",
        deliveryId: "delivery-123",
        attemptedAt: now.toISOString(),
        localDate: "2026-09-23",
        type: "TASK",
        config: taskConfig,
        device: enabledDevice,
        status: "PREPARED"
    });
    assert.doesNotMatch(JSON.stringify(record), /pushToken|private-token/);
    assert.deepEqual(record.deviceId, { S: "device-123" });
});

test("worker queries the due GSI with a bounded Query and never scans", () => {
    const request = dueQueryRequest("Evrenthia-Dev", now, 25);
    assert.equal(request.IndexName, "NotificationDueIndex");
    assert.equal(request.Limit, 25);
    assert.match(request.KeyConditionExpression, /GSI|dueSort/);
    assert.equal(Object.hasOwn(request, "TotalSegments"), false);
});

test("push delivery defaults to DRY_RUN without a network request", async () => {
    let networkCalled = false;
    const provider = createExpoProvider({
        mode: deliveryMode({}),
        fetchImpl: async () => {
            networkCalled = true;
            throw new Error("network should not be called");
        }
    });
    const result = await provider.send({
        token: "ExpoPushToken[private-token-123]",
        title: "Evrenthia",
        body: "Reminder: Task",
        data: { type: "TASK" }
    });
    assert.equal(provider.mode, "DRY_RUN");
    assert.equal(result.status, "PREPARED");
    assert.equal(networkCalled, false);
});

test("preference and reminder responses hide GSI and locking fields", () => {
    const internal = {
        GSI1PK: { S: "NOTIFICATION_DUE" },
        GSI1SK: { S: "private-index-key" },
        deliveryClaimKey: { S: "private-claim" },
        nextDueAt: { S: "2026-09-24T12:00:00.000Z" }
    };
    const preferenceResponse = preferencesFromItem(internal);
    const taskResponse = reminderResponse({
        ...internal,
        SK: { S: "REMINDER#reminder-123" },
        type: { S: "TASK" },
        taskId: { S: "task-123" }
    });
    assert.equal(preferenceResponse.nextDueAt, "2026-09-24T12:00:00.000Z");
    assert.equal(taskResponse.nextDueAt, "2026-09-24T12:00:00.000Z");
    assert.doesNotMatch(JSON.stringify({ preferenceResponse, taskResponse }), /GSI1|deliveryClaim|private-index|private-claim/);
});
