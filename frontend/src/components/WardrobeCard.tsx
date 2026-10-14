import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { memo } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import type { Cosmetic } from "../types/avatar";
import { getCosmeticPreviewCrop, getCosmeticPreviewSource } from "../avatar/assetRegistry";
import { uiTheme as ui } from "../theme/theme";
import CosmeticImage from "./CosmeticImage";
import { BadgePill } from "./ui/Indicators";
import { SurfaceCard, UiPressable, UiText } from "./ui/Primitives";

export default memo(function WardrobeCard({ cosmetic, width, loading, previewMode, premiumOnly, onEquip }: {
  cosmetic: Cosmetic; width: number; loading: boolean; previewMode: boolean; premiumOnly: boolean;
  onEquip: (cosmetic: Cosmetic) => void;
}) {
  const source = getCosmeticPreviewSource(cosmetic);
  const disabled = !(previewMode || cosmetic.unlocked) || loading;
  const label = cosmetic.equipped ? previewMode ? "Previewing" : cosmetic.type === "HAIR" ? "Selected" : "Unequip"
    : previewMode ? "Preview" : cosmetic.unlocked ? "Equip" : "Locked";
  return <SurfaceCard style={[styles.card, { width }, cosmetic.equipped && styles.equipped]}>
    <View style={styles.preview} accessible accessibilityLabel={`${cosmetic.name} preview`}>
      {source ? <CosmeticImage source={source} crop={getCosmeticPreviewCrop(cosmetic)} style={styles.image} />
        : <MaterialCommunityIcons name="hanger" size={ui.size.icon} color={ui.colors.secondaryText} accessible={false} aria-hidden />}
    </View>
    <UiText variant="label">{cosmetic.name}</UiText>
    <View style={styles.badges}>
      {cosmetic.equipped && <BadgePill label={previewMode ? "Previewing" : "Equipped"} tone="success" />}
      {!cosmetic.equipped && cosmetic.owned && <BadgePill label="Owned" tone="success" />}
      {!cosmetic.unlocked && !previewMode && <BadgePill label="Locked" tone="locked" />}
      {premiumOnly && <BadgePill label="Premium" />}
    </View>
    <UiText variant="caption" style={styles.secondary}>{previewMode && !cosmetic.owned ? "DEV preview · not owned"
      : cosmetic.unlocked ? "In your collection" : cosmetic.requirementText ?? "Available in the Shop"}</UiText>
    <UiPressable accessibilityRole="button" accessibilityLabel={`${loading ? "Updating" : label}: ${cosmetic.name}`}
      accessibilityState={{ disabled, selected: cosmetic.equipped, busy: loading }} aria-pressed={cosmetic.equipped}
      disabled={disabled} onPress={() => onEquip(cosmetic)}
      style={[styles.action, cosmetic.equipped && styles.selectedAction, disabled && styles.disabled]}>
      {loading ? <ActivityIndicator color={ui.colors.disabledText} accessibilityLabel={`Updating ${cosmetic.name}`} />
        : <UiText variant="label" style={[styles.actionText, cosmetic.equipped && styles.selectedText, disabled && styles.disabledText]}>{label}</UiText>}
    </UiPressable>
  </SurfaceCard>;
});

const styles = StyleSheet.create({
  card: { padding: ui.spacing.sm, gap: ui.spacing.sm },
  equipped: { borderColor: ui.colors.success },
  preview: { width: "100%", aspectRatio: 1, alignItems: "center", justifyContent: "center", borderRadius: ui.radius.md, backgroundColor: ui.colors.elevated, overflow: "hidden" },
  image: { width: "96%", height: "96%" },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: ui.spacing.xs },
  secondary: { color: ui.colors.secondaryText },
  action: { alignItems: "center", backgroundColor: ui.colors.primary, borderWidth: 1, borderColor: ui.colors.primary, borderRadius: ui.radius.md, padding: ui.spacing.sm },
  actionText: { color: ui.colors.onPrimary, textAlign: "center" },
  selectedAction: { backgroundColor: ui.colors.successSurface },
  selectedText: { color: ui.colors.success },
  disabled: { backgroundColor: ui.colors.disabled, borderColor: ui.colors.disabled },
  disabledText: { color: ui.colors.disabledText },
});
