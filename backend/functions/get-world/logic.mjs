export function buildWorld(catalog, playerBuildings, worldPoints, activeEffectsByBuilding = new Map()) {
    return catalog
        .filter((building) => building.active)
        .map((building) => {
            const playerBuilding = playerBuildings.get(building.buildingId);
            const currentLevel = playerBuilding?.level ?? 1;
            const maxed = currentLevel >= building.maxLevel;
            const upgradeCost = maxed
                ? null
                : building.upgradeCosts[currentLevel - 1] ?? null;
            const canAfford = upgradeCost !== null && worldPoints >= upgradeCost;

            return {
                buildingId: building.buildingId,
                name: building.name || building.buildingId,
                currentLevel,
                level: currentLevel,
                maxLevel: building.maxLevel,
                maxed,
                nextLevel: maxed ? null : currentLevel + 1,
                upgradeCost,
                canAfford,
                canUpgrade: !maxed && upgradeCost !== null && canAfford,
                activeEffects: activeEffectsByBuilding.get(building.buildingId) ?? [],
                sortOrder: building.sortOrder,
                upgradedAt: playerBuilding?.upgradedAt ?? null
            };
        })
        .sort((left, right) => left.sortOrder - right.sortOrder);
}
