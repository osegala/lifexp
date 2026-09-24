export const DUE_INDEX_NAME = "NotificationDueIndex";
export const DUE_PARTITION = "NOTIFICATION_DUE";

const LOCAL_TIME = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const WEEKDAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const formatters = new Map();

function formatter(timeZone) {
    if (!formatters.has(timeZone)) {
        formatters.set(timeZone, new Intl.DateTimeFormat("en-CA", {
            timeZone,
            calendar: "iso8601",
            numberingSystem: "latn",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hourCycle: "h23"
        }));
    }
    return formatters.get(timeZone);
}

export function zonedParts(value, timeZone) {
    const date = value instanceof Date ? value : new Date(value);
    if (!Number.isFinite(date.getTime())) throw new RangeError("Invalid date");
    const parts = Object.fromEntries(formatter(timeZone)
        .formatToParts(date)
        .filter(({ type }) => type !== "literal")
        .map(({ type, value: part }) => [type, Number(part)]));
    const plainDate = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
    return {
        year: parts.year,
        month: parts.month,
        day: parts.day,
        hour: parts.hour,
        minute: parts.minute,
        second: parts.second,
        weekday: WEEKDAYS[plainDate.getUTCDay()]
    };
}

function offsetAt(instant, timeZone) {
    const parts = zonedParts(instant, timeZone);
    const representedAsUtc = Date.UTC(
        parts.year,
        parts.month - 1,
        parts.day,
        parts.hour,
        parts.minute,
        parts.second
    );
    return representedAsUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

function utcCandidates(year, month, day, hour, minute, timeZone) {
    const wallClockAsUtc = Date.UTC(year, month - 1, day, hour, minute);
    const offsets = new Set([-48, -24, 0, 24, 48]
        .map((hours) => offsetAt(new Date(wallClockAsUtc + hours * 3600000), timeZone)));

    return [...offsets]
        .map((offset) => new Date(wallClockAsUtc - offset))
        .filter((candidate) => {
            const parts = zonedParts(candidate, timeZone);
            return parts.year === year
                && parts.month === month
                && parts.day === day
                && parts.hour === hour
                && parts.minute === minute;
        })
        .sort((a, b) => a - b);
}

export function nextDueAt({ timeZone, localTime, daysOfWeek = [] }, after = new Date()) {
    if (!LOCAL_TIME.test(localTime ?? "")) throw new RangeError("Invalid local time");
    const allowedDays = new Set(daysOfWeek);
    if ([...allowedDays].some((day) => !WEEKDAYS.includes(day))) throw new RangeError("Invalid weekday");

    const afterDate = after instanceof Date ? after : new Date(after);
    const start = zonedParts(afterDate, timeZone);
    const [hour, minute] = localTime.split(":").map(Number);
    const localCalendar = new Date(Date.UTC(start.year, start.month - 1, start.day));

    for (let offset = 0; offset <= 7; offset += 1) {
        const date = new Date(localCalendar);
        date.setUTCDate(date.getUTCDate() + offset);
        const weekday = WEEKDAYS[date.getUTCDay()];
        if (allowedDays.size && !allowedDays.has(weekday)) continue;

        // The earliest instant is canonical on a fall-back day, preventing a repeated wall time from firing twice.
        const candidate = utcCandidates(
            date.getUTCFullYear(),
            date.getUTCMonth() + 1,
            date.getUTCDate(),
            hour,
            minute,
            timeZone
        )[0];
        if (candidate && candidate > afterDate) return candidate.toISOString();
    }

    throw new RangeError("No valid occurrence in the next seven local calendar days");
}

export function notificationSchedule(config, after = new Date()) {
    if (!config.enabled) return null;
    const dueAt = nextDueAt(config, after);
    return {
        nextDueAt: dueAt,
        GSI1PK: DUE_PARTITION,
        GSI1SK: `${dueAt}#${config.identifier}`
    };
}

export function isScheduledOccurrence(dueAt, { timeZone, localTime, daysOfWeek = [] }) {
    if (!LOCAL_TIME.test(localTime ?? "")) return false;
    const parts = zonedParts(dueAt, timeZone);
    const matchesTime = `${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}` === localTime;
    return matchesTime && (!daysOfWeek.length || daysOfWeek.includes(parts.weekday));
}

export function localDateAt(value, timeZone) {
    const parts = zonedParts(value, timeZone);
    return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}
