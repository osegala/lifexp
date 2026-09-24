export const TASK_REWARDS = Object.freeze({
    QUICK: Object.freeze({ xp: 10, coins: 1 }),
    SMALL: Object.freeze({ xp: 20, coins: 2 }),
    NORMAL: Object.freeze({ xp: 35, coins: 4 }),
    CHALLENGING: Object.freeze({ xp: 50, coins: 6 }),
    BIG: Object.freeze({ xp: 75, coins: 10 })
});

export const TASK_SIZES = Object.freeze(Object.keys(TASK_REWARDS));

export function isTaskSize(value) {
    return typeof value === "string" && Object.hasOwn(TASK_REWARDS, value);
}

export function rewardForTaskSize(taskSize) {
    const reward = TASK_REWARDS[taskSize];
    return reward ? { taskSize, ...reward } : null;
}

export function resolveTaskReward(task = {}) {
    if (isTaskSize(task.taskSize)) return rewardForTaskSize(task.taskSize);

    const legacyXp = Number(task.xpReward);
    const inferred = TASK_SIZES.find((taskSize) => TASK_REWARDS[taskSize].xp === legacyXp);
    return rewardForTaskSize(inferred ?? "NORMAL");
}
