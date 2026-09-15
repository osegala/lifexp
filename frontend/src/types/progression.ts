export type BuildingType =
  | "Home Base"
  | "Workshop"
  | "Library"
  | "Training Grounds"
  | "Garden"
  | "Hall of Achievements";

export type BuildingProgress = {
  type: BuildingType;
  level: number;
  totalXp: number;
  xpIntoLevel: number;
  xpToNextLevel: number;
  progressPercent: number;
  visualTier: number;
  eligibleVisualTier: number;
  upgradeAvailable: boolean;
};

export type BaseProgress = {
  baseLevel: number;
  buildings: BuildingProgress[];
};

export type TaskReward = {
  leveledUp?: boolean;
  unlockedCosmetics?: string[];
  buildingProgress?: BuildingProgress;
};
