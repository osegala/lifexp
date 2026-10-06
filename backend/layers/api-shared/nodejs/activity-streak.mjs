// Stats are already bucketed by the profile's local calendar date at completion.
// UTC below is only an ordinal for those labels, never the completion's UTC day.
// Timezone changes do not rewrite historical buckets (the same rule as quests).
export function activityStreak(items, today, completeToday = false) {
    const ordinal = (date) => Date.parse(`${date}T00:00:00Z`) / 86400000;
    const todayDay = ordinal(today);
    const days = new Set(items
        .filter((item) => Number(item.tasksCompleted?.N ?? 0) > 0)
        .map((item) => ordinal(item.date?.S ?? item.SK?.S?.replace("STATS#DAY#", "")))
        .filter(Number.isFinite));
    if (completeToday) days.add(todayDay);

    let longestDays = 0, run = 0, previous;
    for (const day of [...days].sort((a, b) => a - b)) {
        run = day === previous + 1 ? run + 1 : 1;
        longestDays = Math.max(longestDays, run);
        previous = day;
    }
    const completedToday = days.has(todayDay);
    let currentDays = 0;
    for (let day = completedToday ? todayDay : todayDay - 1; days.has(day); day--) currentDays++;
    return { currentDays, longestDays, completedToday };
}
