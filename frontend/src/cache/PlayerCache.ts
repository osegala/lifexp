import type { ProfileResponse } from "../auth/session.ts";
import type { AchievementsResponse, GoalsResponse, ShopResponse, TasksResponse } from "../types/index.ts";
import type { InventoryResponse } from "../types/avatar.ts";
import type { BuildingLayouts, WorldResponse } from "../types/progression.ts";

export type PlayerResources = { profile: ProfileResponse; inventory: InventoryResponse; shop: ShopResponse;
  tasks: TasksResponse; goals: GoalsResponse; achievements: AchievementsResponse;
  world: WorldResponse; baseLayout: BuildingLayouts };
type Resource = keyof PlayerResources;
type Storage = { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<unknown>; removeItem(key: string): Promise<unknown> };
const resources: Resource[] = ["profile", "inventory", "shop", "tasks", "goals", "achievements", "world", "baseLayout"];
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const id = (value: unknown) => value === null || typeof value === "string";
const numbers = (value: unknown, fields: string[]) => record(value) && fields.every(key => Number.isFinite(value[key]));
const goal = (value: unknown) => numbers(value, ["current", "target", "remaining", "progressPercent"])
  && record(value) && typeof value.completed === "boolean" && numbers(value.reward, ["worldPoints"])
  && record(value.reward) && typeof value.reward.granted === "boolean";

export function usableResource(key: Resource, value: unknown): boolean {
  if (!record(value)) return false;
  const time = value.time;
  if (key === "baseLayout") return ["Home Base", "Workshop", "Library", "Training Grounds", "Garden", "Hall of Achievements"]
    .every(type => numbers(value[type], ["x", "y", "width", "height"]) && record(value[type])
      && Number(value[type].width) > 0 && Number(value[type].height) > 0);
  if (key === "world") return numbers(value, ["worldPoints"]) && Array.isArray(value.buildings)
    && value.buildings.every(building => record(building) && typeof building.buildingId === "string" && typeof building.name === "string"
      && numbers(building, ["currentLevel", "level", "maxLevel", "sortOrder"])
      && ["maxed", "canAfford", "canUpgrade"].every(k => typeof building[k] === "boolean")
      && (building.nextLevel === null || Number.isFinite(building.nextLevel))
      && (building.upgradeCost === null || Number.isFinite(building.upgradeCost)) && id(building.upgradedAt));
  if (key === "profile") return typeof value.displayName === "string" && typeof value.timeZone === "string"
    && typeof value.onboardingCompleted === "boolean" && ["xp", "level", "coins", "xpIntoLevel", "xpForNextLevel", "xpToNextLevel"].every(k => Number.isFinite(value[k]));
  if (key === "tasks") return record(time) && ["date", "timeZone", "weekday"].every(k => typeof time[k] === "string")
    && numbers(value.summary, ["total", "active", "scheduledToday", "dueToday", "completedToday"])
    && Array.isArray(value.tasks) && value.tasks.every(task => record(task)
      && ["taskId", "title", "taskSize", "repeatType"].every(k => typeof task[k] === "string")
      && ["description", "dueTime", "startDate", "nextScheduledDate"].every(k => task[k] === undefined || id(task[k]))
      && Array.isArray(task.repeatDays) && task.repeatDays.every(day => typeof day === "string")
      && ["active", "archived", "completed", "completedToday", "isScheduledToday", "isDueToday"].every(k => typeof task[k] === "boolean")
      && numbers(task, ["currentStreak", "bestStreak", "xpReward", "coinReward"]));
  if (key === "goals") return ["date", "timeZone", "week"].every(k => typeof value[k] === "string")
    && (value.refreshAfterMs === undefined || Number.isFinite(value.refreshAfterMs))
    && numbers(value.player, ["worldPoints"]) && record(value.daily) && goal(value.daily.tasks)
    && record(value.weekly) && goal(value.weekly.tasks)
    && (value.streak === undefined || numbers(value.streak, ["currentDays", "longestDays"])
      && record(value.streak) && typeof value.streak.completedToday === "boolean");
  if (key === "achievements") return numbers(value.summary, ["earned", "locked", "total", "completionPercent"])
    && Array.isArray(value.achievements) && value.achievements.every(item => record(item)
      && ["achievementId", "name", "description", "type"].every(k => typeof item[k] === "string")
      && numbers(item, ["requiredValue", "currentValue", "progressPercent"]) && typeof item.earned === "boolean"
      && (item.rewards === undefined || Array.isArray(item.rewards) && item.rewards.every(reward => record(reward) && typeof reward.name === "string")));
  if (!Array.isArray(value.items)) return false;
  const equipped = value.equipped;
  if (key === "inventory") return record(equipped)
    && ["hair", "hat", "tunic", "pants", "boots", "background", "pet", "aura"].every(k => id(equipped[k]))
    && value.items.every(item => record(item) && typeof item.itemId === "string" && typeof item.name === "string"
      && typeof item.category === "string" && id(item.assetKey) && typeof item.equipped === "boolean");
  return record(value.player) && Number.isFinite(value.player.coins) && Number.isFinite(value.player.level)
    && value.items.every(item => record(item) && typeof item.itemId === "string" && typeof item.name === "string"
      && typeof item.category === "string" && id(item.assetKey) && typeof item.owned === "boolean"
      && typeof item.canPurchase === "boolean" && Number.isFinite(item.effectivePrice) && Number.isFinite(item.effectiveRequiredLevel));
}

export class SupersededCacheRead extends Error {}

/** Display snapshots and local map placement only. Never cache credentials or entitlements.
 * Generations prevent old reads/disk hydration from undoing confirmed writes. */
export class PlayerCache {
  private memory = new Map<string, unknown>();
  private generations = new Map<string, number>();
  private reads = new Map<string, Promise<unknown>>();
  private hydrations = new Map<string, Promise<unknown>>();
  private writes = new Map<string, Promise<unknown>>();
  private sessions = new Map<string, number>();
  constructor(privateStorage: Storage, privateScope: string) { this.storage = privateStorage; this.scope = privateScope; }
  private storage: Storage;
  private scope: string;
  private key(userId: string | number, key: Resource) { return `evrenthia.player-cache.v1.${encodeURIComponent(this.scope)}.${encodeURIComponent(String(userId))}.${key}`; }
  private generation(key: string) { return this.generations.get(key) ?? 0; }
  /** Check before storing a direct server mutation response or session read. */
  checkpoint(userId: string | number, resource: Resource) {
    const key = this.key(userId, resource), generation = this.generation(key);
    return () => this.generation(key) === generation;
  }
  accountCurrent(userId: string | number) {
    const id = String(userId), session = this.sessions.get(id);
    return () => this.sessions.get(id) === session;
  }
  private persist(key: string, value: string | null) {
    const write = (this.writes.get(key) ?? Promise.resolve()).then(() => value === null
      ? this.storage.removeItem(key) : this.storage.setItem(key, value)).catch(() => {});
    this.writes.set(key, write);
    void write.finally(() => { if (this.writes.get(key) === write) this.writes.delete(key); });
    return write;
  }
  peek<K extends Resource>(userId: string | number, resource: K): PlayerResources[K] | null {
    return (this.memory.get(this.key(userId, resource)) as PlayerResources[K]) ?? null;
  }
  hydrate<K extends Resource>(userId: string | number, resource: K): Promise<PlayerResources[K] | null> {
    const key = this.key(userId, resource);
    if (this.memory.has(key)) return Promise.resolve(this.peek(userId, resource));
    const pending = this.hydrations.get(key);
    if (pending) return pending as Promise<PlayerResources[K] | null>;
    const generation = this.generation(key);
    const promise = (async () => {
      try {
        await this.writes.get(key);
        const raw = await this.storage.getItem(key);
        if (this.generation(key) !== generation) return this.peek(userId, resource);
        const stored = raw ? JSON.parse(raw) : null;
        if (stored?.version === 1 && usableResource(resource, stored.data)) this.memory.set(key, stored.data);
      } catch { /* Corrupt/evicted storage never prevents a backend refresh. */ }
      return this.peek(userId, resource);
    })();
    this.hydrations.set(key, promise);
    void promise.finally(() => { if (this.hydrations.get(key) === promise) this.hydrations.delete(key); });
    return promise;
  }
  hydrateUser(userId: string | number) { return Promise.all(resources.map(key => this.hydrate(userId, key))); }
  set<K extends Resource>(userId: string | number, resource: K, data: PlayerResources[K]) {
    if (!usableResource(resource, data)) throw new Error(`Invalid ${resource} response`);
    const key = this.key(userId, resource), serialized = JSON.stringify({ version: 1, data });
    this.invalidate(userId, [resource]);
    this.memory.set(key, JSON.parse(serialized).data);
    void this.persist(key, serialized);
  }
  refresh<K extends Resource>(userId: string | number, resource: K, load: () => Promise<PlayerResources[K]>): Promise<PlayerResources[K]> {
    const key = this.key(userId, resource), pending = this.reads.get(key);
    if (pending) return pending as Promise<PlayerResources[K]>;
    const generation = this.generation(key);
    const promise = (async () => {
      const data = await load();
      if (this.generation(key) !== generation) throw new SupersededCacheRead();
      this.set(userId, resource, data);
      return data;
    })();
    this.reads.set(key, promise);
    void promise.then(() => {}, () => {}).finally(() => { if (this.reads.get(key) === promise) this.reads.delete(key); });
    return promise;
  }
  invalidate(userId: string | number, keys: Resource[] = resources) {
    for (const resource of keys) {
      const key = this.key(userId, resource);
      this.generations.set(key, this.generation(key) + 1);
      this.reads.delete(key);
      this.hydrations.delete(key);
    }
  }
  async clearUser(userId: string | number) {
    const id = String(userId);
    this.sessions.set(id, (this.sessions.get(id) ?? 0) + 1);
    this.invalidate(userId);
    await Promise.all(resources.map(resource => {
      const key = this.key(userId, resource);
      this.memory.delete(key);
      return this.persist(key, null);
    }));
  }
}
