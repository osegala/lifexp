import type { AdProviderAdapter } from "./adapter";
import { apiError } from "../api/errors";

export const REWARDED_AD_COINS = 10;
export const REWARDED_AD_DAILY_LIMIT = 3;
export type RewardedAdStatus = { rewardCoins: number; coins: number; rewardedAdsUsedToday: number;
  rewardedAdsRemainingToday: number; date: string; timeZone: string; available: boolean };
export type RewardedAdResult = RewardedAdStatus & { duplicate: boolean };
type State = { status: RewardedAdStatus | null; phase: "idle" | "checking" | "preparing" | "ready" | "claiming";
  error: string | null; message: string | null };

function checkedStatus(status: RewardedAdStatus) {
  if (!status || status.rewardCoins !== REWARDED_AD_COINS || !Number.isSafeInteger(status.coins) || status.coins < 0
    || !Number.isInteger(status.rewardedAdsUsedToday) || status.rewardedAdsUsedToday < 0 || status.rewardedAdsUsedToday > REWARDED_AD_DAILY_LIMIT
    || status.rewardedAdsRemainingToday !== REWARDED_AD_DAILY_LIMIT - status.rewardedAdsUsedToday
    || typeof status.available !== "boolean" || typeof status.timeZone !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(status.date)) {
    throw new Error("Invalid rewarded-ad response");
  }
  return status;
}

/** One session-scoped flow. Same-tick taps and ambiguous retries keep the same server receipt. */
export class RewardedAds {
  private state: State = { status: null, phase: "idle", error: null, message: null };
  private listeners = new Set<() => void>();
  private userId: string | null = null;
  private enabled = false;
  private revision = 0;
  private receipt: string | null = null;
  private adapter: AdProviderAdapter;
  constructor(adapter: AdProviderAdapter) { this.adapter = adapter; }
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private update(patch: Partial<State>) { this.state = { ...this.state, ...patch }; this.listeners.forEach(fn => fn()); }
  setScope(userId: string | null, enabled: boolean) {
    if (this.userId !== userId) {
      this.userId = userId; this.revision++; this.receipt = null;
      this.update({ status: null, phase: "idle", error: null, message: null });
    }
    this.enabled = enabled;
  }
  dispose = () => {
    this.enabled = false; this.userId = null; this.revision++; this.receipt = null;
    this.update({ status: null, phase: "idle", error: null, message: null });
  };
  refresh = async () => {
    if (!this.enabled || this.state.phase !== "idle") return;
    const revision = this.revision;
    this.update({ phase: "checking", error: null });
    try {
      const status = checkedStatus(await this.adapter.getRewardStatus());
      if (revision === this.revision) this.update({ status });
    } catch {
      if (revision === this.revision) this.update({ status: null, error: "Could not check ad rewards. Please retry." });
    } finally { if (revision === this.revision) this.update({ phase: "idle" }); }
  };
  request = async () => {
    if (!this.enabled || this.state.phase !== "idle" || !this.state.status?.available || !this.state.status.rewardedAdsRemainingToday) return;
    const revision = this.revision;
    this.update({ phase: "preparing", error: null, message: null });
    try {
      const completion = await this.adapter.showRewarded();
      if (revision !== this.revision || !this.enabled) return;
      if (!completion.providerEventId || typeof completion.providerEventId !== "string") throw new Error("Missing provider event");
      this.receipt = completion.providerEventId;
      this.update({ phase: "ready" });
      if (!completion.devSimulation) return await this.complete();
    } catch {
      if (revision === this.revision) this.update({ error: "Could not prepare the ad. No reward was confirmed." });
    } finally { if (revision === this.revision && this.getSnapshot().phase === "preparing") this.update({ phase: "idle" }); }
  };
  complete = async (): Promise<RewardedAdResult | null> => {
    if (!this.enabled || !this.receipt || this.state.phase !== "ready") return null;
    const revision = this.revision, receipt = this.receipt;
    this.update({ phase: "claiming", error: null });
    try {
      const result = await this.adapter.verifyRewardedCompletion(receipt);
      checkedStatus(result);
      if (typeof result.duplicate !== "boolean") throw new Error("Unconfirmed reward");
      if (revision !== this.revision) return null;
      this.receipt = null;
      this.update({ status: result, phase: "idle", message: result.duplicate ? "This ad reward was already confirmed." : `${result.rewardCoins} coins confirmed by Evrenthia.` });
      return this.enabled ? result : null;
    } catch (error) {
      if (revision !== this.revision) return null;
      const failure = apiError(error, "Could not confirm the reward.");
      if (failure.code === "AD_DAILY_LIMIT") {
        try {
          const status = checkedStatus(failure.details as RewardedAdStatus);
          if (status.rewardedAdsRemainingToday === 0) {
            this.receipt = null;
            this.update({ status, phase: "idle", error: null, message: "Daily ad rewards claimed." });
            return null;
          }
        } catch { /* An invalid error response must not invent a reward or allowance. */ }
      }
      this.update({ phase: "ready", error: "Could not confirm the reward. Retry this same completion; it cannot grant twice." });
      return null;
    }
  };
  cancel = () => {
    if (this.state.phase === "claiming") return;
    this.receipt = null; this.update({ phase: "idle", error: null });
  };
}
