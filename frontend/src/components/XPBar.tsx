import { View, StyleSheet } from "react-native";
import { colors, radius, uiTheme } from "../theme/theme";

type Props = {
  progress: number;
  tone?: "legacy" | "parchment";
  label?: string;
};

export default function XPBar({ progress, tone = "legacy", label = "Experience progress" }: Props) {
  const percent = Number.isFinite(progress) ? Math.max(0, Math.min(progress * 100, 100)) : 0;
  return (
    <View accessibilityRole="progressbar" accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(percent) }}
      style={[styles.container, tone === "parchment" && styles.parchmentTrack]}>
      <View
        style={[
          styles.fill,
          tone === "parchment" && styles.parchmentFill,
          { width: `${percent}%` },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 10,
    backgroundColor: colors.cardLight,
    borderRadius: radius.sm,
    overflow: "hidden",
  },

  fill: {
    height: "100%",
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
  },
  parchmentTrack: { backgroundColor: uiTheme.colors.xpTrack, borderRadius: uiTheme.radius.pill },
  parchmentFill: { backgroundColor: uiTheme.colors.xp, borderRadius: uiTheme.radius.pill },
});
