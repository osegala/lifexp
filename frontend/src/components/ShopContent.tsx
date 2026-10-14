import { useMemo, useState, type ReactNode } from "react";
import { ActivityIndicator, FlatList, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import type { ShopItem, ShopResponse } from "../types";
import { uiTheme as ui } from "../theme/theme";
import ShopItemCard from "./ShopItemCard";
import LifeButton from "./LifeButton";
import { ResourceCluster, ResourcePill } from "./ui/Indicators";
import { EmptyState, FilterChip, SurfaceCard, UiText } from "./ui/Primitives";

type Props = {
  shop: ShopResponse | null;
  loading: boolean;
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

export default function ShopContent(props: Props) {
  const { width, fontScale } = useWindowDimensions();
  const columns = width >= 360 && fontScale < 1.5 ? 2 : 1;
  const cardWidth = (Math.min(width, ui.size.contentMax) - ui.spacing.md * 2 - ui.spacing.sm * (columns - 1)) / columns;
  const [category, setCategory] = useState<string | null>(null);
  const items = props.shop?.items;
  const categories = useMemo(() => [...new Set((items ?? []).map(item => item.category))], [items]);
  const visible = useMemo(() => category === null ? items ?? [] : (items ?? []).filter(item => item.category === category), [items, category]);

  return <FlatList key={`shop-${columns}`} style={styles.screen} contentContainerStyle={styles.content}
    data={visible} numColumns={columns} keyExtractor={item => item.itemId} extraData={props.busyId}
    // FlatList counts rows when numColumns > 1. Keep the previous six-preview/four-item bounds.
    initialNumToRender={Math.ceil(INITIAL_SHOP_ITEMS / columns)} maxToRenderPerBatch={Math.ceil(SHOP_BATCH_ITEMS / columns)} windowSize={5}
    columnWrapperStyle={columns === 2 ? styles.columns : undefined}
    renderItem={({ item }) => <View style={[styles.cell, { width: cardWidth }]}>
      <ShopItemCard item={item} busy={props.busyId === item.itemId} onPurchase={props.onPurchase} />
    </View>}
    ListHeaderComponent={<View style={styles.headerContent}>
      <View style={styles.titleBlock}>
        <View style={styles.header}>
          <UiText variant="display" accessibilityRole="header" aria-level={1}>Shop</UiText>
          <ResourceCluster><ResourcePill resource="coins" value={props.shop?.player.coins ?? "—"} /></ResourceCluster>
        </View>
        <UiText variant="caption" style={styles.secondary}>Unlock new looks for your journey.</UiText>
      </View>
      <SurfaceCard style={styles.premium}>
        <View style={styles.premiumCopy}>
          <UiText variant="label">Evrenthia Premium</UiText>
          <UiText variant="caption" style={styles.secondary}>{props.entitlement.loading ? "Checking your plan…" : props.entitlement.premium
            ? "Premium · Ad-free" : "View Premium for subscription options."}</UiText>
        </View>
        <LifeButton tone="parchment" title="View Premium" variant="secondary" onPress={props.onPremium} />
      </SurfaceCard>
      {!!props.loadError && <SurfaceCard style={styles.notice}>
        <UiText accessibilityRole="alert" style={styles.error}>{props.loadError}</UiText>
        <LifeButton tone="parchment" title="Retry shop" variant="secondary" disabled={props.loading} onPress={props.onRetry} />
      </SurfaceCard>}
      {!!props.purchaseError && <UiText accessibilityRole="alert" style={styles.error}>{props.purchaseError}</UiText>}
      {props.loading && <View style={styles.loading} accessibilityLiveRegion="polite">
        <ActivityIndicator color={ui.colors.primary} accessibilityLabel="Loading shop" />
        <UiText variant="caption" style={styles.secondary}>{props.shop ? "Refreshing the catalog…" : "Loading the catalog…"}</UiText>
      </View>}
      <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={styles.filters} accessibilityLabel="Shop categories">
        <FilterChip label="All" selected={category === null} onPress={() => setCategory(null)} />
        {categories.map(value => <FilterChip key={value} label={value} selected={category === value} onPress={() => setCategory(value)} />)}
      </ScrollView>
    </View>}
    ListEmptyComponent={!props.loading && props.shop ? <EmptyState title={category === null ? "No items available" : "No items in this category"}
      description="Check back for new looks, or browse another category." /> : null}
    ListFooterComponent={<View style={styles.footer}>{props.banner}{props.rewarded}</View>} />;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: ui.colors.background },
  content: { width: "100%", maxWidth: ui.size.contentMax, alignSelf: "center", padding: ui.spacing.md, paddingBottom: ui.spacing.xl },
  headerContent: { gap: ui.spacing.md, marginBottom: ui.spacing.md },
  titleBlock: { gap: ui.spacing.xs },
  header: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: ui.spacing.sm },
  secondary: { color: ui.colors.secondaryText },
  premium: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: ui.spacing.sm, padding: ui.spacing.sm },
  premiumCopy: { flexGrow: 1, flexShrink: 1, gap: ui.spacing.xs },
  notice: { gap: ui.spacing.sm },
  error: { color: ui.colors.danger },
  loading: { flexDirection: "row", alignItems: "center", gap: ui.spacing.sm },
  filters: { gap: ui.spacing.sm, paddingVertical: ui.spacing.sm, paddingHorizontal: ui.spacing.sm },
  columns: { gap: ui.spacing.sm },
  cell: { marginBottom: ui.spacing.sm },
  footer: { gap: ui.spacing.md, marginTop: ui.spacing.md },
});
