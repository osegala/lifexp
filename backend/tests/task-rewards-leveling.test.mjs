import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
    levelInfo,
    xpRequiredForNextLevel
} from "../layers/api-shared/nodejs/leveling.mjs";
import {
    TASK_REWARDS,
    resolveTaskReward
} from "../layers/api-shared/nodejs/task-rewards.mjs";
import {
    validateTaskCreate,
    validateTaskPatch
} from "../layers/api-shared/nodejs/task-input.mjs";

const source = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("task sizes have one canonical server reward mapping", () => {
    assert.deepEqual(TASK_REWARDS, {
        QUICK: { xp: 10, coins: 1 },
        SMALL: { xp: 20, coins: 2 },
        NORMAL: { xp: 35, coins: 4 },
        CHALLENGING: { xp: 50, coins: 6 },
        BIG: { xp: 75, coins: 10 }
    });
});

test("task input defaults to NORMAL and strictly validates taskSize", () => {
    assert.equal(validateTaskCreate({ title: "Default task" }).taskSize, "NORMAL");
    assert.equal(validateTaskCreate({ title: "Big task", taskSize: "big" }).taskSize, "BIG");
    assert.equal(validateTaskPatch({ taskSize: "small" }, { repeatType: "NONE", repeatDays: [] }).taskSize, "SMALL");
    assert.throws(
        () => validateTaskCreate({ title: "Invalid", taskSize: "HUGE" }),
        (error) => error.code === "INVALID_TASK_SIZE" && error.statusCode === 400
    );
});

test("client reward fields are rejected instead of overriding server rewards", () => {
    for (const field of ["xpReward", "coinReward"]) {
        assert.throws(
            () => validateTaskCreate({ title: "Cheat", taskSize: "QUICK", [field]: 999 }),
            (error) => error.code === "VALIDATION_ERROR" && error.statusCode === 400
        );
        assert.throws(
            () => validateTaskPatch({ taskSize: "BIG", [field]: 999 }, { repeatType: "NONE", repeatDays: [] }),
            (error) => error.code === "VALIDATION_ERROR" && error.statusCode === 400
        );
    }
});

test("legacy tasks infer canonical sizes from XP or default safely to NORMAL", () => {
    assert.deepEqual(resolveTaskReward({ xpReward: "10", coinReward: "1" }), {
        taskSize: "QUICK", xp: 10, coins: 1
    });
    assert.deepEqual(resolveTaskReward({ xpReward: "75" }), {
        taskSize: "BIG", xp: 75, coins: 10
    });
    assert.deepEqual(resolveTaskReward({}), {
        taskSize: "NORMAL", xp: 35, coins: 4
    });
    assert.deepEqual(resolveTaskReward({ taskSize: "INVALID", xpReward: "999" }), {
        taskSize: "NORMAL", xp: 35, coins: 4
    });
});

test("level requirements follow round(100 * level^1.35)", () => {
    assert.equal(xpRequiredForNextLevel(1), 100);
    assert.equal(xpRequiredForNextLevel(2), 255);
    assert.ok(Math.abs(xpRequiredForNextLevel(5) - 879) <= 1);
    assert.ok(Math.abs(xpRequiredForNextLevel(10) - 2239) <= 1);
    assert.ok(Math.abs(xpRequiredForNextLevel(20) - 5703) <= 5);
});

test("level progress resets, preserves overflow, and crosses multiple levels", () => {
    assert.deepEqual(levelInfo(90), {
        level: 1, xpIntoLevel: 90, xpForNextLevel: 100, xpToNextLevel: 10
    });
    assert.deepEqual(levelInfo(110), {
        level: 2, xpIntoLevel: 10, xpForNextLevel: 255, xpToNextLevel: 245
    });

    const throughLevelThree = [1, 2, 3]
        .map(xpRequiredForNextLevel)
        .reduce((sum, value) => sum + value, 0);
    const progression = levelInfo(throughLevelThree + 17);
    assert.equal(progression.level, 4);
    assert.equal(progression.xpIntoLevel, 17);
    assert.equal(progression.xpForNextLevel, xpRequiredForNextLevel(4));
    assert.equal(progression.xpToNextLevel, xpRequiredForNextLevel(4) - 17);
});

test("task handlers persist, recompute, return, and complete canonical task rewards", () => {
    const create = source("functions/create-task/index.mjs");
    const update = source("functions/update-task/index.mjs");
    const list = source("functions/get-tasks/index.mjs");
    const complete = source("functions/complete-task/index.mjs");

    assert.match(create, /taskSize: \{ S: input\.taskSize \}/);
    assert.match(create, /rewardForTaskSize\(input\.taskSize\)/);
    assert.match(update, /rewardForTaskSize\(patch\.taskSize\)/);
    assert.match(update, /#xpReward = :xpReward/);
    assert.match(list, /taskSize: reward\.taskSize/);
    assert.match(complete, /resolveTaskReward\(/);
    assert.match(complete, /taskSize: task\.taskSize/);
});
