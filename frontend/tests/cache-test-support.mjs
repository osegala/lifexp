import { PlayerCache } from "../src/cache/PlayerCache.ts";
export function memoryCache(scope = "test", values = new Map()) {
  const storage = { getItem: async key => values.get(key) ?? null,
    setItem: async (key, value) => { values.set(key, value); }, removeItem: async key => { values.delete(key); } };
  return { cache: new PlayerCache(storage, scope), storage, values };
}
export const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
export const profile = { displayName: "Rowan", timeZone: "America/New_York", onboardingCompleted: true,
  xp: 100, level: 2, coins: 481, xpIntoLevel: 50, xpForNextLevel: 100, xpToNextLevel: 50,
  bodyType: "GIRL", hairId: "hair_style_1", skinColorId: "skin_01", hairColorId: "hair_01", eyeColorId: "eyes_01" };
export const inventory = { items: [], equipped: { hair: null, hat: null, tunic: null, pants: null, boots: null, pet: null, aura: null, background: null } };
export const task = { taskId: "read", title: "Read a chapter", description: null, taskSize: "NORMAL", repeatType: "DAILY", repeatDays: [],
  startDate: null, dueTime: "09:00", nextScheduledDate: null, active: true, archived: false, completed: false, completedToday: false,
  isScheduledToday: true, isDueToday: true, currentStreak: 2, bestStreak: 4, xpReward: 35, coinReward: 4 };
export const tasks = { time: { date: "2026-10-23", timeZone: "America/New_York", weekday: "FRI" },
  summary: { total: 1, active: 1, scheduledToday: 1, dueToday: 1, completedToday: 0 }, tasks: [task] };
const goal = { current: 1, target: 3, remaining: 2, progressPercent: 100 / 3, completed: false,
  reward: { worldPoints: 30, granted: false, grantedAt: null } };
export const goals = { date: tasks.time.date, timeZone: tasks.time.timeZone, week: "2026-W43", refreshAfterMs: 60_000,
  player: { worldPoints: 50 }, daily: { tasks: goal }, weekly: { tasks: goal }, streak: { currentDays: 2, longestDays: 4, completedToday: true } };
export const achievements = { summary: { earned: 0, locked: 1, total: 1, completionPercent: 0, byType: {} },
  achievements: [{ achievementId: "reader", name: "Reader", description: "Read chapters", type: "TASKS_COMPLETED",
    requiredValue: 10, currentValue: 2, progressPercent: 20, earned: false, earnedAt: null, rewards: [] }] };
export const world = { worldPoints: 412, buildings: [{ buildingId: "workshop", name: "Workshop", currentLevel: 1, level: 1,
  maxLevel: 5, maxed: false, nextLevel: 2, upgradeCost: 100, canAfford: true, canUpgrade: true, sortOrder: 1, upgradedAt: null }] };
export const baseLayout = Object.fromEntries(["Home Base", "Workshop", "Library", "Training Grounds", "Garden", "Hall of Achievements"]
  .map((type, index) => [type, { x: 1900 + index * 150, y: 900 + index * 100, width: 300, height: 300 }]));
