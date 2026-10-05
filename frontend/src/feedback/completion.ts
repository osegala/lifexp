import type { CompletionResponse, LevelProgress, User } from "../types";
import type { BuildingUpgradeBatch } from "../base/buildingProgress";

export type CompletionEvent = {
  id: string;
  response: CompletionResponse;
  previous?: LevelProgress;
  previousCoins: number;
};

export function completionEvent(response: CompletionResponse, user?: User | null): CompletionEvent {
  const previousXp = response.player.xp - response.rewards.xp;
  // Old servers can use the last GET /me snapshot only when it exactly matches.
  // Never copy the leveling formula or animate from a stale account total.
  const previous = response.progression.previous ?? (user?.totalXp === previousXp
    && user.level === response.progression.previousLevel ? {
      level: user.level, totalXp: user.totalXp, xpIntoLevel: user.xpIntoLevel,
      xpForNextLevel: user.xpForNextLevel, xpToNextLevel: user.xpToNextLevel,
    } : undefined);
  return {
    id: JSON.stringify([response.task.taskId, response.task.repeatType === "NONE" ? "once" : response.time.date]),
    response,
    previous,
    previousCoins: response.player.coins - response.rewards.coins,
  };
}

export type CompletionQueue = {
  pending: CompletionEvent[];
  seen: string[];
  buildings: BuildingUpgradeBatch[];
  seenBuildingSources: string[];
  buildingTiers: Record<string, number>;
};
export const EMPTY_COMPLETION_QUEUE: CompletionQueue = {
  pending: [], seen: [], buildings: [], seenBuildingSources: [], buildingTiers: {},
};

export function completionQueue(state: CompletionQueue, action:
  | { type: "enqueue"; event: CompletionEvent }
  | { type: "finish"; id: string }
  | { type: "buildings"; batch: BuildingUpgradeBatch }
  | { type: "finishBuildings"; id: string }): CompletionQueue {
  if (action.type === "finishBuildings") return state.buildings[0]?.id === action.id
    ? { ...state, buildings: state.buildings.slice(1) } : state;
  if (action.type === "buildings") {
    if (state.seenBuildingSources.includes(action.batch.id)) return state;
    const buildingTiers = { ...state.buildingTiers };
    const upgrades = action.batch.upgrades.filter(upgrade => {
      if (upgrade.newTier <= Math.max(upgrade.previousTier, buildingTiers[upgrade.buildingId] ?? 0)) return false;
      buildingTiers[upgrade.buildingId] = upgrade.newTier;
      return true;
    });
    return {
      ...state, buildingTiers,
      seenBuildingSources: [...state.seenBuildingSources, action.batch.id],
      buildings: upgrades.length ? [...state.buildings, { ...action.batch, upgrades }] : state.buildings,
    };
  }
  if (action.type === "finish") return state.pending[0]?.id === action.id
    ? { ...state, pending: state.pending.slice(1) } : state;
  if (state.seen.includes(action.event.id)) return state;
  // Session-only; the provider is remounted on account change/logout.
  return { ...state, pending: [...state.pending, action.event], seen: [...state.seen, action.event.id] };
}

export function completionFrame(event: CompletionEvent, fraction: number) {
  const t = Math.max(0, Math.min(1, fraction));
  const { progression, player } = event.response;
  const end = progression.xpIntoLevel / progression.xpForNextLevel;
  let level = progression.level, progress = end;
  if (event.previous && t < 1) {
    const start = event.previous.xpIntoLevel / event.previous.xpForNextLevel;
    const crossed = Math.max(0, progression.level - event.previous.level);
    if (!crossed) progress = start + (end - start) * t;
    else {
      // A full bar represents a crossed level, not a fixed XP threshold.
      // Every crossed boundary gets its own fill/reset; the final bar keeps overflow.
      const segment = Math.min(crossed, Math.floor(t * (crossed + 1)));
      const local = t * (crossed + 1) - segment;
      level = event.previous.level + segment;
      const from = segment === 0 ? start : 0;
      const to = segment === crossed ? end : 1;
      progress = from + (to - from) * local;
    }
  }
  return {
    level, progress,
    coins: Math.round(event.previousCoins + (player.coins - event.previousCoins) * t),
    leveledUp: progression.level > progression.previousLevel && level > progression.previousLevel,
  };
}

export function completionAnnouncement(event: CompletionEvent) {
  const { task, rewards, progression, newAchievements } = event.response;
  return `${task.title} completed. ${rewards.xp} XP and ${rewards.coins} coins earned.`
    + (rewards.worldPoints ? ` ${rewards.worldPoints} World Points earned.` : "")
    + (progression.level > progression.previousLevel ? ` Level up! Level ${progression.level}.` : "")
    + newAchievements.map(a => ` Achievement unlocked: ${a.name}.`).join("");
}
