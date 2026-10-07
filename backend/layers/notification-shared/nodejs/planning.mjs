import { addDays, localDate } from "/opt/nodejs/dates.mjs";
import { completedOn, isRecurring, scheduleFromItem, scheduledOn } from "/opt/nodejs/task-schedule.mjs";
import { activityStreak } from "/opt/nodejs/activity-streak.mjs";
import { localInstant, nextDueAt, zonedParts, DUE_PARTITION } from "./scheduling.mjs";

export const DELIVERY_WINDOW_MS = 5 * 60_000;
export const DAILY_TYPES = [
    ["DAILY_SUMMARY", "dailyReminderEnabled", "dailyReminderTime"],
    ["DAILY_QUEST", "dailyQuestReminderEnabled", "dailyQuestReminderTime"],
    ["STREAK_AT_RISK", "streakReminderEnabled", "streakReminderTime"]
];

export function inQuietHours(preferences, instant, timeZone) {
    if (!preferences.quietHoursEnabled) return false;
    const parts = zonedParts(instant, timeZone);
    const time = `${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}`;
    const { quietHoursStart: start, quietHoursEnd: end } = preferences;
    return start < end ? time >= start && time < end : time >= start || time < end;
}

export function dueSchedule(dueAt, identifier) {
    return dueAt ? { nextDueAt: dueAt, GSI1PK: DUE_PARTITION, GSI1SK: `${dueAt}#${identifier}` } : null;
}

export function preferenceSchedule(preferences, timeZone, identifier, now) {
    if (!preferences.notificationsEnabled) return null;
    const times = DAILY_TYPES.filter(([, enabled]) => preferences[enabled])
        .map(([, , clock]) => nextDueAt({ timeZone, localTime: preferences[clock] }, now));
    return dueSchedule(times.sort()[0], identifier);
}

// The task's canonical recurrence decides dates. Only wall-time conversion and
// reminder offsets live here; daysOfWeek on legacy reminders is not a second rule.
export function taskOccurrences(values, taskItem, timeZone, after) {
    if (!taskItem || !values.enabled) return [];
    const task = scheduleFromItem(taskItem);
    if (!task.active || task.archived || (!isRecurring(task) && task.completed)) return [];
    const clock = values.offsetMinutes != null ? task.dueTime : values.localTime;
    if (!clock) return [];
    const offset = values.offsetMinutes ?? 0;
    const today = localDate(after, timeZone);
    const configuredAt = new Date(values.createdAt ?? taskItem.createdAt?.S ?? after);
    let anchor = task.startDate ?? localDate(configuredAt, timeZone);
    if (!task.startDate && !isRecurring(task)) {
        const instant = localInstant(anchor, clock, timeZone);
        if (!instant || instant.getTime() - offset * 60_000 <= configuredAt.getTime()) anchor = addDays(anchor, 1);
    }
    // Include tomorrow because a 00:15 due time minus 60m falls on the prior day.
    const start = isRecurring(task) ? (task.startDate > today ? task.startDate : today) : anchor;
    const result = [];
    for (let day = 0; day <= (isRecurring(task) ? 63 : 0); day++) {
        const date = addDays(start, day);
        if (!scheduledOn(task, date) || completedOn(task, date, timeZone)) continue;
        const due = localInstant(date, clock, timeZone);
        if (!due) continue;
        const at = new Date(due.getTime() - offset * 60_000);
        if (at > after) result.push({ at: at.toISOString(), date, occurrence: isRecurring(task) ? date : "ONCE" });
    }
    return result;
}

export function taskReminderSchedule(values, task, timeZone, identifier, now) {
    return dueSchedule(taskOccurrences(values, task, timeZone, now)[0]?.at, identifier);
}

export function reminderValues(item) {
    return { enabled: item.enabled?.BOOL === true, createdAt: item.createdAt?.S, localTime: item.localTime?.S ?? null,
        offsetMinutes: item.offsetMinutes?.N == null ? null : Number(item.offsetMinutes.N) };
}

// Pure, server-only planning. Reads have to succeed before this is called.
export function planNotifications({ config, profile, preferences, task, tasks = [], stats = [], now, dailyTarget = 3 }) {
    const timeZone = profile?.timeZone?.S ?? "UTC";
    if (!profile) return { schedule: null, events: [] };
    const today = localDate(now, timeZone);
    const identifier = `${config.PK.S}#${config.SK.S}`;
    const earliest = new Date(Math.max(now.getTime() - DELIVERY_WINDOW_MS,
        Date.parse(config.updatedAt?.S ?? config.createdAt?.S ?? "") || 0,
        Date.parse(task?.updatedAt?.S ?? "") || 0));
    let events, schedule;
    if (config.SK.S === "PREFERENCES") {
        schedule = preferenceSchedule(preferences, timeZone, identifier, now);
        events = DAILY_TYPES.filter(([, enabled]) => preferences.notificationsEnabled && preferences[enabled])
            .map(([type, , clock]) => ({ type, date: today, occurrence: today, at: localInstant(today, preferences[clock], timeZone)?.toISOString() }))
            .filter(event => event.at && new Date(event.at) > earliest && new Date(event.at) <= now);
    } else {
        const values = reminderValues(config);
        schedule = taskReminderSchedule(values, task, timeZone, identifier, now);
        events = taskOccurrences(values, task, timeZone, earliest)
            .filter(event => new Date(event.at) <= now).map(event => ({ ...event, type: "TASK_DUE" }));
    }
    const daily = stats.find(item => item.SK?.S === `STATS#DAY#${today}`);
    const completed = Number(daily?.tasksCompleted?.N ?? 0);
    const streak = activityStreak(stats, today);
    const count = tasks.filter(item => {
        const value = scheduleFromItem(item);
        return scheduledOn(value, today) && !completedOn(value, today, timeZone);
    }).length;
    return { schedule, events: events.map(event => {
        let reason = null;
        if (!preferences.notificationsEnabled) reason = "NOTIFICATIONS_DISABLED";
        else if (event.type === "TASK_DUE" && !preferences.taskRemindersEnabled) reason = "TASK_REMINDERS_DISABLED";
        else if (inQuietHours(preferences, event.at, timeZone) || inQuietHours(preferences, now, timeZone)) reason = "QUIET_HOURS";
        else if (event.type === "DAILY_SUMMARY" && !count) reason = "NO_TASKS_DUE";
        else if (event.type === "DAILY_QUEST" && (completed >= dailyTarget || daily?.goalRewarded?.BOOL)) reason = "QUEST_COMPLETE";
        else if (event.type === "STREAK_AT_RISK" && (streak.completedToday || !streak.currentDays)) reason = "STREAK_NOT_AT_RISK";
        const body = event.type === "TASK_DUE" ? `Reminder: ${(task?.title?.S ?? "Task").replace(/\s+/g, " ").slice(0, 120)}`
            : event.type === "DAILY_SUMMARY" ? `${count} ${count === 1 ? "task awaits" : "tasks await"} you in Evrenthia.`
            : event.type === "DAILY_QUEST" ? `Your Daily Quest is ${completed}/${dailyTarget} complete.`
            : `Complete a task today to keep your ${streak.currentDays}-day streak.`;
        return { ...event, reason, body };
    }) };
}
