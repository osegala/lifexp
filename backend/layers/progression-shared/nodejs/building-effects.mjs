const EFFECT_FIELDS = Object.freeze({
    TASK_XP_BONUS_PERCENT: "taskXpBonusPercent",
    TASK_COIN_BONUS_PERCENT: "taskCoinBonusPercent",
    DAILY_WORLD_POINTS_BONUS: "dailyWorldPointsBonus",
    WEEKLY_WORLD_POINTS_BONUS: "weeklyWorldPointsBonus",
    SHOP_DISCOUNT_PERCENT: "shopDiscountPercent",
    COSMETIC_LEVEL_REQUIREMENT_REDUCTION: "cosmeticLevelRequirementReduction",
    ACHIEVEMENT_DISPLAY_SLOTS: "achievementDisplaySlots",
    PET_SLOTS: "petSlots",
    WORLD_AREA_UNLOCK: "worldAreaUnlock"
});

export function emptyBuildingEffects() {
    return Object.fromEntries(Object.values(EFFECT_FIELDS).map((field) => [field, 0]));
}

function finiteNonNegative(value) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(0, number) : 0;
}

export function activeEffectsAtLevel(building, level) {
    const definition = (building.effectsByLevel ?? [])
        .find((entry) => Number(entry.level) === Number(level));

    return (definition?.effects ?? [])
        .filter((effect) => EFFECT_FIELDS[effect.type] && Number.isFinite(Number(effect.value)))
        .map((effect) => ({ type: effect.type, value: finiteNonNegative(effect.value) }));
}

export function resolveBuildingEffects(catalog, playerBuildings = new Map()) {
    const effects = emptyBuildingEffects();
    const activeEffectsByBuilding = new Map();
    const levels = new Map();

    for (const building of catalog.filter((entry) => entry.active !== false)) {
        const storedLevel = playerBuildings.get(building.buildingId)?.level ?? 1;
        const level = Math.min(building.maxLevel ?? 5, Math.max(1, Number(storedLevel) || 1));
        const activeEffects = activeEffectsAtLevel(building, level);
        levels.set(building.buildingId, level);
        activeEffectsByBuilding.set(building.buildingId, activeEffects);

        for (const effect of activeEffects) {
            const field = EFFECT_FIELDS[effect.type];
            if (effect.type === "WORLD_AREA_UNLOCK") {
                effects[field] = Math.max(effects[field], effect.value);
            } else {
                effects[field] += effect.value;
            }
        }
    }

    return { effects, activeEffectsByBuilding, levels };
}

export function percentageBonus(base, percent) {
    return Math.floor(finiteNonNegative(base) * Math.min(100, finiteNonNegative(percent)) / 100);
}

export function discountedPrice(price, discountPercent) {
    const base = finiteNonNegative(price);
    const discount = Math.min(100, finiteNonNegative(discountPercent));
    return Math.floor(base * (100 - discount) / 100);
}

export function effectiveLevelRequirement(requiredLevel, reduction) {
    return Math.max(1, finiteNonNegative(requiredLevel || 1) - finiteNonNegative(reduction));
}

export function cosmeticOffer(item, effects = {}) {
    const price = finiteNonNegative(item.price);
    const requiredLevel = finiteNonNegative(item.requiredLevel || 1);
    const discountPercent = Math.min(100, finiteNonNegative(effects.shopDiscountPercent));
    return {
        effectivePrice: discountedPrice(price, discountPercent),
        discountPercent,
        effectiveRequiredLevel: effectiveLevelRequirement(
            requiredLevel,
            effects.cosmeticLevelRequirementReduction
        )
    };
}

function numberFrom(attribute, fallback = 0) {
    const number = Number(attribute?.N ?? fallback);
    return Number.isFinite(number) ? number : fallback;
}

function effectFrom(attribute) {
    return {
        type: attribute?.M?.type?.S ?? "",
        value: numberFrom(attribute?.M?.value)
    };
}

export function buildingCatalogFromItem(item) {
    return {
        buildingId: item.buildingId?.S ?? item.SK?.S?.slice("BUILDING#".length) ?? "",
        name: item.name?.S ?? "",
        maxLevel: numberFrom(item.maxLevel, 5),
        upgradeCosts: (item.upgradeCosts?.L ?? []).map((value) => numberFrom(value)),
        effectsByLevel: (item.effectsByLevel?.L ?? []).map((entry) => ({
            level: numberFrom(entry.M?.level),
            effects: (entry.M?.effects?.L ?? []).map(effectFrom)
        })),
        active: item.active?.BOOL !== false,
        sortOrder: numberFrom(item.sortOrder)
    };
}

export function playerBuildingsFromItems(items = []) {
    return new Map(items.map((item) => [
        item.buildingId?.S ?? item.SK?.S?.slice("BUILDING#".length),
        {
            level: numberFrom(item.level, 1),
            upgradedAt: item.upgradedAt?.S ?? null
        }
    ]).filter(([buildingId]) => buildingId));
}
