import test from "node:test";
import assert from "node:assert/strict";
import {
    achievementProgress,
    evaluateAchievementAwards
} from "../layers/progression-shared/nodejs/achievements.mjs";
import {
    cosmeticOffer,
    percentageBonus,
    resolveBuildingEffects
} from "../layers/progression-shared/nodejs/building-effects.mjs";
import { loadSeedItems } from "../seeds/seed-catalogs.mjs";

const buildings = loadSeedItems().filter((item) => item.PK === "CATALOG#BUILDINGS");
const now = "2026-09-23T15:00:00.000Z";

test("level-one buildings resolve baseline effects", () => {
    const { effects, levels } = resolveBuildingEffects(buildings, new Map());

    assert.equal(levels.size, 6);
    assert.deepEqual(effects, {
        taskXpBonusPercent: 0,
        taskCoinBonusPercent: 0,
        dailyWorldPointsBonus: 0,
        weeklyWorldPointsBonus: 0,
        shopDiscountPercent: 0,
        cosmeticLevelRequirementReduction: 0,
        achievementDisplaySlots: 3,
        petSlots: 0,
        worldAreaUnlock: 1
    });
});

test("building effects change at their catalog-defined levels", () => {
    const levelThree = new Map(buildings.map(({ buildingId }) => [buildingId, { level: 3 }]));
    const { effects } = resolveBuildingEffects(buildings, levelThree);

    assert.equal(effects.worldAreaUnlock, 3);
    assert.equal(effects.shopDiscountPercent, 4);
    assert.equal(effects.cosmeticLevelRequirementReduction, 1);
    assert.equal(effects.taskXpBonusPercent, 5);
    assert.equal(effects.taskCoinBonusPercent, 5);
    assert.equal(effects.achievementDisplaySlots, 7);
});

test("unknown building effects are ignored safely", () => {
    const { effects, activeEffectsByBuilding } = resolveBuildingEffects([{
        buildingId: "future_building",
        maxLevel: 5,
        active: true,
        effectsByLevel: [{ level: 1, effects: [
            { type: "EXECUTE_SOMETHING", value: 999 },
            { type: "TASK_XP_BONUS_PERCENT", value: 2 }
        ] }]
    }], new Map());

    assert.equal(effects.taskXpBonusPercent, 2);
    assert.deepEqual(activeEffectsByBuilding.get("future_building"), [
        { type: "TASK_XP_BONUS_PERCENT", value: 2 }
    ]);
    assert.equal("executeSomething" in effects, false);
});

test("task percentage bonuses use deterministic floor rounding", () => {
    assert.equal(percentageBonus(10, 5), 0);
    assert.equal(percentageBonus(100, 5), 5);
    assert.equal(percentageBonus(25, 10), 2);
});

test("shop offers apply discounts and never reduce level requirements below one", () => {
    assert.deepEqual(cosmeticOffer({ price: 250, requiredLevel: 5 }, {
        shopDiscountPercent: 10,
        cosmeticLevelRequirementReduction: 1
    }), {
        effectivePrice: 225,
        discountPercent: 10,
        effectiveRequiredLevel: 4
    });
    assert.equal(cosmeticOffer({ price: 25, requiredLevel: 1 }, {
        cosmeticLevelRequirementReduction: 10
    }).effectiveRequiredLevel, 1);
});

test("expanded achievement types use generic progress and building targeting", () => {
    const catalog = [
        ["WORLD", "WORLD_POINTS_OWNED", 100],
        ["WORKSHOP", "BUILDING_LEVEL_REACHED", 3, "workshop"],
        ["GARDEN", "BUILDING_LEVEL_REACHED", 3, "garden"],
        ["BUILDER", "TOTAL_BUILDING_LEVELS", 10],
        ["COLLECTOR", "COSMETICS_OWNED", 5],
        ["HUNTER", "ACHIEVEMENTS_EARNED", 5]
    ].map(([achievementId, type, requiredValue, targetBuildingId], sortOrder) => ({
        achievementId,
        type,
        requiredValue,
        targetBuildingId,
        sortOrder,
        active: true
    }));
    const earned = new Set(["OLD_1", "OLD_2", "OLD_3", "OLD_4"]);
    const awards = evaluateAchievementAwards({
        catalog,
        earnedAchievementIds: earned,
        progress: {
            worldPoints: 100,
            buildingLevels: new Map([["workshop", 3], ["garden", 2]]),
            totalBuildingLevels: 10,
            cosmeticsOwned: 5
        },
        now
    });

    assert.deepEqual(awards.map(({ achievementId }) => achievementId), [
        "WORLD", "WORKSHOP", "BUILDER", "COLLECTOR", "HUNTER"
    ]);
    assert.equal(awards.some(({ achievementId }) => achievementId === "GARDEN"), false);
});

test("achievement chaining is finite, ignores unknown types, and never duplicates awards", () => {
    const chain = Array.from({ length: 20 }, (_, index) => ({
        achievementId: `CHAIN_${index}`,
        type: "ACHIEVEMENTS_EARNED",
        requiredValue: index,
        active: true,
        sortOrder: index
    }));
    const catalog = [
        ...chain,
        { ...chain[0] },
        { achievementId: "UNKNOWN", type: "ARBITRARY_CODE", requiredValue: 0, active: true },
        { achievementId: "INACTIVE", type: "TASKS_COMPLETED", requiredValue: 0, active: false }
    ];
    const awards = evaluateAchievementAwards({ catalog, progress: {}, now });

    assert.equal(awards.length, 20);
    assert.equal(new Set(awards.map(({ achievementId }) => achievementId)).size, 20);
    assert.equal(awards.some(({ achievementId }) => achievementId === "UNKNOWN"), false);
    assert.equal(awards.some(({ achievementId }) => achievementId === "INACTIVE"), false);
    assert.equal(achievementProgress(catalog.at(-2), {}), null);

    const repeated = evaluateAchievementAwards({
        catalog,
        earnedAchievementIds: new Set(awards.map(({ achievementId }) => achievementId)),
        progress: {},
        now
    });
    assert.deepEqual(repeated, []);
});
