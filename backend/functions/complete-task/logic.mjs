const WEEKDAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

export class CompletionError extends Error {
    constructor(statusCode, code, message) {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
    }
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

export function addDays(date, days) {
    const value = new Date(`${date}T00:00:00Z`);
    value.setUTCDate(value.getUTCDate() + days);
    return value.toISOString().slice(0, 10);
}

export function weekday(date) {
    return WEEKDAYS[new Date(`${date}T00:00:00Z`).getUTCDay()];
}

export function weekBounds(date) {
    const day = new Date(`${date}T00:00:00Z`).getUTCDay();
    const start = addDays(date, day === 0 ? -6 : 1 - day);
    return { start, end: addDays(start, 6) };
}

export function isoWeekId(date) {
    const value = new Date(`${date}T00:00:00Z`);
    value.setUTCDate(value.getUTCDate() + 4 - (value.getUTCDay() || 7));
    const year = value.getUTCFullYear();
    const yearStart = new Date(Date.UTC(year, 0, 1));
    const week = Math.ceil((((value - yearStart) / 86400000) + 1) / 7);
    return `${year}-W${String(week).padStart(2, "0")}`;
}

function previousScheduledDate(task, date) {
    for (let offset = 1; offset <= 7; offset++) {
        const candidate = addDays(date, -offset);
        if (task.repeatType === "DAILY" || task.repeatDays.includes(weekday(candidate))) {
            return candidate;
        }
    }
    return null;
}

function isScheduledOn(task, date) {
    if (!task.active) {
        return false;
    }

    if (task.repeatType === "DAILY") {
        return true;
    }
    if (task.repeatType === "WEEKLY") {
        return task.repeatDays.includes(weekday(date));
    }
    return !task.completed;
}

export function levelInfo(totalXp) {
    let level = 1;
    let xpIntoLevel = totalXp;

    while (xpIntoLevel >= 100 + ((level - 1) * 50)) {
        xpIntoLevel -= 100 + ((level - 1) * 50);
        level++;
    }

    const xpForNextLevel = 100 + ((level - 1) * 50);
    return {
        level,
        xpIntoLevel,
        xpForNextLevel,
        xpToNextLevel: xpForNextLevel - xpIntoLevel
    };
}

function goalProgress(stats, target, reward) {
    const tasksCompleted = stats.tasksCompleted + 1;
    const awarded = !stats.goalRewarded && tasksCompleted >= target;
    return {
        tasksCompleted,
        target,
        awarded,
        goalRewarded: stats.goalRewarded || awarded,
        worldPoints: awarded ? reward : 0
    };
}

export function planCompletion({
    task,
    profile,
    dailyStats,
    weeklyStats,
    completionExists = false,
    today,
    now,
    defaults,
    rewardBonuses = {}
}) {
    const recurring = task.repeatType === "DAILY" || task.repeatType === "WEEKLY";

    if (task.archived) {
        throw new CompletionError(409, "TASK_ARCHIVED", "Archived tasks cannot be completed.");
    }
    if (recurring && (completionExists || task.lastCompletedDate === today)) {
        throw new CompletionError(409, "TASK_ALREADY_COMPLETED", "Task has already been completed today.");
    }
    if (!recurring && task.completed) {
        throw new CompletionError(409, "TASK_ALREADY_COMPLETED", "Task has already been completed.");
    }
    if (!isScheduledOn(task, today)) {
        throw new CompletionError(400, "TASK_NOT_DUE", "Task is not due today.");
    }

    const baseXp = Math.max(0, task.xpReward ?? defaults.xp);
    const baseCoins = Math.max(0, task.coinReward ?? defaults.coins);
    const bonusXp = Math.max(0, rewardBonuses.xp ?? 0);
    const bonusCoins = Math.max(0, rewardBonuses.coins ?? 0);
    const xp = baseXp + bonusXp;
    const coins = baseCoins + bonusCoins;
    const daily = goalProgress(
        dailyStats,
        defaults.dailyTarget,
        defaults.dailyWorldPoints + Math.max(0, rewardBonuses.dailyWorldPoints ?? 0)
    );
    const weekly = goalProgress(
        weeklyStats,
        defaults.weeklyTarget,
        defaults.weeklyWorldPoints + Math.max(0, rewardBonuses.weeklyWorldPoints ?? 0)
    );
    const worldPoints = daily.worldPoints + weekly.worldPoints;
    const previousLevel = levelInfo(profile.xp).level;
    const progression = levelInfo(profile.xp + xp);
    const tasksCompleted = profile.tasksCompleted + 1;
    const playerCoins = profile.coins + coins;
    const playerWorldPoints = profile.worldPoints + worldPoints;
    const currentStreak = recurring
        ? task.lastCompletedDate === previousScheduledDate(task, today)
            ? task.currentStreak + 1
            : 1
        : 0;
    const taskBestStreak = recurring
        ? Math.max(task.bestStreak, currentStreak)
        : task.bestStreak;
    return {
        recurring,
        createCompletionRecord: recurring,
        taskChanges: recurring
            ? {
                lastCompletedDate: today,
                lastCompletedAt: now,
                currentStreak,
                bestStreak: taskBestStreak,
                updatedAt: now
            }
            : {
                completed: true,
                completedAt: now,
                updatedAt: now
            },
        xp,
        coins,
        rewardBreakdown: {
            base: { xp: baseXp, coins: baseCoins },
            bonuses: { xp: bonusXp, coins: bonusCoins },
            total: { xp, coins }
        },
        worldPoints,
        daily,
        weekly,
        currentStreak,
        taskBestStreak,
        responseStreak: {
            current: recurring ? currentStreak : 0,
            best: recurring ? taskBestStreak : 0
        },
        progression: {
            previousLevel,
            ...progression,
            totalXp: profile.xp + xp,
            leveledUp: progression.level > previousLevel
        },
        player: {
            xp: profile.xp + xp,
            coins: playerCoins,
            worldPoints: playerWorldPoints,
            tasksCompleted,
            level: progression.level
        },
        achievementProgress: {
            tasksCompleted,
            level: progression.level,
            streak: recurring ? currentStreak : 0,
            coins: playerCoins,
            worldPoints: playerWorldPoints
        },
        newAchievements: []
    };
}

export function buildCompletionHistory({ completionId, task, plan, now, today, timeZone }) {
    return {
        completionId,
        taskId: task.taskId,
        taskTitle: task.title,
        taskDescription: task.description,
        repeatType: task.repeatType,
        repeatDays: [...task.repeatDays],
        completedAt: now,
        localDate: today,
        timeZone,
        xpEarned: plan.xp,
        coinsEarned: plan.coins,
        worldPointsEarned: plan.worldPoints,
        currentStreak: plan.responseStreak.current,
        bestStreak: plan.responseStreak.best
    };
}
