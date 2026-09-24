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

export function buildGoal(current, target, rewardAmount, goalRewarded, goalRewardedAt) {
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
            grantedAt: goalRewardedAt
        }
    };
}
