import test from "node:test";
import assert from "node:assert/strict";
import {
    buildGoal,
    isoWeekId
} from "../functions/get-goals/logic.mjs";
import { summarize } from "../functions/get-history/logic.mjs";
import {
    achievementSummary,
    buildAchievements
} from "../functions/get-achievements/logic.mjs";
import { buildWorld } from "../functions/get-world/logic.mjs";
import {
    planUpgrade,
    UpgradeError
} from "../functions/upgrade-building/logic.mjs";

test("goal progress uses ISO weeks and reports reward state", () => {
    assert.equal(isoWeekId("2026-09-17"), "2026-W38");
    assert.deepEqual(buildGoal(2, 3, 25, false, null), {
        current: 2,
        target: 3,
        remaining: 1,
        progressPercent: 66,
        completed: false,
        reward: { worldPoints: 25, granted: false, grantedAt: null }
    });
});

test("history summary includes active-day averages and the best day", () => {
    const days = [
        { date: "2026-09-22", tasksCompleted: 3, xpEarned: 30, coinsEarned: 3 },
        { date: "2026-09-20", tasksCompleted: 1, xpEarned: 10, coinsEarned: 1 },
        { date: "2026-09-10", tasksCompleted: 0, xpEarned: 0, coinsEarned: 0 }
    ];
    const summary = summarize(days, "2026-09-22");

    assert.equal(summary.totalCompletions, 4);
    assert.equal(summary.last7Days, 4);
    assert.equal(summary.totalXpEarned, 40);
    assert.equal(summary.totalCoinsEarned, 4);
    assert.equal(summary.activeDays, 2);
    assert.equal(summary.averagePerActiveDay, 2);
    assert.equal(summary.bestDay.date, "2026-09-22");
});

test("achievement results use catalog IDs and report summary by type", () => {
    const catalog = [
        {
            achievementId: "FIRST_TASK",
            name: "First Steps",
            description: "Complete your first task.",
            type: "TASKS_COMPLETED",
            requiredValue: 1,
            active: true,
            sortOrder: 1,
            currentValue: 2
        },
        {
            achievementId: "STREAK_7",
            name: "One Week Strong",
            description: "Reach a streak of 7.",
            type: "STREAK_REACHED",
            requiredValue: 7,
            active: true,
            sortOrder: 2,
            currentValue: 3
        }
    ];
    const earned = new Map([["FIRST_TASK", {
        earnedAt: "2026-09-17T20:45:05.816Z",
        progressValue: 1
    }]]);
    const achievements = buildAchievements(catalog, earned);

    assert.deepEqual(achievements.map(({ achievementId }) => achievementId), ["FIRST_TASK", "STREAK_7"]);
    assert.equal(achievements[0].earned, true);
    assert.equal(achievements[1].currentValue, 3);
    assert.deepEqual(achievementSummary(achievements), {
        earned: 1,
        locked: 1,
        total: 2,
        completionPercent: 50,
        byType: {
            TASKS_COMPLETED: { earned: 1, total: 1 },
            STREAK_REACHED: { earned: 0, total: 1 }
        }
    });
});

test("world defaults missing player buildings to level one", () => {
    const buildings = buildWorld([{
        buildingId: "library",
        name: "Library",
        maxLevel: 5,
        upgradeCosts: [100, 250, 500, 1000],
        active: true,
        sortOrder: 3
    }], new Map(), 120);

    assert.equal(buildings[0].currentLevel, 1);
    assert.equal(buildings[0].upgradeCost, 100);
    assert.equal(buildings[0].canAfford, true);
    assert.equal(buildings[0].canUpgrade, true);
});

test("building upgrades use catalog costs and stop at max level", () => {
    const catalog = {
        active: true,
        maxLevel: 5,
        upgradeCosts: [100, 250, 500, 1000]
    };
    const upgrade = planUpgrade(catalog, { level: 2 }, 300);

    assert.deepEqual(upgrade, {
        currentLevel: 2,
        newLevel: 3,
        maxLevel: 5,
        upgradeCost: 250,
        remainingWorldPoints: 50
    });
    assert.throws(
        () => planUpgrade(catalog, { level: 5 }, 5000),
        (error) => error instanceof UpgradeError && error.statusCode === 409
    );
});
