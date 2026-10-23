import GameNotice from "./ui/GameNotice";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import FantasyMaterial from "./ui/FantasyMaterial";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ActivityIndicator, FlatList, ScrollView, StyleSheet, View, useWindowDimensions, type ViewToken } from "react-native";
import type { ShopItem, ShopResponse } from "../types";
import { uiTheme as ui } from "../theme/theme";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import PageBackground from "./ui/PageBackground";
import ShopItemCard from "./ShopItemCard";
import LifeButton from "./LifeButton";
import { ResourceCluster, ResourcePill } from "./ui/Indicators";
import { EmptyState, FilterChip, UiPressable, UiText } from "./ui/Primitives";

import { prefetchShopThumbnails } from "../avatar/prefetch";

type Props = {
  shop: ShopResponse | null;
  loading: boolean;
  refreshing?: boolean;
  busyId: string | null;
  loadError: string;
  purchaseError: string;
  entitlement: { loading: boolean; premium: boolean };
  onPurchase: (item: ShopItem) => void;
  onRetry: () => void;
  onPremium: () => void;
  banner: ReactNode;
  rewarded: ReactNode;
};
const INITIAL_SHOP_ITEMS = 6;
const SHOP_BATCH_ITEMS = 4;
const categoryLabels: Record<string, string> = { tunic: "Outfits", hat: "Hats", pants: "Bottoms", boots: "Boots", pet: "Pets", aura: "Auras", background: "Scenes" };

export default function ShopContent(props: Props) {
  const insets = useSafeAreaInsets();
  const { width, fontScale } = useWindowDimensions();
  const columns = width >= 360 && fontScale < 1.5 ? 2 : 1;
  const cardWidth = (Math.min(width, ui.size.contentMax) - ui.spacing.md * 2 - ui.spacing.sm * (columns - 1)) / columns;
  const [category, setCategory] = useState<string | null>(null);
  const items = props.shop?.items;
  const categories = useMemo(() => [...new Set((items ?? []).map(item => item.category))], [items]);
  const visible = useMemo(() => category === null ? items ?? [] : (items ?? []).filter(item =>
    category === "__premium__" ? item.requiresPremium === true : item.category === category), [items, category]);

  useEffect(() => { void prefetchShopThumbnails(visible.slice(0, INITIAL_SHOP_ITEMS)); }, [visible]);
  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken<ShopItem>[] }) => {
    void prefetchShopThumbnails(viewableItems.filter(token => token.isViewable).map(token => token.item));
  }).current;

  return <PageBackground><FlatList key={`shop-${columns}`} style={styles.screen} contentContainerStyle={[styles.content, { paddingTop: insets.top + ui.spacing.md }]}
    onViewableItemsChanged={onViewableItemsChanged} data={visible} numColumns={columns} keyExtractor={item => item.itemId} extraData={props.busyId}
    // FlatList counts rows when numColumns > 1. Keep the previous six-preview/four-item bounds.
    initialNumToRender={Math.ceil(INITIAL_SHOP_ITEMS / columns)} maxToRenderPerBatch={Math.ceil(SHOP_BATCH_ITEMS / columns)} windowSize={5}
    columnWrapperStyle={columns === 2 ? styles.columns : undefined}
    renderItem={({ item }) => <View style={[styles.cell, { width: cardWidth }]}>
      <ShopItemCard item={item} busy={props.busyId === item.itemId} onPurchase={props.onPurchase} onPremium={props.onPremium}
        premiumAvailable={!props.entitlement.loading && props.entitlement.premium} />
    </View>}
    ListHeaderComponent={<View style={styles.headerContent}>
      <View style={styles.titleBlock}>
        <View style={styles.header}>
          <UiText variant="display" accessibilityRole="header" aria-level={1}>Shop</UiText>
          <ResourceCluster><ResourcePill tone="hud" resource="coins" value={props.shop?.player.coins ?? "—"} /></ResourceCluster>
        </View>
        <UiText variant="caption" style={styles.secondary}>Unlock new looks for your journey.</UiText>
      </View>
      <UiPressable accessibilityRole="button" accessibilityLabel="View Premium" onPress={props.onPremium} style={styles.premium}>
        <FantasyMaterial kind="panel" opacity={0.85} />
        <MaterialCommunityIcons name="crown-outline" size={22} color={ui.colors.coin} accessible={false} />
        <View style={styles.premiumCopy}>
          <UiText variant="caption">Evrenthia Premium</UiText>
          <UiText variant="caption" style={styles.secondary}>{props.entitlement.loading ? "Checking your plan…" : props.entitlement.premium
            ? "Premium · Ad-free" : "Explore subscription options"}</UiText>
        </View>
        <MaterialCommunityIcons name="chevron-right" size={18} color={ui.colors.secondaryText} accessible={false} />
      </UiPressable>
      {!!props.loadError && <GameNotice title="Shop unavailable" message={props.loadError} variant="error" style={styles.notice}>
        <LifeButton tone="parchment" title="Retry shop" variant="secondary" disabled={props.loading} onPress={props.onRetry} />
      </GameNotice>}
      {!!props.purchaseError && <GameNotice title="Purchase not completed" message={props.purchaseError} variant="error" />}
      {(props.loading || props.refreshing) && <View style={styles.loading} accessibilityLiveRegion="polite">
        <ActivityIndicator color={ui.colors.primary} accessibilityLabel="Loading shop" />
        <UiText variant="caption" style={styles.secondary}>{props.shop ? "Refreshing the catalog…" : "Loading the catalog…"}</UiText>
      </View>}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters} accessibilityLabel="Shop categories">
        <FilterChip label="All" selected={category === null} onPress={() => setCategory(null)} />
        <FilterChip label="Premium" selected={category === "__premium__"} onPress={() => setCategory("__premium__")} />
        {categories.map(value => <FilterChip key={value} label={categoryLabels[value] ?? value} selected={category === value} onPress={() => setCategory(value)} />)}
      </ScrollView>
    </View>}
    ListEmptyComponent={!props.loading && props.shop ? <EmptyState title={category === null ? "No items available" : "No items in this category"}
      description="Check back for new looks, or browse another category." /> : null}
    ListFooterComponent={<View style={styles.footer}>{props.banner}{props.rewarded}</View>} /></PageBackground>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "transparent" },
  content: { width: "100%", maxWidth: ui.size.contentMax, alignSelf: "center", padding: ui.spacing.md, paddingBottom: ui.spacing.xl },
  headerContent: { gap: 8, marginBottom: 8 },
  titleBlock: { gap: ui.spacing.xs },
  header: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: ui.spacing.sm },
  secondary: { color: ui.colors.secondaryText },
  premium: { flexDirection: "row", alignItems: "center", gap: ui.spacing.sm, minHeight: 54, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: "transparent", borderWidth: 0, borderRadius: 4 },
  premiumCopy: { flex: 1, gap: 0 },
  notice: { gap: ui.spacing.sm },
  error: { color: ui.colors.danger },
  loading: { flexDirection: "row", alignItems: "center", gap: ui.spacing.sm },
  filters: { gap: ui.spacing.xs, paddingVertical: ui.spacing.xs },
  columns: { gap: ui.spacing.sm },
  cell: { marginBottom: ui.spacing.sm },
  footer: { gap: ui.spacing.md, marginTop: ui.spacing.md },
});
