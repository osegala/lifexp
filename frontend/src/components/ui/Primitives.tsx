import { useState, type ComponentProps, type ReactNode, type Ref } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { PressableProps, ScrollViewProps, StyleProp, TextProps, ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import LifeCard from "../LifeCard";
import PageBackground from "./PageBackground";
import FantasyMaterial from "./FantasyMaterial";
import { buttonHitArea } from "./ButtonSurface";
import { isFocusVisible } from "../../utils/focus";
import { uiTheme as ui } from "../../theme/theme";

export function UiText({ variant = "body", style, ...props }: TextProps & { variant?: keyof typeof ui.type }) {
  const display = variant === "display" || variant === "section";
  return <Text {...props} style={[styles.text, ui.type[variant],
    { fontFamily: Platform.select(display ? ui.font.display : ui.font.body) }, style]} />;
}

// Insets belong to content, so the background continues behind the status bar.
// Never put a virtualized list inside this shell.
export function ScreenShell({ children, style, contentContainerStyle, keyboardSafe = false, scrollRef, overlay, ...props }:
  ScrollViewProps & { keyboardSafe?: boolean; scrollRef?: Ref<ScrollView>; overlay?: ReactNode }) {
  const insets = useSafeAreaInsets();
  const content = <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
    {...props} ref={scrollRef} style={[styles.screen, style]}
    contentContainerStyle={[styles.content, { paddingTop: insets.top + ui.spacing.md, paddingBottom: insets.bottom + ui.spacing.xl }, contentContainerStyle]}>
    {children}
  </ScrollView>;
  const pageContent = keyboardSafe ? <KeyboardAvoidingView style={styles.flex}
    behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={0}>{content}</KeyboardAvoidingView> : content;
  return <PageBackground>{overlay ? <>{pageContent}{overlay}</> : pageContent}</PageBackground>;
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

export function SurfaceCard(props: ComponentProps<typeof LifeCard>) {
  return <LifeCard {...props} tone="parchment" />;
}

// Shared press/focus feedback without an animated scale or additional dependency.
export function UiPressable({ style, onFocus, onBlur, onPointerDown, disabled, ...props }: PressableProps) {
  const [focused, setFocused] = useState(false);
  return <Pressable {...props} disabled={disabled}
    onPointerDown={event => { setFocused(false); onPointerDown?.(event); }}
    onFocus={event => { setFocused(isFocusVisible(event)); onFocus?.(event); }}
    onBlur={event => { setFocused(false); onBlur?.(event); }}
    style={state => [styles.target, typeof style === "function" ? style(state) : style,
      state.pressed && !disabled && styles.pressed, focused && Platform.OS === "web" && styles.focused]} />;
}

export function FilterChip({ label, selected = false, disabled = false, onPress, leading, style }: {
  label: string; selected?: boolean; disabled?: boolean; onPress: () => void; leading?: ReactNode; style?: StyleProp<ViewStyle>;
}) {
  return <UiPressable accessibilityRole="button" accessibilityLabel={label}
    accessibilityState={{ disabled, ...(Platform.OS === "web" ? {} : { selected }) }} aria-pressed={selected}
    disabled={disabled} onPress={onPress} hitSlop={{ top: 6, bottom: 6 }}
    style={[styles.chip, style, buttonHitArea]}>
    <FantasyMaterial kind={disabled ? "disabled" : selected ? "selected" : "input"} />
    {leading}
    <UiText variant="caption" style={[styles.chipText, selected && styles.selectedText, disabled && styles.disabledText]}>{label}</UiText>
  </UiPressable>;
}

export function ListRowCard({ title, detail, leading, trailing, onPress, disabled = false, style }: {
  title: string; detail?: string; leading?: ReactNode; trailing?: ReactNode; onPress?: () => void; disabled?: boolean; style?: StyleProp<ViewStyle>;
}) {
  const children = <>{leading}<View style={styles.rowText}>
    <UiText variant="label">{title}</UiText>
    {detail ? <UiText variant="caption" style={styles.secondary}>{detail}</UiText> : null}
  </View>{trailing}</>;
  return onPress ? <UiPressable accessibilityRole="button" accessibilityLabel={[title, detail].filter(Boolean).join(", ")}
    accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={[styles.row, style, disabled && styles.disabled]}>
    {children}
  </UiPressable> : <View style={[styles.row, style]}>{children}</View>;
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
  flex: { flex: 1 },
  screen: { flex: 1, backgroundColor: "transparent" },
  content: { width: "100%", maxWidth: ui.size.contentMax, alignSelf: "center", padding: ui.spacing.md, gap: ui.spacing.md, paddingBottom: ui.spacing.xl },
  header: { flexDirection: "row", alignItems: "center", gap: ui.spacing.sm, flexWrap: "wrap" },
  headerText: { flexGrow: 1, flexShrink: 1, gap: ui.spacing.xs },
  secondary: { color: ui.colors.secondaryText },
  target: { minWidth: ui.size.target, minHeight: ui.size.target, justifyContent: "center" },
  pressed: { opacity: 0.8 },
  focused: { outlineWidth: 2, outlineOffset: -3, outlineColor: ui.colors.focus, outlineStyle: "solid" },
  chip: { minHeight: 36, minWidth: 44, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: ui.spacing.xs, paddingHorizontal: ui.spacing.sm, paddingVertical: ui.spacing.xs },
  chipText: { color: ui.colors.secondaryText, textAlign: "center" },
  selectedText: { color: ui.colors.onPrimary },
  disabled: { backgroundColor: ui.colors.disabled, borderColor: ui.colors.disabled },
  disabledText: { color: ui.colors.disabledText },
  row: { minHeight: 56, flexDirection: "row", alignItems: "center", gap: ui.spacing.sm, padding: ui.spacing.sm, backgroundColor: "transparent", borderBottomWidth: 1, borderColor: ui.colors.border, borderRadius: ui.radius.sm },
  rowText: { flex: 1, gap: 1 },
  empty: { paddingVertical: ui.spacing.lg, gap: ui.spacing.sm, alignItems: "flex-start" },
});
