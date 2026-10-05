import type { BaseProgress, BuildingType, UpgradeBuildingResponse, WorldResponse } from "../types/progression";

const BUILDING_TYPES: readonly BuildingType[] = [
  "Home Base", "Workshop", "Library", "Training Grounds", "Garden", "Hall of Achievements",
];

export type BuildingUpgrade = {
  buildingId: string;
  buildingName: BuildingType;
  previousTier: number;
  newTier: number;
};
export type BuildingUpgradeBatch = { id: string; upgrades: BuildingUpgrade[] };

// Existing World renderer mapping, not a player-level progression formula.
const visualTier = (level: number) => Math.max(1, Math.min(5, level));
const isBuildingType = (name: string): name is BuildingType => BUILDING_TYPES.includes(name as BuildingType);

export function worldToBaseProgress(world: WorldResponse): BaseProgress {
  const buildings = world.buildings.filter(building => isBuildingType(building.name)).map(building => ({
    buildingId: building.buildingId,
    type: building.name as BuildingType,
    level: building.currentLevel,
    maxLevel: building.maxLevel,
    upgradeCost: building.upgradeCost,
    visualTier: visualTier(building.currentLevel),
    upgradeAvailable: building.canUpgrade,
  }));
  return { baseLevel: Math.max(1, ...buildings.map(building => building.level)), worldPoints: world.worldPoints, buildings };
}

export function buildingUpgrades(before: WorldResponse | null, after: WorldResponse | null): BuildingUpgrade[] {
  if (!before || !after) return [];
  const previous = new Map(worldToBaseProgress(before).buildings.map(building => [building.buildingId, building.visualTier]));
  return worldToBaseProgress(after).buildings.flatMap(building => {
    const previousTier = previous.get(building.buildingId);
    // Newly discovered buildings and missing snapshots are not confirmed upgrades.
    return previousTier !== undefined && building.visualTier > previousTier ? [{
      buildingId: building.buildingId, buildingName: building.type, previousTier, newTier: building.visualTier,
    }] : [];
  });
}

export function confirmedBuildingUpgrade(response: UpgradeBuildingResponse): BuildingUpgrade[] {
  const { building } = response;
  const previousTier = visualTier(building.oldLevel), newTier = visualTier(building.newLevel);
  return response.upgraded && isBuildingType(building.name) && newTier > previousTier ? [{
    buildingId: building.buildingId, buildingName: building.name, previousTier, newTier,
  }] : [];
}

export const buildingUpgradeAnnouncement = (batch: BuildingUpgradeBatch) =>
  batch.upgrades.map(upgrade => `${upgrade.buildingName} reached Tier ${upgrade.newTier}`).join(". ");
