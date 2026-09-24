import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
    buildCompletionHistory,
    CompletionError,
    planCompletion
} from "../functions/complete-task/logic.mjs";
import { evaluateAchievementAwards } from "../layers/progression-shared/nodejs/achievements.mjs";
import { levelInfo } from "../layers/api-shared/nodejs/leveling.mjs";
import { resolveTaskReward } from "../layers/api-shared/nodejs/task-rewards.mjs";

const today = "2026-09-22";
const now = "2026-09-22T14:00:00.000Z";
const defaults = {
    xp: 10,
    coins: 1,
    dailyTarget: 3,
    weeklyTarget: 15,
    dailyWorldPoints: 25,
    weeklyWorldPoints: 100
};

const profile = {
    xp: 40,
    coins: 5,
    worldPoints: 0,
    tasksCompleted: 1
};

const emptyStats = {
    tasksCompleted: 0,
    goalRewarded: false,
    hasTasksCompleted: false
};

function plan(overrides = {}) {
    const task = {
        taskId: "task-1",
        taskSize: "QUICK",
        repeatType: "DAILY",
        repeatDays: [],
        active: true,
        completed: false,
        currentStreak: 0,
        bestStreak: 0,
        lastCompletedDate: null,
        xpReward: 10,
        coinReward: 1,
        ...overrides.task
    };
    return planCompletion({
        task,
        profile: { ...profile, ...overrides.profile },
        dailyStats: { ...emptyStats, ...overrides.dailyStats },
        weeklyStats: { ...emptyStats, ...overrides.weeklyStats },
        catalog: overrides.catalog ?? [],
        earnedAchievementIds: overrides.earnedAchievementIds ?? new Set(),
        completionExists: overrides.completionExists ?? false,
        today,
        now,
        defaults,
        baseReward: resolveTaskReward(task),
        progressionForXp: levelInfo,
        rewardBonuses: overrides.rewardBonuses
    });
}

test("NONE completion does not create recurring state or increment streaks", () => {
    const result = plan({
        task: {
            repeatType: "NONE",
            currentStreak: 3,
            bestStreak: 4,
            lastCompletedDate: null
        },
        catalog: [{
            achievementId: "STREAK_7",
            name: "One Week Strong",
            description: "Reach a 7-completion streak on a recurring task.",
            type: "STREAK_REACHED",
            requiredValue: 7,
            active: true,
            sortOrder: 30
        }]
    });

    assert.equal(result.createCompletionRecord, false);
    assert.deepEqual(result.responseStreak, { current: 0, best: 0 });
    assert.equal(result.taskBestStreak, 4);
    assert.equal(result.taskChanges.completed, true);
    assert.equal(result.taskChanges.completedAt, now);
    assert.equal("lastCompletedDate" in result.taskChanges, false);
    assert.equal("lastCompletedAt" in result.taskChanges, false);
    assert.equal(result.newAchievements.length, 0);
});

test("DAILY completion increments a current streak or resets it after a miss", () => {
    const incremented = plan({
        task: {
            lastCompletedDate: "2026-09-21",
            currentStreak: 2,
            bestStreak: 2
        }
    });
    const reset = plan({
        task: {
            lastCompletedDate: "2026-09-20",
            currentStreak: 6,
            bestStreak: 6
        }
    });

    assert.equal(incremented.currentStreak, 3);
    assert.equal(incremented.taskBestStreak, 3);
    assert.equal(incremented.taskChanges.lastCompletedDate, today);
    assert.equal(reset.currentStreak, 1);
    assert.equal(reset.taskBestStreak, 6);
});

test("QUICK and BIG completions use canonical rewards, not stored reward fields", () => {
    const quick = plan({ task: { taskSize: "QUICK", xpReward: 999, coinReward: 999 } });
    const big = plan({ task: { taskSize: "BIG", xpReward: 1, coinReward: 1 } });

    assert.deepEqual(quick.rewardBreakdown.base, { xp: 10, coins: 1 });
    assert.deepEqual(big.rewardBreakdown.base, { xp: 75, coins: 10 });
    assert.equal(quick.player.xp, profile.xp + 10);
    assert.equal(big.player.xp, profile.xp + 75);
    assert.equal(big.player.coins, profile.coins + 10);
});

test("completion preserves lifetime XP while resetting the per-level bar with overflow", () => {
    const result = plan({
        task: { taskSize: "SMALL" },
        profile: { xp: 90 }
    });

    assert.equal(result.player.xp, 110);
    assert.equal(result.progression.totalXp, 110);
    assert.equal(result.progression.level, 2);
    assert.equal(result.progression.xpIntoLevel, 10);
    assert.equal(result.progression.xpForNextLevel, 255);
    assert.equal(result.progression.xpToNextLevel, 245);
    assert.equal(result.progression.leveledUp, true);
});

test("earned catalog achievements are skipped and real catalog IDs are returned", () => {
    const catalog = [
        {
            achievementId: "FIRST_TASK",
            name: "First Steps",
            description: "Complete your first task.",
            type: "TASKS_COMPLETED",
            requiredValue: 1,
            active: true,
            sortOrder: 1
        },
        {
            achievementId: "COMPLETE_10_TASKS",
            name: "Getting Things Done",
            description: "Complete 10 tasks.",
            type: "TASKS_COMPLETED",
            requiredValue: 10,
            active: true,
            sortOrder: 10
        }
    ];
    const completion = plan({ profile: { tasksCompleted: 9 } });
    const result = evaluateAchievementAwards({
        catalog,
        earnedAchievementIds: new Set(["FIRST_TASK"]),
        progress: completion.achievementProgress,
        now
    });

    assert.deepEqual(
        result.map(({ achievementId, name }) => ({ achievementId, name })),
        [{ achievementId: "COMPLETE_10_TASKS", name: "Getting Things Done" }]
    );
    assert.equal(result.some(({ achievementId }) => achievementId === "first-quest"), false);
});

test("building bonuses award floored totals without changing catalog base rewards", () => {
    const task = { taskSize: "BIG", xpReward: 100, coinReward: 20 };
    const result = plan({
        task,
        rewardBonuses: { xp: 5, coins: 2 }
    });

    assert.deepEqual(result.rewardBreakdown, {
        base: { xp: 75, coins: 10 },
        bonuses: { xp: 5, coins: 2 },
        total: { xp: 80, coins: 12 }
    });
    assert.equal(result.player.xp, profile.xp + 80);
    assert.equal(result.player.coins, profile.coins + 12);
    assert.equal(task.xpReward, 100);
    assert.equal(task.coinReward, 20);
    assert.equal(buildCompletionHistory({
        completionId: "bonus-completion",
        task: { taskId: "task-1", title: "Bonus", repeatType: "DAILY", repeatDays: [] },
        plan: result,
        now,
        today,
        timeZone: "UTC"
    }).xpEarned, 80);
});

test("daily and weekly stats receive actual base-plus-bonus rewards", () => {
    const source = readFileSync(new URL("../functions/complete-task/index.mjs", import.meta.url), "utf8");
    assert.match(source, /statsUpdate\(userPk, "DAY", today, dailyStats, plan\.daily, plan\.xp, plan\.coins, now\)/);
    assert.match(source, /statsUpdate\(userPk, "WEEK", weekId, weeklyStats, plan\.weekly, plan\.xp, plan\.coins, now\)/);
});

test("duplicate completion cannot award XP, coins, or world points twice", () => {
    const first = plan({
        dailyStats: { tasksCompleted: 2, goalRewarded: false, hasTasksCompleted: true }
    });
    const histories = [buildCompletionHistory({
        completionId: "completion-1",
        task: {
            taskId: "task-1",
            title: "Daily task",
            description: null,
            repeatType: "DAILY",
            repeatDays: []
        },
        plan: first,
        now,
        today,
        timeZone: "America/New_York"
    })];
    const totalsAfterFirst = {
        xp: profile.xp + first.xp,
        coins: profile.coins + first.coins,
        worldPoints: profile.worldPoints + first.worldPoints
    };

    assert.throws(
        () => plan({ completionExists: true }),
        (error) => error instanceof CompletionError && error.statusCode === 409
    );
    assert.deepEqual(totalsAfterFirst, { xp: 50, coins: 6, worldPoints: 25 });
    assert.equal(histories.length, 1);
});

test("daily goal reward is not awarded after goalRewarded is true", () => {
    const thresholdCompletion = plan({
        dailyStats: { tasksCompleted: 2, goalRewarded: false, hasTasksCompleted: true }
    });
    const laterCompletion = plan({
        task: { taskId: "task-2" },
        profile: thresholdCompletion.player,
        dailyStats: { tasksCompleted: 3, goalRewarded: true, hasTasksCompleted: true }
    });

    assert.equal(thresholdCompletion.daily.awarded, true);
    assert.equal(thresholdCompletion.daily.worldPoints, 25);
    assert.equal(laterCompletion.daily.awarded, false);
    assert.equal(laterCompletion.daily.worldPoints, 0);
});

test("archived tasks cannot be completed", () => {
    assert.throws(
        () => plan({ task: { archived: true } }),
        (error) => error instanceof CompletionError &&
            error.statusCode === 409 &&
            error.code === "TASK_ARCHIVED" &&
            error.message === "Archived tasks cannot be completed."
    );
});

test("one-time and recurring completions create immutable history snapshots", () => {
    const oneTimeTask = {
        taskId: "one-time",
        title: "Original title",
        description: "Original description",
        repeatType: "NONE",
        repeatDays: []
    };
    const oneTimePlan = plan({ task: oneTimeTask });
    const oneTime = buildCompletionHistory({
        completionId: "completion-1",
        task: { ...oneTimeTask },
        plan: oneTimePlan,
        now,
        today,
        timeZone: "America/New_York"
    });
    oneTimeTask.title = "Renamed later";

    assert.equal(oneTime.taskTitle, "Original title");
    assert.equal(oneTime.currentStreak, 0);
    assert.equal(oneTime.bestStreak, 0);

    const recurringTask = {
        taskId: "daily",
        title: "Daily task",
        description: null,
        repeatType: "DAILY",
        repeatDays: []
    };
    const recurringPlan = plan({
        task: { ...recurringTask, lastCompletedDate: "2026-09-21", currentStreak: 2, bestStreak: 2 }
    });
    const recurring = buildCompletionHistory({
        completionId: "completion-2",
        task: recurringTask,
        plan: recurringPlan,
        now,
        today,
        timeZone: "America/New_York"
    });

    assert.equal(recurring.currentStreak, 3);
    assert.equal(recurring.bestStreak, 3);
    assert.equal(recurring.xpEarned, recurringPlan.xp);
    assert.equal(recurring.worldPointsEarned, recurringPlan.worldPoints);
});
