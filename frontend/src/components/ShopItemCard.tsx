import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { memo } from "react";
import { StyleSheet, View } from "react-native";
import type { ShopItem } from "../types";
import { getCosmeticPreviewCrop, getCosmeticPreviewSource } from "../avatar/assetRegistry";
import { catalogCosmeticReference } from "../avatar/inventory";
import { uiTheme as ui } from "../theme/theme";
import CosmeticImage from "./CosmeticImage";
import { BadgePill, ResourcePill } from "./ui/Indicators";
import { SurfaceCard, UiPressable, UiText } from "./ui/Primitives";

// Catalog flags, effective price and ownership are supplied by the server.
export default memo(function ShopItemCard({ item, busy, onPurchase }: {
  item: ShopItem; busy: boolean; onPurchase: (item: ShopItem) => void;
}) {
  const cosmetic = catalogCosmeticReference(item);
  const preview = cosmetic ? getCosmeticPreviewSource(cosmetic) : undefined;
  const locked = item.status === "LOCKED";
  const label = item.owned ? "Owned" : locked ? "Locked" : item.status === "NOT_ENOUGH_COINS" ? "Need coins" : busy ? "Buying…" : "Buy";
  const requirement = item.achievementRequirement;
  const progressUnit = requirement?.type === "TASKS_COMPLETED" ? "tasks" : requirement?.type === "LEVEL_REACHED" ? "levels"
    : requirement?.type === "DAILY_GOALS_COMPLETED" ? "daily goals" : "progress";
  const disabled = !item.canPurchase || busy;
  return <SurfaceCard style={[styles.card, item.owned && styles.owned]}>
    <View style={styles.preview} accessible accessibilityLabel={`${item.name} preview`}>
      {preview && cosmetic ? <CosmeticImage cached source={preview} crop={getCosmeticPreviewCrop(cosmetic)} style={styles.image} />
        : <MaterialCommunityIcons name="hanger" size={ui.size.icon} color={ui.colors.secondaryText} accessible={false} aria-hidden />}
    </View>
    <UiText variant="label" style={styles.name}>{item.name}</UiText>
    <View style={styles.badges}>
      {item.owned ? <BadgePill label="Owned" tone="success" /> : <ResourcePill resource="coins" value={item.effectivePrice} />}
      {item.requiresPremium && <BadgePill label="Premium" tone={item.owned || item.premiumRequirementSatisfied ? "neutral" : "locked"} />}
    </View>
    {locked && <View style={styles.requirement}>
      <BadgePill label="Locked" tone="locked" />
      {item.requiresPremium && !item.premiumRequirementSatisfied && <UiText variant="caption" style={styles.secondary}>Evrenthia Premium required</UiText>}
      {requirement ? <>
        <UiText variant="caption" style={styles.secondary}>Complete &quot;{requirement.name}&quot;</UiText>
        <UiText variant="caption" style={styles.secondary}>{requirement.currentValue} / {requirement.requiredValue} {progressUnit}</UiText>
      </> : !item.requiresPremium || item.premiumRequirementSatisfied ?
        <UiText variant="caption" style={styles.secondary}>Reach level {item.effectiveRequiredLevel}</UiText> : null}
    </View>}
    {!locked && requirement && <UiText variant="caption" style={styles.secondary}>Unlocked by {requirement.name}</UiText>}
    {locked || item.owned ? null : <UiPressable accessibilityRole="button" accessibilityLabel={`${label}: ${item.name}`}
      accessibilityHint={`${item.effectivePrice} coins`} accessibilityState={{ disabled, busy }} disabled={disabled}
      onPress={() => onPurchase(item)} style={[styles.buy, disabled && styles.disabled]}>
      <UiText variant="label" style={[styles.buyText, disabled && styles.disabledText]}>{label}</UiText>
    </UiPressable>}
  </SurfaceCard>;
});

const styles = StyleSheet.create({
  card: { flex: 1, padding: ui.spacing.sm, gap: ui.spacing.sm },
  owned: { borderColor: ui.colors.success },
  preview: { height: 160, backgroundColor: ui.colors.elevated, borderRadius: ui.radius.sm, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  image: { width: "100%", height: "100%" },
  name: { color: ui.colors.text },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: ui.spacing.xs },
  secondary: { color: ui.colors.secondaryText },
  requirement: { gap: ui.spacing.xs },
  buy: { backgroundColor: ui.colors.primary, borderRadius: ui.radius.md, alignItems: "center", padding: ui.spacing.sm, marginTop: "auto" },
  buyText: { color: ui.colors.onPrimary, textAlign: "center" },
  disabled: { backgroundColor: ui.colors.disabled },
  disabledText: { color: ui.colors.disabledText },
});
