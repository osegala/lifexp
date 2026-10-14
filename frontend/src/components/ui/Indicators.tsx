import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { StyleSheet, View, type ViewProps } from "react-native";
import { uiTheme as ui } from "../../theme/theme";
import { UiText } from "./Primitives";

const resources = {
  coins: { icon: "circle-multiple-outline", color: ui.colors.coin, backgroundColor: ui.colors.coinSurface, label: "Coins" },
  gems: { icon: "diamond-stone", color: ui.colors.gem, backgroundColor: ui.colors.gemSurface, label: "Gems" },
  worldPoints: { icon: "castle", color: ui.colors.primary, backgroundColor: ui.colors.successSurface, label: "World Points" },
} as const;

// Display-only: callers supply authoritative values; no balance/reward calculation.
export function ResourcePill({ resource, value }: { resource: keyof typeof resources; value: number | string }) {
  const treatment = resources[resource];
  return <View accessible accessibilityLabel={`${treatment.label}: ${value}`} style={[styles.pill, { backgroundColor: treatment.backgroundColor }]}>
    <MaterialCommunityIcons name={treatment.icon} size={ui.size.smallIcon} color={treatment.color} accessible={false} aria-hidden />
    <UiText variant="label" style={{ color: treatment.color, fontVariant: ["tabular-nums"] }}>{value}</UiText>
  </View>;
}

export function ResourceCluster({ style, ...props }: ViewProps) {
  return <View {...props} style={[styles.cluster, style]} />;
}

const badges = {
  neutral: { color: ui.colors.secondaryText, backgroundColor: ui.colors.stone },
  success: { color: ui.colors.success, backgroundColor: ui.colors.successSurface },
  warning: { color: ui.colors.warning, backgroundColor: ui.colors.warningSurface },
  locked: { color: ui.colors.locked, backgroundColor: ui.colors.stone },
};
export function BadgePill({ label, tone = "neutral" }: { label: string; tone?: keyof typeof badges }) {
  const treatment = badges[tone];
  return <View style={[styles.pill, { backgroundColor: treatment.backgroundColor }]}>
    {tone === "locked" ? <MaterialCommunityIcons name="lock-outline" size={ui.size.smallIcon} color={treatment.color} accessible={false} aria-hidden /> : null}
    <UiText variant="caption" style={{ color: treatment.color }}>{label}</UiText>
  </View>;
}

const styles = StyleSheet.create({
  pill: { minHeight: ui.size.pill, borderRadius: ui.radius.pill, paddingHorizontal: ui.spacing.sm, paddingVertical: ui.spacing.xs, flexDirection: "row", alignItems: "center", gap: ui.spacing.xs, alignSelf: "flex-start", maxWidth: "100%" },
  cluster: { flexDirection: "row", flexWrap: "wrap", justifyContent: "flex-end", gap: ui.spacing.sm },
});
