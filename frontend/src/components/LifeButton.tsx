import ButtonSurface, { buttonHitArea, type ButtonVariant } from "./ui/ButtonSurface";
import { isFocusVisible } from "../utils/focus";
import { useState, type ReactNode } from "react";
import { ActivityIndicator, Platform, Text, Pressable, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { colors, radius, spacing, uiTheme } from "../theme/theme";

type Props = {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  busy?: boolean;
  accessibilityLabel?: string;
  leading?: ReactNode;
  framed?: boolean;
  tone?: "legacy" | "parchment";
  style?: StyleProp<ViewStyle>;
};

export default function LifeButton({
  title,
  onPress,
  variant = "primary",
  disabled = false,
  busy,
  accessibilityLabel,
  leading,
  framed = false,
  tone = "legacy",
  style,
}: Props) {
  const [focused, setFocused] = useState(false);
  const parchment = tone === "parchment";
  const framedSecondary = parchment && variant === "secondary" && framed;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled, ...(busy !== undefined ? { busy } : {}) }}
      onPress={onPress}
      disabled={disabled}
      hitSlop={parchment && variant === "secondary" ? { top: 2, bottom: 2 } : undefined}
      onPointerDown={() => setFocused(false)}
      onFocus={event => setFocused(isFocusVisible(event))}
      onBlur={() => setFocused(false)}
      style={({ pressed }) => [
        styles.button,
        !parchment && variant === "secondary" && styles.secondary,
        !parchment && variant === "danger" && styles.danger,
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled,
        parchment && styles.parchment,
        parchment && variant === "secondary" && styles.parchmentSecondary,
        framedSecondary && styles.framedSecondary,
        parchment && pressed && !disabled && styles.parchmentPressed,
        parchment && disabled && styles.parchmentDisabled,
        parchment && focused && Platform.OS === "web" && styles.focused,
        style,
        parchment && buttonHitArea,
      ]}
    >
      {parchment && <ButtonSurface variant={variant} disabled={disabled} />}
      {busy ? <ActivityIndicator size="small" color={parchment ? uiTheme.colors.disabledText : colors.mutedText} /> : <>{leading}
      <Text style={[styles.text, disabled && styles.disabledText,
        parchment && styles.parchmentText,
        parchment && variant === "secondary" && styles.parchmentSecondaryText,
        parchment && disabled && styles.parchmentDisabledText]}>{title}</Text></>}
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
  parchment: { minHeight: 52, backgroundColor: "transparent", borderRadius: uiTheme.radius.md, borderWidth: 0, paddingHorizontal: 24, paddingVertical: 12,
    flexDirection: "row", gap: 8 },
  parchmentSecondary: { minHeight: 44, paddingVertical: 8 },
  framedSecondary: { minHeight: 52, paddingVertical: 12 },
  parchmentPressed: { opacity: 0.85, transform: [] },
  parchmentDisabled: { opacity: 1 },
  focused: { outlineColor: uiTheme.colors.focus, outlineWidth: 2, outlineOffset: -3, outlineStyle: "solid" },
  parchmentText: { ...uiTheme.type.label, color: uiTheme.colors.onPrimary, textAlign: "center", flexShrink: 1 },
  parchmentSecondaryText: { color: uiTheme.colors.primary },
  parchmentDisabledText: { color: uiTheme.colors.text },
});
