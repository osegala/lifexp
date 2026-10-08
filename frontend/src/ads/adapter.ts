import { api } from "../api/client";
import { apiRoutes } from "../api/routes";
import type { RewardedAdResult, RewardedAdStatus } from "./rewarded";

export type AdProviderAdapter = {
  loadBanner(): "placeholder" | null;
  getRewardStatus(): Promise<RewardedAdStatus>;
  showRewarded(): Promise<{ providerEventId: string; devSimulation: boolean }>;
  verifyRewardedCompletion(providerEventId: string): Promise<RewardedAdResult>;
};

/** Local/DEV adapter only. No SDK, ad-network request, or client-side coin grant. */
export const devAdAdapter: AdProviderAdapter = {
  loadBanner: () => "placeholder",
  getRewardStatus: async () => (await api.get<RewardedAdStatus>(apiRoutes.adReward)).data,
  showRewarded: async () => (await api.post<{ providerEventId: string; devSimulation: boolean }>(apiRoutes.prepareAdReward, {})).data,
  verifyRewardedCompletion: async providerEventId => (await api.post<RewardedAdResult>(apiRoutes.adReward, { providerEventId, rewardType: "COINS" })).data,
};
