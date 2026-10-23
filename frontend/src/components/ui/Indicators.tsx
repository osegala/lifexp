import FantasyMaterial from "./FantasyMaterial";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { StyleSheet, View, type TextProps, type ViewProps } from "react-native";
import { uiTheme as ui } from "../../theme/theme";
import { UiText } from "./Primitives";

const resources = {
  coins: { icon: "circle-multiple-outline", color: ui.colors.coin, backgroundColor: ui.colors.coinSurface, label: "Coins" },
  gems: { icon: "diamond-stone", color: ui.colors.gem, backgroundColor: ui.colors.gemSurface, label: "Gems" },
  worldPoints: { icon: "castle", color: ui.colors.primary, backgroundColor: ui.colors.successSurface, label: "World Points" },
} as const;

// Display-only: callers supply authoritative values; no balance/reward calculation.
export function ResourcePill({ resource, value, tone = "paper", style }: { resource: keyof typeof resources; value: number | string; tone?: "paper" | "hud"; style?: ViewProps["style"] }) {
  const treatment = resources[resource];
  return <View accessible accessibilityLabel={`${treatment.label}: ${value}`} style={[styles.pill, { backgroundColor: treatment.backgroundColor }, tone === "hud" && styles.hud, style]}>
    {tone === "hud" && <FantasyMaterial kind="resource" />}
    <MaterialCommunityIcons name={treatment.icon} size={ui.size.smallIcon} color={tone === "hud" ? ui.colors.navigationActive : treatment.color} accessible={false} aria-hidden />
    <UiText variant="caption" style={{ color: tone === "hud" ? ui.colors.onPrimary : treatment.color, fontVariant: ["tabular-nums"] }}>{value}</UiText>
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
export function BadgePill({ label, tone = "neutral", style, textStyle }: {
  label: string; tone?: keyof typeof badges; style?: ViewProps["style"]; textStyle?: TextProps["style"];
}) {
  const treatment = badges[tone];
  return <View style={[styles.pill, styles.badge, { backgroundColor: treatment.backgroundColor }, style]}>
    {tone === "locked" ? <MaterialCommunityIcons name="lock-outline" size={ui.size.smallIcon} color={treatment.color} accessible={false} aria-hidden /> : null}
    <UiText variant="caption" style={[{ color: treatment.color }, textStyle]}>{label}</UiText>
  </View>;
}

const styles = StyleSheet.create({
  hud: { minHeight: 30, paddingHorizontal: 14, backgroundColor: "transparent", borderWidth: 0, borderRadius: ui.radius.pill },
  badge: { minHeight: 24, paddingVertical: 2, borderRadius: 4 },
  pill: { minHeight: 28, borderRadius: ui.radius.pill, paddingHorizontal: ui.spacing.sm, paddingVertical: ui.spacing.xs, flexDirection: "row", alignItems: "center", gap: ui.spacing.xs, alignSelf: "flex-start", maxWidth: "100%" },
  cluster: { flexDirection: "row", flexWrap: "wrap", justifyContent: "flex-end", gap: ui.spacing.xs },
});
