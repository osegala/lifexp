import { addDays, localDate, weekday } from "./dates.mjs";

export const isRecurring = (task) => ["DAILY", "WEEKLY", "MONTHLY"].includes(task.repeatType);

export function scheduledOn(task, date, completedToday = false) {
    if (task.archived || task.active === false || (task.startDate && date < task.startDate)) return false;
    switch (task.repeatType) {
        case "DAILY": return true;
        case "WEEKLY": return (task.repeatDays ?? []).includes(weekday(date));
        case "MONTHLY": {
            if (!task.startDate) return false;
            const lastDay = new Date(`${date.slice(0, 7)}-01T00:00:00Z`);
            lastDay.setUTCMonth(lastDay.getUTCMonth() + 1, 0);
            return Number(date.slice(8)) === Math.min(Number(task.startDate.slice(8)), lastDay.getUTCDate());
        }
        case "NONE": return !task.completed || completedToday;
        default: return false;
    }
}

export function previousScheduledDate(task, date) {
    if (!isRecurring(task)) return null;
    // At most 31 days between monthly dates; the bound also stops malformed legacy rules.
    for (let offset = 1; offset <= 62; offset++) {
        const candidate = addDays(date, -offset);
        if (task.startDate && candidate < task.startDate) return null;
        if (scheduledOn(task, candidate)) return candidate;
    }
    return null;
}

export function nextScheduledDate(task, date, completedToday = false) {
    if (task.archived || task.active === false || (!isRecurring(task) && task.completed)) return null;
    let candidate = task.startDate && task.startDate > date ? task.startDate : date;
    if (candidate === date && completedToday) candidate = addDays(candidate, 1);
    for (let offset = 0; offset <= 62; offset++) {
        const next = addDays(candidate, offset);
        if (scheduledOn(task, next)) return next;
    }
    return null;
}

export function completedOn(task, date, timeZone) {
    if (task.lastCompletedDate === date) return true;
    if (!task.completedAt) return false;
    try { return localDate(new Date(task.completedAt), timeZone) === date; }
    catch { return false; }
}

export function scheduleFromItem(item) {
    return {
        repeatType: item.repeatType?.S ?? "NONE",
        repeatDays: item.repeatDays?.L?.map(day => day.S).filter(Boolean) ?? item.repeatDays?.SS ?? [],
        startDate: item.startDate?.S ?? null,
        dueTime: item.dueTime?.S ?? null,
        active: item.active?.BOOL !== false,
        archived: item.archived?.BOOL === true,
        completed: item.completed?.BOOL === true,
        completedAt: item.completedAt?.S ?? null,
        lastCompletedDate: item.lastCompletedDate?.S ?? null
    };
}
