import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Alert } from "react-native";

import { api, apiError } from "../../src/api/client";
import { apiRoutes } from "../../src/api/routes";
import ShopContent from "../../src/components/ShopContent";
import { useAuth } from "../../src/context/AuthContext";
import type { ShopItem, ShopResponse } from "../../src/types";
import { useEntitlements } from "../../src/entitlements/useEntitlements";
import { BannerAdPlacement, RewardedAdButton } from "../../src/ads/Ads";

export default function ShopScreen() {
  const { refreshUser } = useAuth();
  const [shop, setShop] = useState<ShopResponse | null>(null);
  const entitlement = useEntitlements();
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState("");
  const [purchaseError, setPurchaseError] = useState("");

  const loadShop = useCallback(async () => {
    try {
      setLoading(true);
      const shopResponse = await api.get<ShopResponse>(apiRoutes.shop);
      setShop(shopResponse.data);
      setLoadError("");
      await refreshUser();
    } catch (error) {
      const message = apiError(error, "Could not load the shop.").message;
      setLoadError(message);
      Alert.alert("Shop", message);
    } finally {
      setLoading(false);
    }
  }, [refreshUser]);

  useFocusEffect(useCallback(() => { void loadShop(); }, [loadShop]));

  const purchase = useCallback(async (item: ShopItem) => {
    try {
      setBusyId(item.itemId);
      setPurchaseError("");
      await api.post(apiRoutes.shopPurchase, { itemId: item.itemId });
      await loadShop();
    } catch (error) {
      const message = apiError(error, "Could not purchase this item.").message;
      setPurchaseError(message);
      Alert.alert("Shop", message);
    } finally {
      setBusyId(null);
    }
  }, [loadShop]);

  return <ShopContent shop={shop} entitlement={entitlement} loading={loading} busyId={busyId}
    loadError={loadError} purchaseError={purchaseError} onPurchase={purchase} onRetry={() => void loadShop()}
    onPremium={() => router.push("/premium")}
    banner={<BannerAdPlacement placement="SHOP" />}
    rewarded={<RewardedAdButton onReward={result => {
      setShop(current => current ? { ...current, player: { ...current.player, coins: result.coins } } : current);
      void refreshUser();
    }} />} />;
}
