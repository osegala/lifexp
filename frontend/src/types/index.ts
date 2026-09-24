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
  repeatType: "NONE" | "DAILY" | "WEEKLY";
  repeatDays: string[];
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

export type GoalProgress = {
  current: number;
  target: number;
  remaining: number;
  progressPercent: number;
  completed: boolean;
  reward: { worldPoints: number; granted: boolean; grantedAt: string | null };
};

export type GoalsResponse = {
  timeZone: string;
  date: string;
  week: string;
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
