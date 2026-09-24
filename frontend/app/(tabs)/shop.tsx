import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { api, apiError } from "../../src/api/client";
import { apiRoutes } from "../../src/api/routes";
import { getCosmeticPreviewCrop, getCosmeticPreviewSource } from "../../src/avatar/assetRegistry";
import { avatarAssetKey } from "../../src/avatar/inventory";
import CosmeticImage from "../../src/components/CosmeticImage";
import LifeCard from "../../src/components/LifeCard";
import { useAuth } from "../../src/context/AuthContext";
import { colors, radius, spacing } from "../../src/theme/theme";
import type { EntitlementResponse, ShopItem, ShopResponse } from "../../src/types";
import type { CosmeticType } from "../../src/types/avatar";

const CATEGORY_TYPES: Record<string, CosmeticType> = {
  tunic: "TOP", tunics: "TOP", pants: "BOTTOM", boots: "BOOTS", boot: "BOOTS",
  hat: "HAT", hats: "HAT", hair: "HAIR", hairstyle: "HAIR", hairstyles: "HAIR",
  background: "BACKGROUND", backgrounds: "BACKGROUND", pet: "PET", pets: "PET",
  aura: "AURA", auras: "AURA",
};

export default function ShopScreen() {
  const { refreshUser } = useAuth();
  const [shop, setShop] = useState<ShopResponse | null>(null);
  const [entitlement, setEntitlement] = useState<EntitlementResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadShop = useCallback(async () => {
    try {
      setLoading(true);
      const [shopResponse, entitlementResponse] = await Promise.all([
        api.get<ShopResponse>(apiRoutes.shop),
        api.get<EntitlementResponse>(apiRoutes.entitlements),
      ]);
      setShop(shopResponse.data);
      setEntitlement(entitlementResponse.data);
      await refreshUser();
    } catch (error) {
      Alert.alert("Shop", apiError(error, "Could not load the shop.").message);
    } finally {
      setLoading(false);
    }
  }, [refreshUser]);

  useFocusEffect(useCallback(() => { void loadShop(); }, [loadShop]));

  async function purchase(item: ShopItem) {
    try {
      setBusyId(item.itemId);
      await api.post(apiRoutes.shopPurchase, { itemId: item.itemId });
      await loadShop();
    } catch (error) {
      Alert.alert("Shop", apiError(error, "Could not purchase this item.").message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View>
          <Text accessibilityRole="header" style={styles.title}>Shop</Text>
          <Text style={styles.muted}>Catalog prices and unlock requirements are set by Evrenthia.</Text>
        </View>
        <View style={styles.coinBadge}>
          <MaterialCommunityIcons name="gold" color={colors.accent} size={22} />
          <Text style={styles.coinText}>{shop?.player.coins ?? 0}</Text>
        </View>
      </View>

      <LifeCard compact>
        <Text style={styles.cardTitle}>Evrenthia Premium</Text>
        <Text style={styles.muted}>
          {entitlement?.plan === "PREMIUM"
            ? `Premium ${entitlement.subscriptionStatus.toLowerCase()}`
            : "Premium purchasing is not available in this app version."}
        </Text>
      </LifeCard>

      {loading && !shop ? <ActivityIndicator color={colors.primary} /> : null}
      {(shop?.items ?? []).map((item) => (
        <ShopItemRow key={item.itemId} item={item} busy={busyId === item.itemId} onPurchase={() => void purchase(item)} />
      ))}
    </ScrollView>
  );
}

function ShopItemRow({ item, busy, onPurchase }: { item: ShopItem; busy: boolean; onPurchase: () => void }) {
  const type = CATEGORY_TYPES[item.category.toLowerCase()] ?? "TOP";
  const cosmetic = { id: item.itemId, type, imageUrl: avatarAssetKey(item.assetKey) };
  const preview = getCosmeticPreviewSource(cosmetic);
  const label = item.owned
    ? "Owned"
    : item.status === "LOCKED"
      ? "Locked"
      : item.status === "NOT_ENOUGH_COINS"
        ? "Need coins"
        : busy ? "Buying…" : "Buy";

  return (
    <LifeCard compact style={styles.item}>
      <View style={styles.preview}>
        {preview ? <CosmeticImage source={preview} crop={getCosmeticPreviewCrop(cosmetic)} style={styles.image} />
          : <MaterialCommunityIcons name="hanger" size={30} color={colors.mutedText} />}
      </View>
      <View style={styles.itemCopy}>
        <Text style={styles.itemName}>{item.name}</Text>
        <Text style={styles.muted}>{item.effectivePrice} coins · level {item.effectiveRequiredLevel}</Text>
        {item.requiredAchievement ? <Text style={styles.muted}>Requires {item.requiredAchievement}</Text> : null}
      </View>
      <Pressable onPress={onPurchase} disabled={!item.canPurchase || busy} style={[styles.buyButton, (!item.canPurchase || busy) && styles.disabled]}>
        <Text style={styles.buyText}>{label}</Text>
      </Pressable>
    </LifeCard>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: 120, gap: spacing.md },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: spacing.md },
  title: { color: colors.text, fontSize: 30, fontWeight: "700" },
  muted: { color: colors.mutedText, marginTop: 3 },
  coinBadge: { flexDirection: "row", gap: spacing.xs, alignItems: "center", backgroundColor: colors.card, borderRadius: radius.pill, padding: spacing.sm },
  coinText: { color: colors.text, fontWeight: "800" },
  cardTitle: { color: colors.text, fontSize: 18, fontWeight: "700" },
  item: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  preview: { width: 72, height: 72, alignItems: "center", justifyContent: "center", backgroundColor: colors.cardLight, borderRadius: radius.md, overflow: "hidden" },
  image: { width: 68, height: 68 },
  itemCopy: { flex: 1 },
  itemName: { color: colors.text, fontSize: 17, fontWeight: "700" },
  buyButton: { minWidth: 82, minHeight: 44, alignItems: "center", justifyContent: "center", borderRadius: radius.md, backgroundColor: colors.primary },
  buyText: { color: colors.background, fontWeight: "800" },
  disabled: { opacity: 0.45 },
});
