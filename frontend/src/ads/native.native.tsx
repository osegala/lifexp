import { useEffect, useState } from "react";
import { Platform, View } from "react-native";
import Constants, { ExecutionEnvironment } from "expo-constants";
import type { AxiosRequestConfig } from "axios";
import { api } from "../api/client";
import { apiRoutes } from "../api/routes";
import LifeButton from "../components/LifeButton";
import type { AdProviderAdapter } from "./adapter";
import type { RewardedAdResult, RewardedAdStatus } from "./rewarded";
import type { BannerPlacement } from "./model";

const units = Platform.OS === "ios" ? {
  HOME: process.env.EXPO_PUBLIC_ADMOB_IOS_HOME_BANNER_UNIT_ID,
  SHOP: process.env.EXPO_PUBLIC_ADMOB_IOS_SHOP_BANNER_UNIT_ID,
  reward: process.env.EXPO_PUBLIC_ADMOB_IOS_REWARDED_UNIT_ID,
} : {
  HOME: process.env.EXPO_PUBLIC_ADMOB_ANDROID_HOME_BANNER_UNIT_ID,
  SHOP: process.env.EXPO_PUBLIC_ADMOB_ANDROID_SHOP_BANNER_UNIT_ID,
  reward: process.env.EXPO_PUBLIC_ADMOB_ANDROID_REWARDED_UNIT_ID,
};
export const nativeAdsSupported = Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;
const appId = Platform.OS === "ios" ? process.env.EXPO_PUBLIC_ADMOB_IOS_APP_ID : process.env.EXPO_PUBLIC_ADMOB_ANDROID_APP_ID;
export const liveAdsConfigured = Object.values(units).every(v => /^ca-app-pub-\d+\/\d+$/.test(v ?? "")
  && !v!.startsWith("ca-app-pub-3940256099942544/"))
  && /^ca-app-pub-\d+~\d+$/.test(appId ?? "") && !appId!.startsWith("ca-app-pub-3940256099942544~");
const testDevices = (process.env.EXPO_PUBLIC_ADMOB_TEST_DEVICE_IDS ?? "").split(",").map(v => v.trim()).filter(Boolean);
const testRewardUnit = process.env.EXPO_PUBLIC_ADMOB_TEST_REWARDED_UNIT_ID;
let scope: { userId: string | null; allowed: boolean; revision: number } = { userId: null, allowed: false, revision: 0 };
let consent: Promise<void> | null = null, initialization: Promise<unknown> | null = null;
let cancelRewarded: (() => void) | null = null;
const privacyListeners = new Set<() => void>();
export function setNativeAdScope(userId: string | null, allowed: boolean) {
  if (scope.userId !== userId) { consent = null; scope.revision++; }
  if (!allowed || scope.userId !== userId) cancelRewarded?.();
  scope = { ...scope, userId, allowed: allowed && nativeAdsSupported };
}
const assertAllowed = (revision: number) => { if (!scope.allowed || !scope.userId || scope.revision !== revision) throw new Error("Ad placement is no longer eligible."); };
const requestScope = () => ({ expectedUserId: scope.userId } as AxiosRequestConfig);
const testMode = () => process.env.EXPO_PUBLIC_ADS_MODE === "test";

async function ready(revision: number) {
  assertAllowed(revision);
  // Sample units cannot be configured with our SSV URL. Dedicated QA units require explicit test devices.
  if (testMode() && testRewardUnit && (!/^ca-app-pub-\d+\/\d+$/.test(testRewardUnit)
    || Object.values(units).includes(testRewardUnit) || !testDevices.length
    || testDevices.some(v => !/^[a-f\d]{32}$/i.test(v)))) throw new Error("SSV QA requires a dedicated unit and registered test-device IDs.");
  const sdk = await import("react-native-google-mobile-ads");
  assertAllowed(revision);
  if (!consent) {
    consent = sdk.AdsConsent.gatherConsent().then(info => {
      if (!info.canRequestAds) throw new Error("Consent does not permit ad requests.");
    }).catch(error => { consent = null; throw error; });
  }
  await consent;
  assertAllowed(revision);
  if (!(await sdk.AdsConsent.getConsentInfo()).canRequestAds) throw new Error("Consent does not permit ad requests.");
  assertAllowed(revision);
  if (!initialization) initialization = (async () => {
    await sdk.default().setRequestConfiguration({ testDeviceIdentifiers: testMode() ? ["EMULATOR", ...testDevices] : [] });
    assertAllowed(revision);
    return sdk.default().initialize();
  })().catch(error => { initialization = null; throw error; });
  await initialization;
  assertAllowed(revision);
  return sdk;
}

export function NativeBanner({ placement }: { placement: BannerPlacement }) {
  const [state, setState] = useState<{ sdk: typeof import("react-native-google-mobile-ads"); privacy: boolean } | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true; const revision = scope.revision;
    setState(null); setFailed(false);
    const invalidate = () => { if (active) { setState(null); setRefresh(x => x + 1); } };
    privacyListeners.add(invalidate);
    void ready(revision).then(async sdk => {
      const info = await sdk.AdsConsent.getConsentInfo(); assertAllowed(revision);
      if (active) setState({ sdk, privacy: info.privacyOptionsRequirementStatus === "REQUIRED" });
    }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; privacyListeners.delete(invalidate); };
  }, [refresh]);
  if (!state || !scope.allowed) return null;
  const { sdk } = state;
  return <View style={{ alignItems: "center", width: "100%" }}>
    {!failed ? <sdk.BannerAd unitId={testMode() ? sdk.TestIds.ADAPTIVE_BANNER : units[placement]!}
      size={sdk.BannerAdSize.ANCHORED_ADAPTIVE_BANNER} requestOptions={{ requestNonPersonalizedAdsOnly: true }}
      onAdFailedToLoad={() => setFailed(true)} /> : null}
    {state.privacy ? <LifeButton title="Ad privacy options" variant="secondary" onPress={() => {
      void sdk.AdsConsent.showPrivacyOptionsForm().finally(() => {
        consent = null; privacyListeners.forEach(fn => fn());
      }).catch(() => {});
    }} /> : null}
  </View>;
}

export const adMobAdapter: AdProviderAdapter = {
  loadBanner: () => null,
  async getRewardStatus() {
    assertAllowed(scope.revision);
    return (await api.get<RewardedAdStatus>(`${apiRoutes.adReward}?provider=ADMOB`, requestScope())).data;
  },
  async showRewarded() {
    const revision = scope.revision;
    const sdk = await ready(revision);
    const prepared = (await api.post<{ providerEventId: string; binding: string; adUnitId: string }>(apiRoutes.prepareAdReward,
      { provider: "ADMOB", platform: Platform.OS === "ios" ? "IOS" : "ANDROID" }, requestScope())).data;
    assertAllowed(revision);
    const unit = testMode() ? testRewardUnit || sdk.TestIds.REWARDED : units.reward!;
    if (prepared.adUnitId !== unit || !prepared.providerEventId.startsWith("adm:") || !prepared.binding) throw new Error("Rewarded unit/claim configuration mismatch.");
    const ad = sdk.RewardedAd.createForAdRequest(unit, { requestNonPersonalizedAdsOnly: true,
      serverSideVerificationOptions: { userId: prepared.binding, customData: prepared.providerEventId } });
    await new Promise<void>((resolve, reject) => {
      let earned = false, finished = false;
      const removers: (() => void)[] = [];
      const finish = (error?: Error) => {
        if (finished) return; finished = true; clearTimeout(timer); removers.forEach(remove => remove());
        cancelRewarded = null;
        if (error) reject(error); else resolve();
      };
      const timer = setTimeout(() => finish(new Error("Rewarded ad timed out.")), 120_000);
      cancelRewarded = () => finish(new Error("Ad placement is no longer eligible."));
      removers.push(ad.addAdEventListener(sdk.RewardedAdEventType.LOADED, () => {
        try { assertAllowed(revision); void ad.show().catch(() => finish(new Error("Could not show the ad."))); }
        catch { finish(new Error("Ad placement is no longer eligible.")); }
      }));
      // Only records completion for UI polling. Never posts a coin claim or updates a balance.
      removers.push(ad.addAdEventListener(sdk.RewardedAdEventType.EARNED_REWARD, () => { earned = true; }));
      removers.push(ad.addAdEventListener(sdk.AdEventType.CLOSED, () => finish(earned ? undefined : new Error("Ad closed without reward."))));
      removers.push(ad.addAdEventListener(sdk.AdEventType.ERROR, () => finish(new Error("Ad unavailable."))));
      try { assertAllowed(revision); ad.load(); }
      catch { finish(new Error("Ad unavailable.")); }
    });
    assertAllowed(revision);
    return { providerEventId: prepared.providerEventId, devSimulation: false };
  },
  async verifyRewardedCompletion(providerEventId) {
    const revision = scope.revision;
    for (let attempt = 0; attempt < 12; attempt++) {
      assertAllowed(revision);
      const result = (await api.get<RewardedAdStatus & { claimStatus: string; duplicate?: boolean }>(
        `${apiRoutes.adReward}?provider=ADMOB&claimId=${encodeURIComponent(providerEventId)}`, requestScope())).data;
      assertAllowed(revision);
      if (result.claimStatus === "GRANTED" && typeof result.duplicate === "boolean") return result as RewardedAdResult;
      if (result.rewardedAdsRemainingToday === 0) throw { response: { data: { error: { code: "AD_DAILY_LIMIT", details: result } } } };
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    throw new Error("Server verification is still pending. Retry the same claim.");
  },
};
