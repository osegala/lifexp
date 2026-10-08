import { createContext, useContext, useEffect, useState, useSyncExternalStore } from "react";
import type { ReactNode } from "react";
import { usePathname } from "expo-router";
import { AppState, StyleSheet, Text } from "react-native";
import { useAuth } from "../context/AuthContext";
import { useFeedbackActive } from "../context/CompletionFeedbackContext";
import { useEntitlements } from "../entitlements/useEntitlements";
import { shouldShowAds } from "../entitlements/model";
import { environment } from "../config/environment";
import LifeCard from "../components/LifeCard";
import LifeButton from "../components/LifeButton";
import { colors, spacing } from "../theme/theme";
import { resolveAdMode, routeAllowsBanner, type AdMode, type BannerPlacement } from "./model";
import { devAdAdapter } from "./adapter";
import { RewardedAds, REWARDED_AD_COINS, type RewardedAdResult } from "./rewarded";

const AdsContext = createContext<({ mode: AdMode; eligible: boolean; canShowPersistentAds: boolean; canUseRewardedAds: boolean;
  rewardedAdsRemainingToday: number | null; rewardedAdLoading: boolean; flow: RewardedAds }
  & ReturnType<RewardedAds["getSnapshot"]>) | null>(null);

/** Provider/config boundary. Only our own authenticated DEV API is used; no ad network is connected. */
export function AdProvider({ children }: { children: ReactNode }) {
  const entitlements = useEntitlements();
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const feedbackActive = useFeedbackActive();
  const userId = user ? String(user.id) : null;
  const [flow] = useState(() => new RewardedAds(devAdAdapter));
  const state = useSyncExternalStore(flow.subscribe, flow.getSnapshot, flow.getSnapshot);
  const mode = resolveAdMode(process.env.EXPO_PUBLIC_ADS_MODE, environment.environment, __DEV__);
  const eligible = !loading && user?.onboardingCompleted === true && entitlements.confirmed
    && !entitlements.loading && shouldShowAds(entitlements);
  const canShowPersistentAds = mode === "placeholder" && eligible && !feedbackActive
    && (routeAllowsBanner("HOME", pathname) || routeAllowsBanner("SHOP", pathname));
  const canUseRewardedAds = canShowPersistentAds && routeAllowsBanner("SHOP", pathname);
  useEffect(() => {
    flow.setScope(userId, canUseRewardedAds);
    if (!canUseRewardedAds) return;
    void flow.refresh();
    const timer = setInterval(() => { if (AppState.currentState === "active") void flow.refresh(); }, 60_000);
    const subscription = AppState.addEventListener("change", next => { if (next === "active") void flow.refresh(); });
    return () => { clearInterval(timer); subscription.remove(); };
  }, [flow, userId, canUseRewardedAds]);
  useEffect(() => () => flow.dispose(), [flow]);
  return <AdsContext.Provider value={{ mode, eligible, canShowPersistentAds, canUseRewardedAds, ...state, flow,
    rewardedAdsRemainingToday: state.status?.rewardedAdsRemainingToday ?? null,
    rewardedAdLoading: ["checking", "preparing", "claiming"].includes(state.phase) }}>{children}</AdsContext.Provider>;
}

export function useAds() {
  const value = useContext(AdsContext);
  if (!value) throw new Error("useAds must be inside AdProvider");
  return { ...value, requestRewardedAd: value.flow.request, completeDevRewardedAd: value.flow.complete,
    cancelRewardedAd: value.flow.cancel, refreshRewardedAds: value.flow.refresh };
}

export function BannerAdPlacement({ placement }: { placement: BannerPlacement }) {
  const { mode, eligible } = useAds();
  const pathname = usePathname();
  const feedbackActive = useFeedbackActive();
  if (mode !== "placeholder" || !eligible || feedbackActive || !routeAllowsBanner(placement, pathname)) return null;
  return <LifeCard compact style={styles.placeholder} accessibilityLabel={`Ad placement — DEV only. ${placement === "HOME" ? "Home" : "Shop"} banner. No ad network is connected.`}>
    <Text style={styles.label}>Ad placement — DEV only</Text>
    <Text style={styles.copy}>{placement === "HOME" ? "Home" : "Shop"} banner · No ad network is connected.</Text>
  </LifeCard>;
}

/** Reserved placement; interstitial delivery/frequency is deliberately inactive. */
export function InterstitialAdPlacement() { return null; }

/** Optional Shop-only reward. The explicit DEV completion control is never present in production. */
export function RewardedAdButton({ onReward }: { onReward?: (result: RewardedAdResult) => void }) {
  const ads = useAds();
  if (!ads.canUseRewardedAds) return null;
  const ready = ads.phase === "ready" || ads.phase === "claiming";
  const exhausted = ads.rewardedAdsRemainingToday === 0;
  return <LifeCard compact style={styles.rewarded}>
    <Text style={styles.label}>Rewarded ad — DEV only</Text>
    <Text style={styles.copy}>Optional · {REWARDED_AD_COINS} coins per confirmed ad. No ad network is connected.</Text>
    <Text style={styles.copy}>{ads.rewardedAdsRemainingToday === null ? "Daily allowance has not been confirmed."
      : `${ads.rewardedAdsRemainingToday} ad rewards remaining today · ${ads.status?.timeZone}`}</Text>
    {ads.error ? <Text accessibilityRole="alert" style={styles.copy}>{ads.error}</Text> : null}
    {ads.message ? <Text accessibilityRole="text" accessibilityLiveRegion="polite" style={styles.copy}>{ads.message}</Text> : null}
    {ready ? <>
      <Text style={styles.copy}>DEV simulation ready. Closing this without completing grants no coins.</Text>
      <LifeButton title={ads.phase === "claiming" ? "Confirming reward…" : "Complete DEV rewarded ad"} disabled={ads.rewardedAdLoading}
        onPress={() => { void ads.completeDevRewardedAd().then(result => { if (result) onReward?.(result); }); }} />
      <LifeButton title="Cancel DEV ad" variant="secondary" disabled={ads.rewardedAdLoading} onPress={ads.cancelRewardedAd} />
    </> : <>
      {ads.status?.available === false ? <Text style={styles.copy}>The DEV reward adapter is disabled on this server.</Text> : null}
      <LifeButton title={exhausted ? "Daily ad rewards claimed" : ads.rewardedAdLoading ? "Checking ad rewards…" : `Watch an ad for ${REWARDED_AD_COINS} coins`}
        disabled={exhausted || ads.rewardedAdLoading || !ads.status?.available}
        onPress={() => { void ads.requestRewardedAd().then(result => { if (result) onReward?.(result); }); }} />
      {ads.error ? <LifeButton title="Retry ad reward status" variant="secondary" disabled={ads.rewardedAdLoading} onPress={() => { void ads.refreshRewardedAds(); }} /> : null}
    </>}
  </LifeCard>;
}

const styles = StyleSheet.create({
  placeholder: { minHeight: 100, justifyContent: "center", backgroundColor: colors.cardLight, borderColor: colors.accent, borderWidth: 2, borderStyle: "dashed" },
  label: { color: colors.text, fontSize: 18, lineHeight: 24, fontWeight: "700" },
  copy: { color: colors.mutedText, fontSize: 14, lineHeight: 20, marginTop: spacing.xs },
  rewarded: { gap: spacing.sm },
});
