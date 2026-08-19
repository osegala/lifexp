import { View, StyleSheet, ViewProps } from "react-native";
import { colors, radius, spacing, shadow } from "../theme/theme";

type Props = ViewProps & {
  compact?: boolean;
};

export default function LifeCard({
  children,
  compact = false,
  style,
  ...props
}: Props) {
  return (
    <View style={[styles.card, compact && styles.compact, style]} {...props}>
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
});
