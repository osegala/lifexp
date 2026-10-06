export type User = {
  id: string | number;
  username: string;
  email: string;
  timeZone: string;
  totalXp: number;
  level: number;
  xpIntoLevel: number;
  xpForNextLevel: number;
  xpToNextLevel: number;
  progressPercent: number;
  currentStreak: number;
  longestStreak: number;
  coins: number;
  premiumActive: boolean;
};

export type TaskSize = "QUICK" | "SMALL" | "NORMAL" | "CHALLENGING" | "BIG";

export type Task = {
  taskId: string;
  title: string;
  description: string | null;
  taskSize: TaskSize;
  repeatType: "NONE" | "DAILY" | "WEEKLY" | "MONTHLY";
  repeatDays: string[];
  startDate?: string | null;
  dueTime?: string | null;
  nextScheduledDate?: string | null;
  active: boolean;
  archived: boolean;
  completed: boolean;
  completedToday: boolean;
  isScheduledToday: boolean;
  isDueToday: boolean;
  currentStreak: number;
  bestStreak: number;
  xpReward: number;
  coinReward: number;
};

export type TasksResponse = {
  time: { timeZone: string; date: string; weekday: string };
  summary: {
    total: number;
    active: number;
    scheduledToday: number;
    dueToday: number;
    completedToday: number;
  };
  tasks: Task[];
};

export type LevelProgress = {
  level: number;
  totalXp: number;
  xpIntoLevel: number;
  xpForNextLevel: number;
  xpToNextLevel: number;
};

/** Confirmed POST /tasks/{taskId}/complete response (extra server fields are unused). */
export type CompletionResponse = {
  task: Omit<Task, "archived">;
  rewards: { xp: number; coins: number; worldPoints: number };
  goalRewards?: {
    daily: { awarded: boolean; worldPoints: number };
    weekly: { awarded: boolean; worldPoints: number };
  };
  activityStreak?: ActivityStreak & { increased: boolean };
  progression: LevelProgress & {
    previousLevel: number;
    leveledUp: boolean;
    previous?: LevelProgress; // Older deployments omit this snapshot.
  };
  player: { xp: number; coins: number; worldPoints: number; tasksCompleted: number; level: number };
  time: { date: string; completedAt: string };
  newAchievements: {
    achievementId: string;
    name: string;
    description: string;
    type: string;
    requiredValue: number;
    progressValue: number;
    earnedAt: string;
  }[];
};

export type GoalProgress = {
  current: number;
  target: number;
  remaining: number;
  progressPercent: number;
  completed: boolean;
  reward: { worldPoints: number; granted: boolean; grantedAt: string | null; earnedWorldPoints?: number };
};

export type ActivityStreak = { currentDays: number; longestDays: number; completedToday: boolean };

export type GoalsResponse = {
  timeZone: string;
  date: string;
  week: string;
  refreshAfterMs?: number;
  streak?: ActivityStreak; // Absent on older servers; do not fabricate a streak.
  player: { worldPoints: number };
  daily: { tasks: GoalProgress };
  weekly: { tasks: GoalProgress };
};

export type Achievement = {
  achievementId: string;
  name: string;
  description: string;
  type: string;
  requiredValue: number;
  currentValue: number;
  progressPercent: number;
  earned: boolean;
  earnedAt: string | null;
  rewards?: { itemId: string; name: string; category: string }[];
};

export type AchievementsResponse = {
  summary: {
    earned: number;
    locked: number;
    total: number;
    completionPercent: number;
    byType: Record<string, { earned: number; total: number }>;
  };
  achievements: Achievement[];
};

export type ShopItem = {
  itemId: string;
  name: string;
  category: string;
  price: number;
  effectivePrice: number;
  requiredLevel: number;
  effectiveRequiredLevel: number;
  requiredAchievement: string | null;
  achievementRequirement: {
    achievementId: string;
    name: string;
    description: string;
    type: string;
    requiredValue: number;
    currentValue: number;
    progressPercent: number;
    satisfied: boolean;
  } | null;
  requirementSatisfied: boolean;
  assetKey: string | null;
  owned: boolean;
  unlocked: boolean;
  canAfford: boolean;
  canPurchase: boolean;
  status: "LOCKED" | "PURCHASABLE" | "NOT_ENOUGH_COINS" | "OWNED";
};

export type ShopResponse = {
  player: { level: number; coins: number };
  items: ShopItem[];
};

export type EntitlementResponse = {
  plan: "FREE" | "PREMIUM";
  subscriptionStatus: string;
  adsEnabled: boolean;
  expiresAt: string | null;
  autoRenew: boolean;
};
