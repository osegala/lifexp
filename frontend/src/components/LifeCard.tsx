import FantasyMaterial from "./ui/FantasyMaterial";
import PaperTexture from "./ui/PaperTexture";
import { View, StyleSheet, ViewProps } from "react-native";
import { colors, radius, spacing, shadow, uiTheme } from "../theme/theme";

type Props = ViewProps & {
  compact?: boolean;
  framed?: boolean;
  tone?: "legacy" | "parchment";
};

export default function LifeCard({
  children,
  compact = false,
  framed = false,
  tone = "legacy",
  style,
  ...props
}: Props) {
  return (
    <View style={[styles.card, compact && styles.compact, tone === "parchment" && styles.parchment, tone === "parchment" && framed && styles.framed, style]} {...props}>
      {tone === "parchment" && (framed ? <FantasyMaterial kind="panel" /> : <PaperTexture />)}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow,
  },
  compact: {
    borderRadius: radius.md,
    padding: spacing.md,
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 1,
  },
  framed: { backgroundColor: "transparent", borderWidth: 0, padding: 20, shadowOpacity: 0, elevation: 0 },
  parchment: {
    backgroundColor: uiTheme.colors.surface, borderColor: uiTheme.colors.border,
    borderRadius: uiTheme.radius.md, padding: uiTheme.size.cardPadding,
    ...uiTheme.shadow,
  },
});
