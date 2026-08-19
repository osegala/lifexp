import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { api } from "../../src/api/client";
import LifeButton from "../../src/components/LifeButton";
import LifeCard from "../../src/components/LifeCard";
import { useAuth } from "../../src/context/AuthContext";
import { colors, radius, spacing } from "../../src/theme/theme";
import { ShopItem } from "../../src/types";

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>["name"];

type Subscription = {
  active: boolean;
  productId: string;
  title: string;
  description: string;
  xpMultiplier: number;
};

export default function ShopScreen() {
  const { user, refreshUser } = useAuth();
  const [items, setItems] = useState<ShopItem[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const loadShop = useCallback(async () => {
    try {
      setLoading(true);
      const [shopRes, subscriptionRes] = await Promise.all([
        api.get<ShopItem[]>("/shop"),
        api.get<Subscription>("/subscription"),
      ]);
      setItems(shopRes.data);
      setSubscription(subscriptionRes.data);
      await refreshUser();
    } catch (error) {
      console.log("Shop load error:", error);
      Alert.alert("Error", "Could not load the shop.");
    } finally {
      setLoading(false);
    }
  }, [refreshUser]);

  useFocusEffect(
    useCallback(() => {
      loadShop();
    }, [loadShop]),
  );

  async function purchase(item: ShopItem) {
    try {
      setBusyKey(item.key);
      await api.post(`/shop/cosmetics/${item.cosmeticId}/purchase`);
      await loadShop();
    } catch (error) {
      console.log("Purchase error:", error);
      Alert.alert("Shop", "This item is not available yet.");
    } finally {
      setBusyKey(null);
    }
  }

  async function activatePass() {
    try {
      setBusyKey("pass");
      const response = await api.post<Subscription>("/subscription/dev/activate");
      setSubscription(response.data);
      await refreshUser();
      await loadShop();
    } catch (error) {
      console.log("Pass activation error:", error);
      Alert.alert("Error", "Could not activate the pass.");
    } finally {
      setBusyKey(null);
    }
  }

  if (loading && items.length === 0) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Stocking the market...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      alwaysBounceVertical={false}
      bounces={false}
      overScrollMode="never"
    >
      <View style={styles.titleRow}>
        <View style={styles.coinBadge}>
          <MaterialCommunityIcons name="gold" color={colors.accent} size={22} />
          <Text style={styles.coinText}>{user?.coins ?? 0}</Text>
        </View>
      </View>

      <LifeCard compact style={styles.passCard}>
        <View style={styles.passIcon}>
          <MaterialCommunityIcons name="ticket-percent" size={28} color={colors.text} />
        </View>
        <View style={styles.passCopy}>
          <Text style={styles.cardTitle}>{subscription?.title ?? "LifeXP Pass"}</Text>
          <Text style={styles.cardText}>
            {subscription?.description ??
              "Premium cosmetics and a progression boost for the long road."}
          </Text>
          <Text style={styles.passMeta}>
            {subscription?.active
              ? "Active"
              : `${subscription?.xpMultiplier ?? 1.5}x XP boost preview`}
          </Text>
        </View>
        <LifeButton
          title={subscription?.active ? "Active" : busyKey === "pass" ? "..." : "Try Pass"}
          onPress={activatePass}
          disabled={subscription?.active || busyKey === "pass"}
        />
      </LifeCard>

      <View style={styles.itemList}>
        {items.map((item) => (
          <View key={item.key} style={styles.itemRow}>
            <View style={styles.itemIcon}>
              <MaterialCommunityIcons
                name={iconForType(item.type)}
                size={24}
                color={item.premiumOnly ? colors.primary : colors.accent}
              />
            </View>
            <View style={styles.itemCopy}>
              <View style={styles.itemNameRow}>
                <Text style={styles.itemName}>{item.name}</Text>
                {item.premiumOnly && (
                  <Text style={styles.premiumTag}>Pass</Text>
                )}
              </View>
              <Text style={styles.itemMeta}>
                {item.owned ? "Owned" : `${item.priceCoins} coins`}
              </Text>
            </View>
            <Pressable
              onPress={() => purchase(item)}
              disabled={item.owned || busyKey === item.key}
              style={[
                styles.buyButton,
                item.owned && styles.buyButtonDisabled,
              ]}
            >
              <Text
                style={[
                  styles.buyButtonText,
                  item.owned && styles.buyButtonTextDisabled,
                ]}
              >
                {item.owned ? "Owned" : busyKey === item.key ? "..." : "Buy"}
              </Text>
            </Pressable>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

function iconForType(type: string): IconName {
  if (type === "HAT") {
    return "wizard-hat";
  }
  if (type === "OUTFIT") {
    return "hanger";
  }
  if (type === "BACKGROUND") {
    return "image";
  }
  if (type === "PET") {
    return "paw";
  }
  return "star-four-points";
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loadingScreen: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
  },
  loadingText: { color: colors.mutedText, fontWeight: "600" },
  content: {
    padding: spacing.lg,
    paddingBottom: 120,
    gap: spacing.lg,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  title: { color: colors.text, fontSize: 30, fontWeight: "700" },
  subtitle: { color: colors.mutedText, fontSize: 16, marginTop: 2 },
  coinBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.cardLight,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  coinText: { color: colors.text, fontWeight: "700" },
  passCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  passIcon: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    backgroundColor: colors.primaryDark,
    alignItems: "center",
    justifyContent: "center",
  },
  passCopy: { flex: 1, minWidth: 150 },
  cardTitle: { color: colors.text, fontSize: 18, fontWeight: "700" },
  cardText: { color: colors.mutedText, lineHeight: 20, marginTop: 3 },
  passMeta: { color: colors.accent, fontWeight: "700", marginTop: spacing.xs },
  itemList: { gap: spacing.sm },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  itemIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.cardLight,
    alignItems: "center",
    justifyContent: "center",
  },
  itemCopy: { flex: 1, minWidth: 130 },
  itemNameRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  itemName: { color: colors.text, fontSize: 16, fontWeight: "700" },
  premiumTag: {
    color: colors.text,
    backgroundColor: colors.primaryDark,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    fontSize: 11,
    fontWeight: "700",
    overflow: "hidden",
  },
  itemMeta: { color: colors.mutedText, marginTop: 3, fontWeight: "600" },
  buyButton: {
    minWidth: 64,
    minHeight: 42,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.md,
  },
  buyButtonDisabled: {
    backgroundColor: colors.cardLight,
  },
  buyButtonText: { color: colors.text, fontWeight: "700" },
  buyButtonTextDisabled: { color: colors.mutedText },
});
