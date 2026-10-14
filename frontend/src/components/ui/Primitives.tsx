import { useState, type ReactNode } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { PressableProps, ScrollViewProps, TextProps, ViewProps } from "react-native";
import LifeCard from "../LifeCard";
import { uiTheme as ui } from "../../theme/theme";

export function UiText({ variant = "body", style, ...props }: TextProps & { variant?: keyof typeof ui.type }) {
  const display = variant === "display" || variant === "section";
  return <Text {...props} style={[styles.text, ui.type[variant],
    { fontFamily: Platform.select(display ? ui.font.display : ui.font.body) }, style]} />;
}

// The root navigator already owns the top safe area and the tabs own the bottom.
// Do not nest another SafeAreaView or put a virtualized list inside this ScrollView.
export function ScreenShell({ children, style, contentContainerStyle, ...props }: ScrollViewProps) {
  return <ScrollView {...props} style={[styles.screen, style]} contentContainerStyle={[styles.content, contentContainerStyle]}>
    {children}
  </ScrollView>;
}

export function SectionHeader({ title, subtitle, trailing }: { title: string; subtitle?: string; trailing?: ReactNode }) {
  return <View style={styles.header}>
    <View style={styles.headerText}>
      <UiText variant="section" accessibilityRole="header" aria-level={2}>{title}</UiText>
      {subtitle ? <UiText variant="caption" style={styles.secondary}>{subtitle}</UiText> : null}
    </View>
    {trailing}
  </View>;
}

export function SurfaceCard(props: ViewProps) {
  return <LifeCard {...props} tone="parchment" />;
}

// Shared press/focus feedback without an animated scale or additional dependency.
export function UiPressable({ style, onFocus, onBlur, disabled, ...props }: PressableProps) {
  const [focused, setFocused] = useState(false);
  return <Pressable {...props} disabled={disabled}
    onFocus={event => { setFocused(true); onFocus?.(event); }}
    onBlur={event => { setFocused(false); onBlur?.(event); }}
    style={state => [styles.target, typeof style === "function" ? style(state) : style,
      state.pressed && !disabled && styles.pressed, focused && styles.focused]} />;
}

export function FilterChip({ label, selected = false, disabled = false, onPress }: {
  label: string; selected?: boolean; disabled?: boolean; onPress: () => void;
}) {
  return <UiPressable accessibilityRole="button" accessibilityLabel={label}
    accessibilityState={{ disabled, ...(Platform.OS === "web" ? {} : { selected }) }} aria-pressed={selected}
    disabled={disabled} onPress={onPress}
    style={[styles.chip, selected && styles.chipSelected, disabled && styles.disabled]}>
    <UiText variant="label" style={[styles.chipText, selected && styles.selectedText, disabled && styles.disabledText]}>{label}</UiText>
  </UiPressable>;
}

export function ListRowCard({ title, detail, leading, trailing, onPress, disabled = false }: {
  title: string; detail?: string; leading?: ReactNode; trailing?: ReactNode; onPress?: () => void; disabled?: boolean;
}) {
  const children = <>{leading}<View style={styles.rowText}>
    <UiText variant="label">{title}</UiText>
    {detail ? <UiText variant="caption" style={styles.secondary}>{detail}</UiText> : null}
  </View>{trailing}</>;
  return onPress ? <UiPressable accessibilityRole="button" accessibilityLabel={[title, detail].filter(Boolean).join(", ")}
    accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={[styles.row, disabled && styles.disabled]}>
    {children}
  </UiPressable> : <View style={styles.row}>{children}</View>;
}

export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return <View style={styles.empty}>
    <UiText variant="section" accessibilityRole="header" aria-level={2}>{title}</UiText>
    <UiText style={styles.secondary}>{description}</UiText>
    {action}
  </View>;
}

const styles = StyleSheet.create({
  text: { color: ui.colors.text, flexShrink: 1 },
  screen: { flex: 1, backgroundColor: ui.colors.background },
  content: { width: "100%", maxWidth: ui.size.contentMax, alignSelf: "center", padding: ui.spacing.md, gap: ui.spacing.lg, paddingBottom: ui.spacing.xl },
  header: { flexDirection: "row", alignItems: "center", gap: ui.spacing.sm, flexWrap: "wrap" },
  headerText: { flexGrow: 1, flexShrink: 1, gap: ui.spacing.xs },
  secondary: { color: ui.colors.secondaryText },
  target: { minWidth: ui.size.target, minHeight: ui.size.target, justifyContent: "center" },
  pressed: { opacity: 0.8 },
  focused: { outlineWidth: 2, outlineOffset: 3, outlineColor: ui.colors.focus, outlineStyle: "solid" },
  chip: { borderRadius: ui.radius.md, borderWidth: 1, borderColor: ui.colors.controlBorder, paddingHorizontal: ui.spacing.md, paddingVertical: ui.spacing.sm, backgroundColor: ui.colors.surface },
  chipSelected: { backgroundColor: ui.colors.primary, borderColor: ui.colors.primary },
  chipText: { color: ui.colors.secondaryText, textAlign: "center" },
  selectedText: { color: ui.colors.onPrimary },
  disabled: { backgroundColor: ui.colors.disabled, borderColor: ui.colors.disabled },
  disabledText: { color: ui.colors.disabledText },
  row: { flexDirection: "row", alignItems: "center", gap: ui.spacing.md, padding: ui.size.cardPadding, backgroundColor: ui.colors.surface, borderWidth: 1, borderColor: ui.colors.border, borderRadius: ui.radius.md },
  rowText: { flex: 1, gap: ui.spacing.xs },
  empty: { paddingVertical: ui.spacing.lg, gap: ui.spacing.sm, alignItems: "flex-start" },
});
