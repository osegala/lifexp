export const WEEKDAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

export function localDate(now, timeZone) {
    const parts = new Intl.DateTimeFormat("en-US", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
    }).formatToParts(now);

    const value = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
    return `${value.year}-${value.month}-${value.day}`;
}

export function addDays(date, days) {
    const value = new Date(`${date}T00:00:00Z`);
    value.setUTCDate(value.getUTCDate() + days);
    return value.toISOString().slice(0, 10);
}

export function weekday(date) {
    return WEEKDAYS[new Date(`${date}T00:00:00Z`).getUTCDay()];
}

export function repeatDays(item) {
    if (item.repeatDays?.L) {
        return item.repeatDays.L.map((value) => value.S).filter(Boolean);
    }

    return item.repeatDays?.SS ?? [];
}

export function wasCompletedOn(item, date, timeZone) {
    if (item.lastCompletedDate?.S) {
        return item.lastCompletedDate.S === date;
    }

    if (!item.completedAt?.S) {
        return false;
    }

    try {
        return localDate(new Date(item.completedAt.S), timeZone) === date;
    } catch {
        return false;
    }
}

export function isScheduledOn(item, date, completedToday = item.lastCompletedDate?.S === date) {
    if (item.archived?.BOOL === true || item.active?.BOOL === false) {
        return false;
    }

    switch (item.repeatType?.S ?? "NONE") {
        case "DAILY":
            return true;
        case "WEEKLY":
            return repeatDays(item).includes(weekday(date));
        default:
            return item.completed?.BOOL !== true || completedToday;
    }
}

export function isArchived(item) {
    return item.archived === true || item.archived?.BOOL === true;
}

export function visibleTasks(items, includeArchived = false) {
    return includeArchived ? items : items.filter((item) => !isArchived(item));
}

export function previousScheduledDate(item, date) {
    const repeatType = item.repeatType?.S ?? "NONE";

    if (repeatType === "NONE") {
        return null;
    }

    for (let offset = 1; offset <= 7; offset++) {
        const candidate = addDays(date, -offset);
        if (repeatType === "DAILY" || repeatDays(item).includes(weekday(candidate))) {
            return candidate;
        }
    }

    return null;
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
