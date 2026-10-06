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

export function isoWeekId(date) {
    const value = new Date(`${date}T00:00:00Z`);
    value.setUTCDate(value.getUTCDate() + 4 - (value.getUTCDay() || 7));
    const year = value.getUTCFullYear();
    const yearStart = new Date(Date.UTC(year, 0, 1));
    const week = Math.ceil((((value - yearStart) / 86400000) + 1) / 7);
    return `${year}-W${String(week).padStart(2, "0")}`;
}

// Server-computed delay avoids trusting the device's clock/timezone. Search using
// the existing localDate utility, so short/long DST days are not assumed to be 24h.
export function millisecondsUntilNextDay(now, timeZone) {
    const date = localDate(now, timeZone);
    let low = 0, high = 48 * 60 * 60 * 1000;
    while (high - low > 1) {
        const middle = Math.floor((low + high) / 2);
        if (localDate(new Date(now.getTime() + middle), timeZone) === date) low = middle;
        else high = middle;
    }
    return high;
}

export function buildGoal(current, target, rewardAmount, goalRewarded, goalRewardedAt, earnedWorldPoints) {
    return {
        current,
        target,
        remaining: Math.max(0, target - current),
        progressPercent: target > 0
            ? Math.min(100, Math.floor((current / target) * 100))
            : 0,
        completed: current >= target,
        reward: {
            worldPoints: rewardAmount,
            granted: goalRewarded,
            grantedAt: goalRewardedAt,
            ...(earnedWorldPoints == null ? {} : { earnedWorldPoints })
        }
    };
}
