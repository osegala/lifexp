import { useState } from "react";
import { Text, Pressable, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { colors, radius, spacing, uiTheme } from "../theme/theme";

type Props = {
  title: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "danger";
  disabled?: boolean;
  tone?: "legacy" | "parchment";
  style?: StyleProp<ViewStyle>;
};

export default function LifeButton({
  title,
  onPress,
  variant = "primary",
  disabled = false,
  tone = "legacy",
  style,
}: Props) {
  const [focused, setFocused] = useState(false);
  const parchment = tone === "parchment";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled }}
      onPress={onPress}
      disabled={disabled}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={({ pressed }) => [
        styles.button,
        variant === "secondary" && styles.secondary,
        variant === "danger" && styles.danger,
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled,
        parchment && styles.parchment,
        parchment && variant === "secondary" && styles.parchmentSecondary,
        parchment && variant === "danger" && styles.parchmentDanger,
        parchment && pressed && !disabled && styles.parchmentPressed,
        parchment && disabled && styles.parchmentDisabled,
        parchment && focused && styles.focused,
        style,
      ]}
    >
      <Text style={[styles.text, disabled && styles.disabledText,
        parchment && styles.parchmentText,
        parchment && variant === "secondary" && styles.parchmentSecondaryText,
        parchment && disabled && styles.parchmentDisabledText]}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: colors.primary,
    minHeight: 48,
    minWidth: 48,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  secondary: {
    backgroundColor: colors.cardLight,
  },
  danger: {
    backgroundColor: colors.danger,
  },
  pressed: {
    opacity: 0.75,
    transform: [{ scale: 0.98 }],
  },
  disabled: {
    opacity: 0.6,
  },
  text: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "600",
  },
  disabledText: {
    color: colors.mutedText,
  },
  parchment: { backgroundColor: uiTheme.colors.primary, borderRadius: uiTheme.radius.md, borderWidth: 2, borderColor: "transparent", paddingHorizontal: uiTheme.spacing.md },
  parchmentSecondary: { backgroundColor: uiTheme.colors.surface, borderColor: uiTheme.colors.controlBorder, borderWidth: 1 },
  parchmentDanger: { backgroundColor: uiTheme.colors.danger },
  parchmentPressed: { opacity: 0.85, transform: [] },
  parchmentDisabled: { opacity: 1, backgroundColor: uiTheme.colors.disabled, borderColor: uiTheme.colors.disabled },
  focused: { outlineColor: uiTheme.colors.focus, outlineWidth: 2, outlineOffset: 3, outlineStyle: "solid" },
  parchmentText: { ...uiTheme.type.label, color: uiTheme.colors.onPrimary, textAlign: "center" },
  parchmentSecondaryText: { color: uiTheme.colors.primary },
  parchmentDisabledText: { color: uiTheme.colors.disabledText },
});
