import { completedOn, isRecurring, previousScheduledDate, scheduledOn } from "./task-schedule.mjs";
export { localDate, addDays, weekday, weekBounds, isoWeekId } from "./dates.mjs";

export class CompletionError extends Error {
    constructor(statusCode, code, message) {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
    }
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
    baseReward,
    progressionForXp,
    rewardBonuses = {}
}) {
    const recurring = isRecurring(task);

    if (task.archived) {
        throw new CompletionError(409, "TASK_ARCHIVED", "Archived tasks cannot be completed.");
    }
    if (completionExists || completedOn(task, today, profile.timeZone ?? "UTC")) {
        throw new CompletionError(409, "TASK_ALREADY_COMPLETED", "Task has already been completed today.");
    }
    if (!recurring && task.completed) {
        throw new CompletionError(409, "TASK_ALREADY_COMPLETED", "Task has already been completed.");
    }
    if (!scheduledOn(task, today)) {
        throw new CompletionError(400, "TASK_NOT_DUE", "Task is not due today.");
    }

    const baseXp = Math.max(0, Number(baseReward.xp) || 0);
    const baseCoins = Math.max(0, Number(baseReward.coins) || 0);
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
    const previousProgression = progressionForXp(profile.xp);
    const previousLevel = previousProgression.level;
    const progression = progressionForXp(profile.xp + xp);
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
            previous: { ...previousProgression, totalXp: profile.xp },
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
