import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { ActivityIndicator, Image, ScrollView, StyleSheet, View } from "react-native";
import { getBuildingImageSource } from "../base/buildingAssetRegistry";
import type { BuildingProgress } from "../types/progression";
import { uiTheme as ui } from "../theme/theme";
import { ResourcePill } from "./ui/Indicators";
import { SurfaceCard, UiPressable, UiText } from "./ui/Primitives";

export function BaseResources({ worldPoints, loading, error, onRetry }: {
  worldPoints?: number; loading: boolean; error: string; onRetry: () => void;
}) {
  return <View pointerEvents="box-none" style={styles.resources}>
    <SurfaceCard pointerEvents="none" style={styles.resourceCard}>
      <UiText variant="section" accessibilityRole="header" aria-level={1}>Base</UiText>
      <ResourcePill resource="worldPoints" value={worldPoints ?? "—"} />
    </SurfaceCard>
    {!!error && <SurfaceCard style={styles.errorCard}>
      <UiText accessibilityRole="alert" style={styles.error}>{error}</UiText>
      <UiPressable accessibilityRole="button" accessibilityLabel="Retry loading world" disabled={loading}
        accessibilityState={{ disabled: loading }} onPress={onRetry} style={[styles.secondaryButton, loading && styles.unavailable]}>
        <UiText variant="label" style={loading && styles.disabledText}>Retry</UiText>
      </UiPressable>
    </SurfaceCard>}
    {loading && <View pointerEvents="none" style={styles.refresh} accessibilityLiveRegion="polite">
      <ActivityIndicator color={ui.colors.primary} accessibilityLabel="Refreshing world" />
      <UiText variant="caption">Refreshing world…</UiText>
    </View>}
  </View>;
}

export function BaseBuildingPanel({ building, description, descriptionOpen, error, onAction, onClose }: {
  building: BuildingProgress; description: string; descriptionOpen: boolean; error: string;
  onAction: (action: "upgrade" | "enter" | "description") => void; onClose: () => void;
}) {
  const maxed = building.level >= building.maxLevel;
  return <SurfaceCard style={styles.panel}>
    <ScrollView style={styles.details} contentContainerStyle={styles.detailContent}>
      <View style={styles.heading}>
        <Image source={getBuildingImageSource(building.type, building.visualTier)} resizeMode="contain" style={styles.art} accessible={false} aria-hidden />
        <View style={styles.headingCopy}>
          <UiText variant="section" accessibilityRole="header" aria-level={2}>{building.type}</UiText>
          <UiText variant="caption" style={styles.secondary}>Level {building.level} · Tier {building.visualTier}</UiText>
        </View>
        <UiPressable accessibilityRole="button" accessibilityLabel={`Close ${building.type} details`} onPress={onClose} style={styles.close}>
          <MaterialCommunityIcons name="close" size={ui.size.icon} color={ui.colors.text} accessible={false} aria-hidden />
        </UiPressable>
      </View>
      <UiText variant="caption" style={building.upgradeAvailable ? styles.ready : styles.secondary}>
        {maxed ? "Maximum level reached" : building.upgradeAvailable ? "Ready to upgrade" : "More World Points needed"}
      </UiText>
      {building.upgradeCost != null && <UiText variant="label">Next upgrade · {building.upgradeCost} World Points</UiText>}
      {!!error && <UiText accessibilityRole="alert" style={styles.error}>{error}</UiText>}
      {descriptionOpen && <View style={styles.description}>
        <UiText>{description}</UiText>
        <UiText variant="caption" style={styles.secondary}>Upgrades cost World Points earned from daily and weekly goals.
          {building.upgradeCost == null ? " Maximum level reached." : ` Next cost: ${building.upgradeCost}.`}</UiText>
      </View>}
    </ScrollView>
    <View style={styles.actions}>
      <UiPressable accessibilityRole="button" accessibilityLabel={`Upgrade ${building.type}`}
        accessibilityHint={maxed ? "Maximum level reached; explains upgrade status" : `Costs ${building.upgradeCost ?? "more"} World Points`}
        onPress={() => onAction("upgrade")} style={[styles.action, building.upgradeAvailable ? styles.primaryButton : styles.secondaryButton]}>
        <UiText variant="label" style={[styles.actionText, building.upgradeAvailable && styles.onPrimary]}>Upgrade</UiText>
      </UiPressable>
      <UiPressable accessibilityRole="button" accessibilityLabel={`Enter ${building.type}; interiors unavailable`}
        accessibilityHint="Explains why interiors are unavailable" onPress={() => onAction("enter")} style={[styles.action, styles.unavailable]}>
        <UiText variant="label" style={[styles.actionText, styles.secondary]}>Enter</UiText>
      </UiPressable>
      <UiPressable accessibilityRole="button" accessibilityLabel={`${building.type} information`}
        accessibilityState={{ expanded: descriptionOpen }} aria-expanded={descriptionOpen}
        onPress={() => onAction("description")} style={[styles.action, styles.secondaryButton, descriptionOpen && styles.infoSelected]}>
        <UiText variant="label" style={styles.actionText}>Info</UiText>
      </UiPressable>
    </View>
  </SurfaceCard>;
}

const styles = StyleSheet.create({
  resources: { position: "absolute", top: ui.spacing.md, left: ui.spacing.md, right: ui.spacing.md, alignItems: "flex-end", gap: ui.spacing.sm, zIndex: 1000 },
  resourceCard: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: ui.spacing.md, padding: ui.spacing.sm, width: "100%", maxWidth: 420 },
  errorCard: { width: "100%", maxWidth: 420, gap: ui.spacing.sm, padding: ui.spacing.sm },
  error: { color: ui.colors.danger },
  refresh: { flexDirection: "row", alignItems: "center", gap: ui.spacing.sm, padding: ui.spacing.sm, borderRadius: ui.radius.md, backgroundColor: ui.colors.surface },
  panel: { position: "absolute", bottom: ui.spacing.md, left: ui.spacing.md, right: ui.spacing.md, width: "auto", maxWidth: 480, alignSelf: "center", maxHeight: "56%", padding: ui.spacing.md, gap: ui.spacing.sm, zIndex: 1000 },
  heading: { flexDirection: "row", alignItems: "center", gap: ui.spacing.sm },
  headingCopy: { flex: 1, gap: ui.spacing.xs },
  art: { width: 48, height: 48 },
  close: { width: ui.size.target, height: ui.size.target, alignItems: "center", borderRadius: ui.radius.md, backgroundColor: ui.colors.elevated },
  details: { flexShrink: 1 },
  detailContent: { gap: ui.spacing.sm },
  description: { gap: ui.spacing.sm, paddingVertical: ui.spacing.sm },
  secondary: { color: ui.colors.secondaryText },
  disabledText: { color: ui.colors.disabledText },
  ready: { color: ui.colors.success },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: ui.spacing.sm },
  action: { flex: 1, minWidth: 64, alignItems: "center", paddingVertical: ui.spacing.sm, paddingHorizontal: ui.spacing.xs, borderRadius: ui.radius.md, borderWidth: 1, borderColor: ui.colors.controlBorder },
  actionText: { maxWidth: "100%", minWidth: 0, textAlign: "center" },
  primaryButton: { backgroundColor: ui.colors.primary, borderColor: ui.colors.primary },
  onPrimary: { color: ui.colors.onPrimary },
  secondaryButton: { alignItems: "center", padding: ui.spacing.sm, borderRadius: ui.radius.md, borderWidth: 1, borderColor: ui.colors.controlBorder, backgroundColor: ui.colors.surface },
  unavailable: { backgroundColor: ui.colors.disabled, borderColor: ui.colors.border },
  infoSelected: { backgroundColor: ui.colors.successSurface, borderColor: ui.colors.primary },
});
