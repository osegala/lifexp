import { showGameNotice } from "../../src/feedback/notices";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";
import type { AxiosRequestConfig } from "axios";
import { api, apiError } from "../../src/api/client";
import { apiRoutes } from "../../src/api/routes";
import ShopContent from "../../src/components/ShopContent";
import { useAuth } from "../../src/context/AuthContext";
import type { ShopItem } from "../../src/types";
import { useEntitlements } from "../../src/entitlements/useEntitlements";
import { BannerAdPlacement, RewardedAdButton } from "../../src/ads/Ads";
import { playerCache } from "../../src/cache/playerData";
import { SupersededCacheRead } from "../../src/cache/PlayerCache";

export default function ShopScreen() {
  const { user, refreshUser } = useAuth();
  const userId = user?.id;
  const [shop, setShop] = useState(() => userId == null ? null : playerCache.peek(userId, "shop"));
  const entitlement = useEntitlements();
  const hasView = useRef(!!shop), loadVersion = useRef(0);
  const [loading, setLoading] = useState(!shop);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState("");
  const [purchaseError, setPurchaseError] = useState("");

  const loadShop = useCallback(async () => {
    if (userId == null) return;
    const version = ++loadVersion.current;
    setLoading(!hasView.current);
    setRefreshing(true);
    const hydration = playerCache.hydrate(userId, "shop");
    void hydration.then(cached => {
      if (cached && version === loadVersion.current && !hasView.current) {
        hasView.current = true; setShop(cached); setLoading(false);
      }
    });
    try {
      const data = await playerCache.refresh(userId, "shop", async () =>
        (await api.get(apiRoutes.shop, { expectedUserId: String(userId) } as AxiosRequestConfig)).data);
      if (version !== loadVersion.current) return;
      hasView.current = true;
      setShop(data);
      setLoadError("");
      await refreshUser();
    } catch (error) {
      await hydration;
      if (version !== loadVersion.current || error instanceof SupersededCacheRead) return;
      const message = apiError(error, "Could not load the shop.").message;
      setLoadError(message);
      showGameNotice("Shop", message, "error");
    } finally {
      if (version === loadVersion.current) { setLoading(false); setRefreshing(false); }
    }
  }, [refreshUser, userId]);

  useFocusEffect(useCallback(() => {
    // Pick up confirmed changes made on another tab before the background read.
    const cached = userId == null ? null : playerCache.peek(userId, "shop");
    if (cached) { hasView.current = true; setShop(cached); setLoading(false); }
    void loadShop();
    return () => { loadVersion.current++; };
  }, [loadShop, userId]));

  const purchase = useCallback(async (item: ShopItem) => {
    if (userId == null) return;
    try {
      setBusyId(item.itemId);
      setPurchaseError("");
      loadVersion.current++;
      playerCache.invalidate(userId);
      const current = playerCache.accountCurrent(userId);
      await api.post(apiRoutes.shopPurchase, { itemId: item.itemId }, { expectedUserId: String(userId) } as AxiosRequestConfig);
      if (!current()) return;
      // Re-read server purchase flags, ownership and balance; never calculate them locally.
      playerCache.invalidate(userId);
      await loadShop();
    } catch (error) {
      const failure = apiError(error, "Could not purchase this item.");
      if (failure.code === "PREMIUM_REQUIRED") {
        await refreshUser();
        await loadShop();
      }
      const message = failure.message;
      setPurchaseError(message);
      showGameNotice("Shop", message, "error");
    } finally {
      setBusyId(null); setRefreshing(false);
    }
  }, [loadShop, userId, refreshUser]);

  return <ShopContent shop={shop} entitlement={entitlement} loading={loading} refreshing={refreshing} busyId={busyId}
    loadError={loadError} purchaseError={purchaseError} onPurchase={purchase} onRetry={() => void loadShop()}
    onPremium={() => router.push("/premium")}
    banner={<BannerAdPlacement placement="SHOP" />}
    rewarded={<RewardedAdButton onReward={result => {
      // Coins here are the server-confirmed ad result, not an optimistic reward.
      setShop(current => current ? { ...current, player: { ...current.player, coins: result.coins } } : current);
      if (userId != null) {
        playerCache.invalidate(userId, ["shop", "profile"]);
        const cached = playerCache.peek(userId, "shop");
        if (cached) playerCache.set(userId, "shop", { ...cached, player: { ...cached.player, coins: result.coins } });
        else void loadShop(); // A reward may finish before the first catalog read.
      }
      void refreshUser();
    }} />} />;
}
