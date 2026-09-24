export function shiftDate(date, days) {
    const value = new Date(`${date}T00:00:00Z`);
    value.setUTCDate(value.getUTCDate() + days);
    return value.toISOString().slice(0, 10);
}

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

export function summarize(days, today) {
    const totalCompletions = days.reduce((total, day) => total + day.tasksCompleted, 0);
    const activeDays = days.filter((day) => day.tasksCompleted > 0).length;
    const last7DaysStart = shiftDate(today, -6);
    const last7Days = days
        .filter((day) => day.date >= last7DaysStart)
        .reduce((total, day) => total + day.tasksCompleted, 0);
    const bestDay = days.reduce(
        (best, day) => !best || day.tasksCompleted > best.tasksCompleted ? day : best,
        null
    );

    return {
        totalCompletions,
        last7Days,
        totalXpEarned: days.reduce((total, day) => total + day.xpEarned, 0),
        totalCoinsEarned: days.reduce((total, day) => total + day.coinsEarned, 0),
        activeDays,
        averagePerActiveDay: activeDays > 0
            ? Number((totalCompletions / activeDays).toFixed(2))
            : 0,
        bestDay
    };
}
