export type BuildingType =
  | "Home Base"
  | "Workshop"
  | "Library"
  | "Training Grounds"
  | "Garden"
  | "Hall of Achievements";

export type BuildingProgress = {
  buildingId: string;
  type: BuildingType;
  level: number;
  maxLevel: number;
  upgradeCost: number | null;
  visualTier: number;
  upgradeAvailable: boolean;
};

export type BaseProgress = {
  baseLevel: number;
  worldPoints: number;
  buildings: BuildingProgress[];
};

export type WorldBuilding = {
  buildingId: string;
  name: string;
  currentLevel: number;
  level: number;
  maxLevel: number;
  maxed: boolean;
  nextLevel: number | null;
  upgradeCost: number | null;
  canAfford: boolean;
  canUpgrade: boolean;
  sortOrder: number;
  upgradedAt: string | null;
};

export type WorldResponse = {
  worldPoints: number;
  buildings: WorldBuilding[];
};

export type UpgradeBuildingResponse = {
  upgraded: true;
  building: {
    buildingId: string;
    name: string;
    oldLevel: number;
    newLevel: number;
    maxLevel: number;
  };
  cost: { worldPoints: number };
  player: { worldPoints: number };
};
