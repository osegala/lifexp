import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";
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
import { getCosmeticPreviewCrop, getCosmeticPreviewSource } from "../../src/avatar/assetRegistry";
import CosmeticImage from "../../src/components/CosmeticImage";
import LifeButton from "../../src/components/LifeButton";
import LifeCard from "../../src/components/LifeCard";
import { useAuth } from "../../src/context/AuthContext";
import { colors, radius, spacing } from "../../src/theme/theme";
import { ShopItem } from "../../src/types";
import { CosmeticType } from "../../src/types/avatar";

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>["name"];
type PreviewType = CosmeticType;

const SHOP_CATEGORIES: { title: string; type: CosmeticType }[] = [
  { title: "Tops & Dresses", type: "TOP" },
  { title: "Bottoms", type: "BOTTOM" },
  { title: "Boots", type: "BOOTS" },
  { title: "Hats", type: "HAT" },
  { title: "Hair", type: "HAIR" },
  { title: "Capes", type: "CAPE" },
  { title: "Weapons", type: "WEAPON" },
  { title: "Shields", type: "SHIELD" },
  { title: "Scenes", type: "BACKGROUND" },
  { title: "Pets", type: "PET" },
  { title: "Auras", type: "AURA" },
];

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
  const [selectedType, setSelectedType] = useState<CosmeticType>("TOP");
  const scrollView = useRef<ScrollView>(null);
  const categoryOffset = useRef(0);
  const categories = SHOP_CATEGORIES.filter(category => items.some(item => item.type === category.type));
  const activeCategory = categories.find(category => category.type === selectedType)
    ?? categories[0] ?? SHOP_CATEGORIES[0];
  const visibleItems = items.filter(item => item.type === activeCategory.type);

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
      ref={scrollView}
      style={styles.container}
      contentContainerStyle={styles.content}
      alwaysBounceVertical={false}
      bounces={false}
      overScrollMode="never"
      stickyHeaderIndices={[1]}
    >
      <View
        style={styles.shopIntro}
        onLayout={({ nativeEvent: { layout } }) => {
          categoryOffset.current = layout.y + layout.height + spacing.lg;
        }}
      >
        <View style={styles.titleRow}>
          <View style={styles.titleCopy}>
            <Text style={styles.title}>Shop</Text>
            <Text style={styles.subtitle}>Choose a category to browse.</Text>
          </View>
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
      </View>

      <View style={styles.categoryPanel}>
        <View accessibilityRole="tablist" accessibilityLabel="Shop categories" style={styles.categoryTabs}>
          {categories.map(category => {
            const selected = category.type === activeCategory.type;
            return (
              <Pressable
                key={category.type}
                accessibilityRole="tab"
                accessibilityLabel={category.title}
                accessibilityState={{ selected }}
                aria-selected={selected}
                onPress={() => {
                  setSelectedType(category.type);
                  scrollView.current?.scrollTo({ y: categoryOffset.current, animated: false });
                }}
                style={[styles.categoryTab, selected && styles.selectedCategoryTab]}
              >
                <MaterialCommunityIcons
                  name={iconForType(category.type)}
                  size={18}
                  color={selected ? colors.background : colors.mutedText}
                />
                <Text style={[styles.categoryText, selected && styles.selectedCategoryText]}>{category.title}</Text>
              </Pressable>
            );
          })}
        </View>
        <View style={styles.categoryHeading}>
          <Text accessibilityRole="header" style={styles.cardTitle}>{activeCategory.title}</Text>
          <Text style={styles.itemMeta}>{visibleItems.length} {visibleItems.length === 1 ? "item" : "items"}</Text>
        </View>
      </View>

      <View style={styles.itemList}>
        {visibleItems.map((item) => (
          <ShopItemRow
            key={item.key}
            item={item}
            busy={busyKey === item.key}
            onPurchase={() => purchase(item)}
          />
        ))}
        {visibleItems.length === 0 && <Text style={styles.emptyText}>No items in this category yet.</Text>}
      </View>
    </ScrollView>
  );
}

function ShopItemRow({
  item,
  busy,
  onPurchase,
}: {
  item: ShopItem;
  busy: boolean;
  onPurchase: () => void;
}) {
  const previewSource = getCosmeticPreviewSource({
    id: item.cosmeticId,
    type: item.type as PreviewType,
    imageUrl: item.imageUrl,
  });

  return (
    <View style={styles.itemRow}>
      <View style={styles.itemIcon}>
        {previewSource ? (
          <CosmeticImage source={previewSource} style={styles.itemPreviewImage}
            crop={getCosmeticPreviewCrop({ id: item.cosmeticId, type: item.type as PreviewType, imageUrl: item.imageUrl })} />
        ) : (
          <MaterialCommunityIcons
            name={iconForType(item.type)}
            size={24}
            color={item.premiumOnly ? colors.primary : colors.accent}
          />
        )}
      </View>
      <View style={styles.itemCopy}>
        <View style={styles.itemNameRow}>
          <Text style={styles.itemName}>{item.name}</Text>
          {item.premiumOnly && <Text style={styles.premiumTag}>Pass</Text>}
        </View>
        <Text style={styles.itemMeta}>
          {item.owned ? "Owned" : `${item.priceCoins} coins`}
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={item.owned ? `${item.name}, owned` : `Buy ${item.name}`}
        onPress={onPurchase}
        disabled={item.owned || busy}
        style={[styles.buyButton, item.owned && styles.buyButtonDisabled]}
      >
        <Text
          style={[
            styles.buyButtonText,
            item.owned && styles.buyButtonTextDisabled,
          ]}
        >
          {item.owned ? "Owned" : busy ? "..." : "Buy"}
        </Text>
      </Pressable>
    </View>
  );
}

function iconForType(type: string): IconName {
  if (type === "HAT") {
    return "wizard-hat";
  }
  if (type === "HAIR") {
    return "face-man-shimmer";
  }
  if (type === "TOP") {
    return "tshirt-crew";
  }
  if (type === "BOTTOM") {
    return "human-male";
  }
  if (type === "BOOTS") {
    return "shoe-formal";
  }
  if (type === "CAPE") {
    return "shield-half-full";
  }
  if (type === "WEAPON") {
    return "sword";
  }
  if (type === "SHIELD") {
    return "shield";
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
  shopIntro: { gap: spacing.lg },
  title: { color: colors.text, fontSize: 30, fontWeight: "700" },
  titleCopy: { flex: 1 },
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
    flexWrap: "wrap",
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
  categoryPanel: {
    backgroundColor: colors.background,
    paddingVertical: spacing.sm,
    gap: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  categoryTabs: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  categoryTab: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    minHeight: 44,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.cardLight,
  },
  selectedCategoryTab: { backgroundColor: colors.accent, borderColor: colors.accent },
  categoryText: { color: colors.mutedText, fontSize: 13, fontWeight: "700" },
  selectedCategoryText: { color: colors.background },
  categoryHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  emptyText: { color: colors.mutedText, paddingVertical: spacing.lg, textAlign: "center" },
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
    width: 72,
    height: 72,
    borderRadius: radius.md,
    backgroundColor: colors.cardLight,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  itemPreviewImage: {
    width: "94%",
    height: "94%",
  },
  itemCopy: { flex: 1, minWidth: 0 },
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
