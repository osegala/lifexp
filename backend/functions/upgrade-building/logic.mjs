export class UpgradeError extends Error {
    constructor(statusCode, code, message, details) {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.details = details;
    }
}

export function planUpgrade(catalog, building, worldPoints) {
    if (!catalog) {
        throw new UpgradeError(404, "BUILDING_NOT_FOUND", "Building not found.");
    }
    if (!catalog.active) {
        throw new UpgradeError(400, "BUILDING_LOCKED", "Building is not currently active.");
    }

    const currentLevel = building?.level ?? 1;
    if (currentLevel >= catalog.maxLevel) {
        throw new UpgradeError(409, "BUILDING_MAX_LEVEL", "Building is already at max level.");
    }

    const upgradeCost = catalog.upgradeCosts[currentLevel - 1];
    if (upgradeCost === undefined) {
        throw new Error("Upgrade cost is not configured");
    }
    if (worldPoints < upgradeCost) {
        throw new UpgradeError(400, "INSUFFICIENT_WORLD_POINTS", "Not enough World Points.", { worldPoints, upgradeCost });
    }

    return {
        currentLevel,
        newLevel: currentLevel + 1,
        maxLevel: catalog.maxLevel,
        upgradeCost,
        remainingWorldPoints: worldPoints - upgradeCost
    };
}
