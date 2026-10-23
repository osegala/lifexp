import { useState } from "react";
import { Platform, TextInput, StyleSheet, View, type TextInputProps } from "react-native";
import { colors, radius, spacing, uiTheme as ui } from "../theme/theme";
import { isFocusVisible } from "../utils/focus";
import FantasyMaterial from "./ui/FantasyMaterial";

export default function LifeInput({ tone = "legacy", style, onFocus, onBlur, onPointerDown, ...props }: TextInputProps & { tone?: "legacy" | "parchment" }) {
  const [focused, setFocused] = useState(false);
  if (tone === "legacy") return <TextInput placeholderTextColor={colors.mutedText} selectionColor={colors.accent}
    {...props} onFocus={onFocus} onBlur={onBlur} onPointerDown={onPointerDown} style={[styles.input, style]} />;
  return <View style={[styles.field, focused && styles.focused, focused && Platform.OS === "web" && styles.webFocused]}>
    <FantasyMaterial kind="input" opacity={props.editable === false ? 0.75 : 1} />
    <TextInput placeholderTextColor={ui.colors.subduedText} selectionColor={ui.colors.gold} underlineColorAndroid="transparent" {...props}
      onPointerDown={event => { setFocused(false); onPointerDown?.(event); }}
      onFocus={event => { setFocused(Platform.OS !== "web" || isFocusVisible(event)); onFocus?.(event); }}
      onBlur={event => { setFocused(false); onBlur?.(event); }}
      style={[styles.input, styles.parchment, style, styles.clear, Platform.OS === "web" && styles.webClear]} />
  </View>;
}

const styles = StyleSheet.create({
  field: { minHeight: 52, borderRadius: 8, borderWidth: 1, borderColor: "transparent" },
  focused: { borderColor: ui.colors.focus },
  webFocused: { outlineColor: ui.colors.focus, outlineStyle: "solid", outlineWidth: 1, outlineOffset: 1 },
  parchment: { color: ui.colors.text, borderRadius: ui.radius.md, minHeight: 50, paddingHorizontal: 16, paddingVertical: 12 },
  clear: { position: "relative", zIndex: 1, backgroundColor: "transparent", borderWidth: 0 },
  webClear: { outlineWidth: 0 },
  input: { backgroundColor: colors.cardLight, color: colors.text, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, padding: spacing.md, fontSize: 16 },
});
