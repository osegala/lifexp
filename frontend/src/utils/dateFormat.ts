const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function calendarDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? date : null;
}

/** Server calendar dates already represent the user's saved local day.
 * Timestamp values, in contrast, must be converted using their saved timezone. */
export function formatDate(value: string, options: { timeZone?: string; year?: boolean; weekday?: boolean } = {}) {
  const day = calendarDate(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(value) && !day) return "Date unavailable";
  const date = day ?? new Date(value);
  if (!Number.isFinite(date.getTime())) return "Date unavailable";
  try {
    return new Intl.DateTimeFormat("en-US", {
      month: "short", day: "numeric", ...(options.year ? { year: "numeric" } : {}),
      ...(options.weekday === false || options.year ? {} : { weekday: "long" }),
      timeZone: day ? "UTC" : options.timeZone,
    }).format(date);
  } catch {
    return "Date unavailable";
  }
}

/** Local schedule clocks are wall times, never shifted through the device zone. */
export function formatTime(value: string) {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match || +match[1] > 23 || +match[2] > 59) return "Time unavailable";
  const hour = +match[1];
  return `${hour % 12 || 12}:${match[2]} ${hour < 12 ? "AM" : "PM"}`;
}

export function parseDisplayDate(value: string) {
  if (!value.trim()) return "";
  if (calendarDate(value)) return value;
  const match = /^([a-z]{3,9})\s+(\d{1,2}),?\s+(\d{4})$/i.exec(value.trim());
  if (!match) return null;
  const month = months.findIndex(name => [name.toLowerCase(), name.slice(0, 3).toLowerCase()].includes(match[1].toLowerCase()));
  if (month < 0) return null;
  const result = `${match[3]}-${String(month + 1).padStart(2, "0")}-${match[2].padStart(2, "0")}`;
  return calendarDate(result) ? result : null;
}

export function parseDisplayTime(value: string) {
  if (!value.trim()) return "";
  if (/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)) return value;
  const match = /^(\d{1,2}):(\d{2})\s*(am|pm)$/i.exec(value.trim());
  if (!match || +match[1] < 1 || +match[1] > 12 || +match[2] > 59) return null;
  return `${String(+match[1] % 12 + (match[3].toLowerCase() === "pm" ? 12 : 0)).padStart(2, "0")}:${match[2]}`;
}
