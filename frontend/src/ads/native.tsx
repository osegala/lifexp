import type { AdProviderAdapter } from "./adapter";
import type { BannerPlacement } from "./model";

/** Platform resolver keeps native SDKs out of ordinary web bundles. */
export const nativeAdsSupported = false;
export const liveAdsConfigured = false;
export function setNativeAdScope(_userId: string | null, _allowed: boolean) {}
export function NativeBanner(_props: { placement: BannerPlacement }) { return null; }
const unavailable = async (): Promise<never> => { throw new Error("Native ads are unavailable."); };
export const adMobAdapter: AdProviderAdapter = {
  loadBanner: () => null, getRewardStatus: unavailable, showRewarded: unavailable, verifyRewardedCompletion: unavailable,
};
