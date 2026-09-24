import test from "node:test";
import assert from "node:assert/strict";
import {
    displayNameFrom,
    isDuplicateProfileError,
    profilePutRequest
} from "../functions/create-profile/logic.mjs";
import { levelInfo, xpRequiredForNextLevel } from "../shared/leveling.mjs";
import { isoWeekId, isValidTimeZone, localDate, weekday } from "../shared/dates.mjs";
import { attributeValue, loadSeedItems } from "../seeds/seed-catalogs.mjs";

const confirmedUser = {
    request: {
        userAttributes: {
            sub: "user-123",
            preferred_username: "Nova"
        }
    }
};

test("CreateProfile builds the expected profile for a confirmed user", () => {
    const request = profilePutRequest("Evrenthia-Dev", confirmedUser, "2026-09-23T12:00:00.000Z");
    assert.equal(request.TableName, "Evrenthia-Dev");
    assert.deepEqual(request.Item.PK, { S: "USER#user-123" });
    assert.deepEqual(request.Item.SK, { S: "PROFILE" });
    assert.deepEqual(request.Item.displayName, { S: "Nova" });
    assert.deepEqual(request.Item.createdAt, { S: "2026-09-23T12:00:00.000Z" });
    assert.deepEqual(request.Item.updatedAt, { S: "2026-09-23T12:00:00.000Z" });
});

test("CreateProfile defaults a missing display name to Adventurer", () => {
    assert.equal(displayNameFrom({ email: "private@example.com" }), "Adventurer");
    const request = profilePutRequest("Evrenthia-Dev", {
        request: { userAttributes: { sub: "user-456" } }
    }, "2026-09-23T12:00:00.000Z");
    assert.deepEqual(request.Item.displayName, { S: "Adventurer" });
});

test("CreateProfile uses a conditional put and treats only duplicate profiles as safe", () => {
    const request = profilePutRequest("Evrenthia-Dev", confirmedUser);
    assert.equal(request.ConditionExpression, "attribute_not_exists(PK) AND attribute_not_exists(SK)");
    assert.equal(isDuplicateProfileError({ name: "ConditionalCheckFailedException" }), true);
    assert.equal(isDuplicateProfileError({ name: "AccessDeniedException" }), false);
});

test("CreateProfile initializes every progression field to zero and timezone to UTC", () => {
    const item = profilePutRequest("Evrenthia-Dev", confirmedUser).Item;
    assert.deepEqual({
        xp: item.xp,
        coins: item.coins,
        worldPoints: item.worldPoints,
        tasksCompleted: item.tasksCompleted,
        timeZone: item.timeZone
    }, {
        xp: { N: "0" },
        coins: { N: "0" },
        worldPoints: { N: "0" },
        tasksCompleted: { N: "0" },
        timeZone: { S: "UTC" }
    });
});

test("shared leveling and date utilities preserve the existing contracts", () => {
    assert.deepEqual(levelInfo(100), {
        level: 2,
        xpIntoLevel: 0,
        xpForNextLevel: 255,
        xpToNextLevel: 255
    });
    assert.equal(xpRequiredForNextLevel(1), 100);
    assert.equal(xpRequiredForNextLevel(2), 255);
    assert.equal(localDate(new Date("2026-09-23T02:00:00.000Z"), "America/New_York"), "2026-09-22");
    assert.equal(weekday("2026-09-23"), "WED");
    assert.equal(isoWeekId("2026-09-23"), "2026-W39");
    assert.equal(isValidTimeZone("America/New_York"), true);
    assert.equal(isValidTimeZone("Moon/Tranquility"), false);
});

test("catalog seeds contain the required stable logical keys", () => {
    const items = loadSeedItems();
    const keys = new Set(items.map((item) => `${item.PK}|${item.SK}`));
    for (const key of [
        "CATALOG#COSMETICS|ITEM#starter_tunic",
        "CATALOG#COSMETICS|ITEM#forest_tunic",
        "CATALOG#ACHIEVEMENTS|ACHIEVEMENT#FIRST_TASK",
        "CATALOG#ACHIEVEMENTS|ACHIEVEMENT#STREAK_100",
        "CATALOG#BUILDINGS|BUILDING#home_base",
        "CATALOG#BUILDINGS|BUILDING#hall_of_achievements"
    ]) {
        assert.equal(keys.has(key), true, key);
    }

    const cosmetics = new Map(items
        .filter((item) => item.PK === "CATALOG#COSMETICS")
        .map((item) => [item.itemId, item]));
    assert.deepEqual(cosmetics.get("starter_tunic"), {
        PK: "CATALOG#COSMETICS",
        SK: "ITEM#starter_tunic",
        itemId: "starter_tunic",
        name: "Starter Tunic",
        category: "tunic",
        price: 25,
        requiredLevel: 1,
        requiredAchievement: null,
        assetKey: "starter-tunic.png",
        sortOrder: 1,
        active: true
    });
    assert.deepEqual(cosmetics.get("forest_tunic"), {
        PK: "CATALOG#COSMETICS",
        SK: "ITEM#forest_tunic",
        itemId: "forest_tunic",
        name: "Forest Tunic",
        category: "tunic",
        price: 250,
        requiredLevel: 5,
        requiredAchievement: null,
        assetKey: "forest-tunic.png",
        sortOrder: 10,
        active: true
    });
    assert.equal(cosmetics.size, 14);
    assert.equal(items.filter((item) => item.PK === "CATALOG#ACHIEVEMENTS").length, 15);
    assert.equal(items.filter((item) => item.PK === "CATALOG#BUILDINGS").length, 6);
    assert.equal(items.length, 35);
    assert.equal(JSON.stringify(items).includes("dragon-helm.png"), false);
    assert.equal(JSON.stringify(items).includes("dragon_helm"), false);
    assert.equal(JSON.stringify(items).includes("Dragon Helm"), false);
    assert.equal(items.some((item) => item.itemId?.startsWith("sam_test_")), false);
    assert.deepEqual(attributeValue(null), { NULL: true });
    assert.deepEqual(attributeValue({ type: "TASK_XP_BONUS_PERCENT", value: 5 }), {
        M: { type: { S: "TASK_XP_BONUS_PERCENT" }, value: { N: "5" } }
    });

    const achievements = new Map(items
        .filter((item) => item.PK === "CATALOG#ACHIEVEMENTS")
        .map((item) => [item.achievementId, item]));
    assert.deepEqual(
        [...achievements.values()].map(({ achievementId, name, description, type, requiredValue, sortOrder, active }) => ({
            achievementId, name, description, type, requiredValue, sortOrder, active
        })),
        [
            { achievementId: "FIRST_TASK", name: "First Steps", description: "Complete your first task.", type: "TASKS_COMPLETED", requiredValue: 1, sortOrder: 1, active: true },
            { achievementId: "COMPLETE_10_TASKS", name: "Getting Things Done", description: "Complete 10 tasks.", type: "TASKS_COMPLETED", requiredValue: 10, sortOrder: 10, active: true },
            { achievementId: "COMPLETE_25_TASKS", name: "Creature of Habit", description: "Complete 25 tasks.", type: "TASKS_COMPLETED", requiredValue: 25, sortOrder: 15, active: true },
            { achievementId: "COMPLETE_100_TASKS", name: "Task Master", description: "Complete 100 tasks.", type: "TASKS_COMPLETED", requiredValue: 100, sortOrder: 20, active: true },
            { achievementId: "REACH_LEVEL_5", name: "Rising Star", description: "Reach level 5.", type: "LEVEL_REACHED", requiredValue: 5, sortOrder: 25, active: true },
            { achievementId: "REACH_LEVEL_10", name: "Seasoned Adventurer", description: "Reach level 10.", type: "LEVEL_REACHED", requiredValue: 10, sortOrder: 26, active: true },
            { achievementId: "COMPLETE_DAILY_GOAL_7_DAYS", name: "On a Roll", description: "Complete the daily task goal on 7 distinct days.", type: "DAILY_GOALS_COMPLETED", requiredValue: 7, sortOrder: 27, active: true },
            { achievementId: "STREAK_7", name: "One Week Strong", description: "Reach a 7-completion streak on a recurring task.", type: "STREAK_REACHED", requiredValue: 7, sortOrder: 30, active: true },
            { achievementId: "STREAK_30", name: "Unstoppable", description: "Reach a 30-completion streak on a recurring task.", type: "STREAK_REACHED", requiredValue: 30, sortOrder: 40, active: true },
            { achievementId: "STREAK_100", name: "Legendary Consistency", description: "Reach a 100-completion streak on a recurring task.", type: "STREAK_REACHED", requiredValue: 100, sortOrder: 50, active: true },
            { achievementId: "WORLD_EXPLORER_I", name: "World Explorer I", description: "Own 100 World Points.", type: "WORLD_POINTS_OWNED", requiredValue: 100, sortOrder: 60, active: true },
            { achievementId: "WORKSHOP_LEVEL_3", name: "Master Craftsperson", description: "Upgrade the Workshop to level 3.", type: "BUILDING_LEVEL_REACHED", requiredValue: 3, sortOrder: 70, active: true },
            { achievementId: "BUILDER", name: "Builder", description: "Reach 10 total building levels.", type: "TOTAL_BUILDING_LEVELS", requiredValue: 10, sortOrder: 80, active: true },
            { achievementId: "COLLECTOR", name: "Collector", description: "Own 5 cosmetics.", type: "COSMETICS_OWNED", requiredValue: 5, sortOrder: 90, active: true },
            { achievementId: "ACHIEVEMENT_HUNTER", name: "Achievement Hunter", description: "Earn 5 achievements.", type: "ACHIEVEMENTS_EARNED", requiredValue: 5, sortOrder: 100, active: true }
        ]
    );

    const buildings = items.filter((item) => item.PK === "CATALOG#BUILDINGS");
    assert.deepEqual(
        buildings.map(({ buildingId, name, maxLevel, upgradeCosts, sortOrder, active }) => ({
            buildingId, name, maxLevel, upgradeCosts, sortOrder, active
        })),
        [
            { buildingId: "home_base", name: "Home Base", maxLevel: 5, upgradeCosts: [100, 250, 500, 1000], sortOrder: 1, active: true },
            { buildingId: "workshop", name: "Workshop", maxLevel: 5, upgradeCosts: [100, 250, 500, 1000], sortOrder: 2, active: true },
            { buildingId: "library", name: "Library", maxLevel: 5, upgradeCosts: [100, 250, 500, 1000], sortOrder: 3, active: true },
            { buildingId: "training_grounds", name: "Training Grounds", maxLevel: 5, upgradeCosts: [100, 250, 500, 1000], sortOrder: 4, active: true },
            { buildingId: "garden", name: "Garden", maxLevel: 5, upgradeCosts: [100, 250, 500, 1000], sortOrder: 5, active: true },
            { buildingId: "hall_of_achievements", name: "Hall of Achievements", maxLevel: 5, upgradeCosts: [100, 250, 500, 1000], sortOrder: 6, active: true }
        ]
    );
});
