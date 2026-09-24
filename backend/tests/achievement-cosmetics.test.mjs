import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { planEquip } from "../functions/equip-item/logic.mjs";
import { buildAchievements } from "../functions/get-achievements/logic.mjs";
import { buildShopItems } from "../functions/get-shop/logic.mjs";
import { planPurchase, PurchaseError } from "../functions/purchase-item/logic.mjs";
import {
    dailyGoalCompletionCount,
    evaluateAchievementAwards
} from "../layers/progression-shared/nodejs/achievements.mjs";
import { catalogBatches, loadSeedItems } from "../seeds/seed-catalogs.mjs";

const seed = loadSeedItems();
const cosmetics = seed.filter((item) => item.PK === "CATALOG#COSMETICS");
const achievements = seed.filter((item) => item.PK === "CATALOG#ACHIEVEMENTS");
const cosmeticsById = new Map(cosmetics.map((item) => [item.itemId, item]));
const achievementsById = new Map(achievements.map((item) => [item.achievementId, item]));
const requiredItems = (achievementId) => cosmetics.filter((item) => item.requiredAchievement === achievementId);
const shop = (items, earned = [], owned = [], coins = 10_000, level = 1) => buildShopItems(
    items,
    new Set(owned),
    new Set(earned),
    coins,
    level
);

test("catalog defines exactly the 12 intended achievement-gated cosmetics", () => {
    const expected = {
        forestbound_tunic: ["Forestbound Tunic", 150, "COMPLETE_25_TASKS", "tunic"],
        forestbound_dress: ["Forestbound Dress", 150, "COMPLETE_25_TASKS", "tunic"],
        forestbound_cap: ["Forestbound Cap", 150, "COMPLETE_25_TASKS", "hat"],
        starweaver_tunic: ["Starweaver Tunic", 300, "REACH_LEVEL_5", "tunic"],
        starweaver_dress: ["Starweaver Dress", 300, "REACH_LEVEL_5", "tunic"],
        starweaver_hat: ["Starweaver Hat", 300, "REACH_LEVEL_5", "hat"],
        dawnkeeper_tunic: ["Dawnkeeper Tunic", 500, "COMPLETE_100_TASKS", "tunic"],
        dawnkeeper_dress: ["Dawnkeeper Dress", 500, "COMPLETE_100_TASKS", "tunic"],
        dawnkeeper_headpiece: ["Dawnkeeper Headpiece", 500, "COMPLETE_100_TASKS", "hat"],
        mossling: ["Mossling", 200, "COMPLETE_10_TASKS", "pet"],
        emberfox: ["Emberfox", 400, "COMPLETE_DAILY_GOAL_7_DAYS", "pet"],
        moonwing: ["Moonwing", 600, "REACH_LEVEL_10", "pet"]
    };

    for (const [itemId, [name, price, requiredAchievement, category]] of Object.entries(expected)) {
        const item = cosmeticsById.get(itemId);
        assert.ok(item, itemId);
        assert.deepEqual(
            [item.name, item.price, item.requiredAchievement, item.category, item.assetKey, item.active],
            [name, price, requiredAchievement, category, null, true]
        );
    }
    assert.equal(new Set(cosmetics.map((item) => item.itemId)).size, cosmetics.length);
    assert.equal(cosmetics.some((item) => item.itemId === "dragon_helm"), false);
    assert.equal(cosmetics.some((item) => item.assetKey === "dragon-helm.png"), false);
    assert.ok(cosmeticsById.has("starter_tunic"));
    assert.ok(cosmeticsById.has("forest_tunic"));
});

test("every cosmetic achievement key resolves and matching existing task achievements are reused", () => {
    for (const item of cosmetics.filter((entry) => entry.requiredAchievement)) {
        assert.ok(achievementsById.has(item.requiredAchievement), `${item.itemId}: ${item.requiredAchievement}`);
    }
    assert.equal(achievementsById.get("COMPLETE_10_TASKS").name, "Getting Things Done");
    assert.equal(achievementsById.get("COMPLETE_100_TASKS").name, "Task Master");
    assert.equal(achievements.filter((item) => item.type === "TASKS_COMPLETED" && item.requiredValue === 10).length, 1);
    assert.equal(achievements.filter((item) => item.type === "TASKS_COMPLETED" && item.requiredValue === 100).length, 1);
});

test("Forestbound items unlock together but remain independently owned", () => {
    const items = requiredItems("COMPLETE_25_TASKS");
    assert.deepEqual(shop(items).map((item) => item.status), ["LOCKED", "LOCKED", "LOCKED"]);
    assert.deepEqual(shop(items, ["COMPLETE_25_TASKS"]).map((item) => item.status), [
        "PURCHASABLE", "PURCHASABLE", "PURCHASABLE"
    ]);
    const purchased = shop(items, ["COMPLETE_25_TASKS"], ["forestbound_tunic"]);
    assert.equal(purchased.find((item) => item.itemId === "forestbound_tunic").status, "OWNED");
    assert.equal(purchased.find((item) => item.itemId === "forestbound_dress").status, "PURCHASABLE");
    assert.equal(purchased.find((item) => item.itemId === "forestbound_cap").status, "PURCHASABLE");
});

test("Starweaver and Moonwing unlock only when their level achievements are earned", () => {
    for (const [achievementId, qualifyingLevel] of [["REACH_LEVEL_5", 5], ["REACH_LEVEL_10", 10]]) {
        const catalog = achievementsById.get(achievementId);
        assert.deepEqual(evaluateAchievementAwards({ catalog: [catalog], progress: { level: qualifyingLevel - 1 }, now: "now" }), []);
        const awards = evaluateAchievementAwards({ catalog: [catalog], progress: { level: qualifyingLevel }, now: "now" });
        assert.deepEqual(awards.map((item) => item.achievementId), [achievementId]);
        const gatedItems = requiredItems(achievementId);
        assert.ok(shop(gatedItems).every((item) => item.status === "LOCKED"));
        assert.ok(shop(gatedItems, [achievementId], [], 10_000, qualifyingLevel)
            .every((item) => item.status === "PURCHASABLE"));
    }
});

test("Dawnkeeper reuses COMPLETE_100_TASKS and unlocks all three items together", () => {
    const items = requiredItems("COMPLETE_100_TASKS");
    assert.deepEqual(items.map((item) => item.itemId), [
        "dawnkeeper_tunic", "dawnkeeper_dress", "dawnkeeper_headpiece"
    ]);
    assert.ok(shop(items).every((item) => item.status === "LOCKED"));
    assert.ok(shop(items, ["COMPLETE_100_TASKS"]).every((item) => item.status === "PURCHASABLE"));
});

test("Mossling uses the existing 10-task achievement", () => {
    const item = cosmeticsById.get("mossling");
    assert.equal(shop([item])[0].status, "LOCKED");
    assert.equal(shop([item], ["COMPLETE_10_TASKS"])[0].status, "PURCHASABLE");
});

test("dresses and pets use the existing server-controlled equipment slots", () => {
    assert.equal(planEquip(true, cosmeticsById.get("forestbound_dress")).slot, "tunic");
    assert.equal(planEquip(true, cosmeticsById.get("mossling")).slot, "pet");
});

test("daily goal progress counts distinct rewarded local dates idempotently", () => {
    const days = [
        { SK: { S: "STATS#DAY#2026-09-20" }, goalRewarded: { BOOL: true } },
        { date: { S: "2026-09-21" }, goalRewarded: { BOOL: true } },
        { date: "2026-09-21", goalRewarded: true },
        { date: "2026-09-22", goalRewarded: false }
    ];
    assert.equal(dailyGoalCompletionCount(days), 2);
    assert.equal(dailyGoalCompletionCount(days, "2026-09-21"), 2);
    assert.equal(dailyGoalCompletionCount(days, "2026-09-22"), 3);
});

test("Emberfox unlocks on the seventh distinct daily goal and not before", () => {
    const achievement = achievementsById.get("COMPLETE_DAILY_GOAL_7_DAYS");
    assert.deepEqual(evaluateAchievementAwards({ catalog: [achievement], progress: { dailyGoalsCompleted: 6 }, now: "now" }), []);
    const awards = evaluateAchievementAwards({ catalog: [achievement], progress: { dailyGoalsCompleted: 7 }, now: "now" });
    assert.deepEqual(awards.map((item) => item.achievementId), ["COMPLETE_DAILY_GOAL_7_DAYS"]);
    const item = cosmeticsById.get("emberfox");
    assert.equal(shop([item])[0].status, "LOCKED");
    assert.equal(shop([item], ["COMPLETE_DAILY_GOAL_7_DAYS"])[0].status, "PURCHASABLE");
});

test("CompleteTask feeds the newly awarded local date into daily-goal achievement evaluation", () => {
    const source = readFileSync(new URL("../functions/complete-task/index.mjs", import.meta.url), "utf8");
    assert.match(source, /dailyGoalCompletionCount\(\s*dailyStatsItems,\s*plan\.daily\.awarded \? today : null/);
    assert.match(source, /"DAILY_GOALS_COMPLETED"/);
    assert.match(source, /queryPrefix\(userPk, "STATS#DAY#"\)/);
});

test("purchase planning rechecks achievement, price, balance, and ownership", () => {
    const item = cosmeticsById.get("forestbound_tunic");
    assert.throws(
        () => planPurchase(item, { level: 10, coins: 10_000 }, { hasRequiredAchievement: false }),
        (error) => error instanceof PurchaseError && error.code === "ITEM_LOCKED"
    );
    assert.equal(planPurchase(item, { level: 10, coins: 150 }, { hasRequiredAchievement: true }).price, 150);
    assert.throws(
        () => planPurchase(item, { level: 10, coins: 149 }, { hasRequiredAchievement: true }),
        (error) => error instanceof PurchaseError && error.code === "INSUFFICIENT_COINS"
    );
    assert.throws(
        () => planPurchase(item, { level: 10, coins: 10_000 }, { owned: true, hasRequiredAchievement: true }),
        (error) => error instanceof PurchaseError && error.code === "ITEM_ALREADY_OWNED"
    );
});

test("achievement responses expose their cosmetic rewards", () => {
    const achievement = achievementsById.get("COMPLETE_25_TASKS");
    const rewards = requiredItems("COMPLETE_25_TASKS").map(({ itemId, name, category }) => ({ itemId, name, category }));
    const [result] = buildAchievements(
        [{ ...achievement, currentValue: 18 }],
        new Map(),
        new Map([[achievement.achievementId, rewards]])
    );
    assert.deepEqual(result.rewards, rewards);
    assert.equal(result.currentValue, 18);
});

test("expanded catalog is split into DynamoDB-safe repeatable write batches", () => {
    const batches = catalogBatches(seed);
    assert.deepEqual(batches.map((batch) => batch.length), [25, 10]);
    assert.ok(batches.every((batch) => batch.length <= 25));
    assert.equal(batches.flat().length, seed.length);
});
