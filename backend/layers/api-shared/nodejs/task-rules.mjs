import { completedOn, previousScheduledDate as previousDate, scheduleFromItem, scheduledOn } from "./task-schedule.mjs";
export { WEEKDAYS, localDate, addDays, weekday } from "./dates.mjs";

export function repeatDays(item) {
    if (item.repeatDays?.L) {
        return item.repeatDays.L.map((value) => value.S).filter(Boolean);
    }

    return item.repeatDays?.SS ?? [];
}

export function wasCompletedOn(item, date, timeZone) {
    return completedOn(scheduleFromItem(item), date, timeZone);
}

export function isScheduledOn(item, date, completedToday = item.lastCompletedDate?.S === date) {
    return scheduledOn(scheduleFromItem(item), date, completedToday);
}

export function isArchived(item) {
    return item.archived === true || item.archived?.BOOL === true;
}

export function visibleTasks(items, includeArchived = false) {
    return includeArchived ? items : items.filter((item) => !isArchived(item));
}

export function previousScheduledDate(item, date) {
    return previousDate(scheduleFromItem(item), date);
}

export function effectiveCurrentStreak(item, date) {
    const current = Number(item.currentStreak?.N ?? 0);
    const lastCompletedDate = item.lastCompletedDate?.S;

    if (!lastCompletedDate || current === 0) {
        return 0;
    }

    if ((item.repeatType?.S ?? "NONE") === "NONE" || lastCompletedDate === date) {
        return current;
    }

    return lastCompletedDate === previousScheduledDate(item, date) ? current : 0;
}
