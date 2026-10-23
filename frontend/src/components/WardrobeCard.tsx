import PaperTexture from "./ui/PaperTexture";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { memo } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import type { Cosmetic } from "../types/avatar";
import { getCosmeticPreviewCrop, getCosmeticPreviewSource } from "../avatar/assetRegistry";
import { uiTheme as ui } from "../theme/theme";
import CosmeticImage from "./CosmeticImage";
import { UiPressable, UiText } from "./ui/Primitives";

export default memo(function WardrobeCard({ cosmetic, width, loading, previewMode, premiumOnly, onEquip, premiumAvailable, onPremium }: {
  cosmetic: Cosmetic; width: number; loading: boolean; previewMode: boolean; premiumOnly: boolean;
  onEquip: (cosmetic: Cosmetic) => void; premiumAvailable?: boolean; onPremium?: () => void;
}) {
  const source = getCosmeticPreviewSource(cosmetic);
  const claim = cosmetic.claimable && premiumAvailable !== false;
  const upgrade = !cosmetic.unlocked && cosmetic.requiresPremium && !claim && !!onPremium;
  const disabled = !(previewMode || cosmetic.unlocked || claim || upgrade) || loading;
  const label = cosmetic.equipped ? previewMode ? "Previewing" : cosmetic.type === "HAIR" ? "Selected" : "Unequip"
    : previewMode ? "Preview" : cosmetic.unlocked ? "Equip" : claim ? "Unlock and equip" : upgrade ? "View Premium" : "Locked";
  const detail = cosmetic.equipped ? previewMode ? "Previewing" : "Equipped"
    : !cosmetic.unlocked && !previewMode ? cosmetic.requirementText ?? "Locked · visit Shop"
    : cosmetic.owned ? "Owned" : "DEV preview · not owned";
  return <UiPressable accessibilityRole="button" accessibilityLabel={`${loading ? "Updating" : label}: ${cosmetic.name}`}
    accessibilityHint={`${detail}${premiumOnly ? ", Premium" : ""}`}
    accessibilityState={{ disabled, selected: cosmetic.equipped, busy: loading }} aria-pressed={cosmetic.equipped}
    disabled={disabled} onPress={() => upgrade && !previewMode ? onPremium?.() : onEquip(cosmetic)}
    style={[styles.card, { width }, cosmetic.equipped && styles.equipped, disabled && !cosmetic.equipped && styles.locked]}>
    <PaperTexture />
    <View style={styles.preview}>
      {source ? <CosmeticImage cached source={source} crop={getCosmeticPreviewCrop(cosmetic)} style={styles.image} />
        : <MaterialCommunityIcons name="hanger" size={ui.size.icon} color={ui.colors.secondaryText} accessible={false} />}
      {cosmetic.equipped && <View style={styles.check}><MaterialCommunityIcons name="check" size={14} color={ui.colors.onPrimary} accessible={false} /></View>}
      {loading && <ActivityIndicator style={StyleSheet.absoluteFill} color={ui.colors.primary} accessibilityLabel={`Updating ${cosmetic.name}`} />}
    </View>
    <UiText variant="caption" numberOfLines={2} style={styles.name}>{cosmetic.name}</UiText>
    <UiText variant="caption" numberOfLines={2} style={styles.secondary}>{detail}</UiText>
    {premiumOnly && <View style={styles.premium}><MaterialCommunityIcons name="crown-outline" size={12} color={ui.colors.gold} accessible={false} />
      <UiText variant="caption" style={styles.secondary}>Premium</UiText></View>}
  </UiPressable>;
});

const styles = StyleSheet.create({
  card: { justifyContent: "flex-start", alignSelf: "stretch", padding: ui.spacing.xs, gap: ui.spacing.xs, backgroundColor: ui.colors.paperInset,
    borderWidth: 1, borderColor: ui.colors.border, borderRadius: ui.radius.sm },
  equipped: { borderColor: ui.colors.primary, backgroundColor: ui.colors.successSurface, borderWidth: 2 },
  locked: { backgroundColor: ui.colors.stone },
  preview: { width: "100%", aspectRatio: 1.25, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  image: { width: "100%", height: "100%" },
  name: { fontWeight: "600" },
  secondary: { color: ui.colors.secondaryText, fontSize: 11, lineHeight: 15 },
  premium: { flexDirection: "row", alignItems: "center", gap: 2 },
  check: { position: "absolute", top: 0, right: 0, borderRadius: ui.radius.pill, padding: 2, backgroundColor: ui.colors.primary },
});
