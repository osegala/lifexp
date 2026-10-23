const legacyZones: Record<string, string> = {
  EST: "America/New_York", EDT: "America/New_York",
  CST: "America/Chicago", CDT: "America/Chicago",
  MST: "America/Denver", MDT: "America/Denver",
  PST: "America/Los_Angeles", PDT: "America/Los_Angeles",
};

/** Abbreviations are migration inputs only; persist regional IANA identifiers. */
export function normalizeTimeZone(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 100) return null;
  const input = value.trim();
  const zone = Object.hasOwn(legacyZones, input.toUpperCase()) ? legacyZones[input.toUpperCase()]
    : /^(?:UTC|GMT)$/i.test(input) ? "UTC" : input;
  if (zone !== "UTC" && !/^[A-Za-z_]+(?:\/[A-Za-z0-9_+\-]+)+$/.test(zone)) return null;
  // Keep valid IANA aliases stable across native and server ICU versions.
  try { new Intl.DateTimeFormat("en-US", { timeZone: zone }).format(); return zone; }
  catch { return null; }
}

// Construct a fresh formatter: the system zone can change while the app lives.
// This reads locale settings, never GPS or location permissions.
export function getDeviceTimeZone(): string | null {
  try { return normalizeTimeZone(new Intl.DateTimeFormat().resolvedOptions().timeZone); }
  catch { return null; }
}

export function timeZoneLabel(value: string, now = new Date()): string {
  const legacy = value.trim().toUpperCase();
  if (Object.hasOwn(legacyZones, legacy)) return `${legacy} · awaiting automatic update`;
  const zone = normalizeTimeZone(value);
  if (!zone) return "Time zone unavailable";
  if (zone === "UTC") return "Coordinated Universal Time (UTC)";
  const city = zone.split("/").at(-1)!.replace(/_/g, " ");
  try {
    const name = new Intl.DateTimeFormat(undefined, { timeZone: zone, hour: "numeric", timeZoneName: "long" })
      .formatToParts(now).find(part => part.type === "timeZoneName")?.value;
    return name ? `${city} · ${name}` : city;
  } catch { return city; }
}
