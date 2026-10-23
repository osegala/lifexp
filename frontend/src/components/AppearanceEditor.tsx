import GameNotice from "./ui/GameNotice";
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from "react-native";

import {
  EYE_COLORS,
  HAIR_COLORS,
  HAIR_STYLE_IDS,
  SKIN_COLORS,
} from "../avatar/appearance";
import type { AppearanceColor, AvatarAppearance, BodyType } from "../avatar/appearance";
import { colors, radius, spacing, uiTheme as ui } from "../theme/theme";
import { PrimaryButton } from "./ui/Buttons";
import LifeCard from "./LifeCard";
import { UiPressable } from "./ui/Primitives";

type Props = {
  tone?: "legacy" | "parchment";
  appearance: AvatarAppearance;
  dirty: boolean;
  saving: boolean;
  saveError?: string;
  onChange: (patch: Partial<AvatarAppearance>) => void;
  onSave: () => void;
  showSaveButton?: boolean;
};

export default function AppearanceEditor({
  appearance,
  dirty,
  saving,
  saveError,
  onChange,
  onSave,
  showSaveButton = true,
  tone = "legacy",
}: Props) {
  const styles = tone === "parchment" ? parchmentStyles : legacyStyles;
  const Action = tone === "parchment" ? UiPressable : Pressable;
  return (
    <LifeCard tone={tone} framed={tone === "parchment"} style={styles.card}>
      <View style={styles.headingRow}>
        <View style={styles.headingCopy}>
          <Text accessibilityRole="header" aria-level={2} style={styles.title}>Appearance</Text>
          <Text style={styles.subtitle}>Shape your hero, then save all appearance choices together.</Text>
        </View>
        {dirty && <View style={styles.unsavedBadge}><Text style={styles.unsavedText}>UNSAVED</Text></View>}
      </View>

      <View style={styles.controlGroup}><Text style={styles.label}>Body</Text>
      <View style={styles.bodyRow} accessibilityRole={tone === "parchment" ? "radiogroup" : undefined} accessibilityLabel={tone === "parchment" ? "Body" : undefined}>
        {(["BOY", "GIRL"] as const).map((bodyType) => (
          <BodyChoice
            key={bodyType}
            tone={tone}
            bodyType={bodyType}
            selected={appearance.bodyType === bodyType}
            onPress={() => onChange({ bodyType })}
          />
        ))}
      </View>
      </View>

      <View style={styles.controlGroup}><Text style={styles.label}>Hair style</Text>
      <Text accessibilityLiveRegion="polite" aria-live="polite" style={styles.selectedColor}>
        {hairStyleName(appearance.hairId)}
      </Text>
      <View accessibilityRole="radiogroup" accessibilityLabel="Hair style" style={styles.hairStyles}>
        {HAIR_STYLE_IDS.map((hairId) => {
          const selected = appearance.hairId === hairId;
          return (
            <Action
              key={hairId}
              accessibilityRole="radio"
              accessibilityLabel={`Hair style: ${hairStyleName(hairId)}`}
              accessibilityState={{ checked: selected }}
              aria-checked={selected}
              onPress={() => onChange({ hairId })}
              style={({ pressed }) => [
                styles.hairStyle,
                selected && styles.hairStyleSelected,
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.hairStyleText, selected && styles.hairStyleTextSelected]}>
                {hairStyleName(hairId)}
              </Text>
            </Action>
          );
        })}
      </View>
      </View>

      <View style={styles.controlGroup}><Text style={styles.label}>Skin tone</Text>
      <Swatches tone={tone} label="Skin tone" options={SKIN_COLORS} selectedId={appearance.skinColorId} onSelect={(skinColorId) => onChange({ skinColorId })} />
      </View>

      <View style={styles.controlGroup}><Text style={styles.label}>Hair color</Text>
      <Swatches tone={tone} label="Hair color" options={HAIR_COLORS} selectedId={appearance.hairColorId} onSelect={(hairColorId) => onChange({ hairColorId })} />
      </View>

      <View style={styles.controlGroup}><Text style={styles.label}>Eye color</Text>
      <Swatches tone={tone} label="Eye color" options={EYE_COLORS} selectedId={appearance.eyeColorId} onSelect={(eyeColorId) => onChange({ eyeColorId })} />
      </View>

      {!!saveError && (
        <GameNotice title="Appearance not saved" message={saveError} variant="error" />
      )}

      {showSaveButton && (tone === "parchment" ? <PrimaryButton
        title={dirty ? "Save Appearance" : "Appearance Saved"} accessibilityLabel="Save appearance"
        busy={saving} disabled={!dirty || saving} onPress={onSave} /> : (
        <Action
          accessibilityRole="button"
          accessibilityLabel="Save appearance"
          accessibilityState={{ disabled: !dirty || saving, busy: saving }}
          disabled={!dirty || saving}
          onPress={onSave}
          style={({ pressed }) => [
            styles.saveButton,
            (!dirty || saving) && styles.saveButtonDisabled,
            pressed && dirty && !saving && styles.pressed,
          ]}
        >
          {saving ? <ActivityIndicator size="small" color={colors.background} /> : (
            <Text style={[styles.saveText, !dirty && styles.saveTextDisabled]}>
              {dirty ? "Save Appearance" : "Appearance Saved"}
            </Text>
          )}
        </Action>
      ))}
    </LifeCard>
  );
}

function hairStyleName(hairId: string) {
  return hairId.split("/").at(-1)?.replace(/(^|-)([a-z])/g, (_, separator, letter) =>
    `${separator ? " " : ""}${letter.toUpperCase()}`) ?? hairId;
}

function BodyChoice({ bodyType, selected, onPress, tone = "legacy" }: {
  tone?: Props["tone"];
  bodyType: BodyType;
  selected: boolean;
  onPress: () => void;
}) {
  const styles = tone === "parchment" ? parchmentStyles : legacyStyles;
  const Action = tone === "parchment" ? UiPressable : Pressable;
  return (
    <Action
      accessibilityRole="radio"
      accessibilityLabel={tone === "parchment" ? `Body: ${bodyType === "BOY" ? "Boy" : "Girl"}` : undefined}
      accessibilityState={{ checked: selected }}
      aria-checked={selected}
      onPress={onPress}
      style={({ pressed }) => [styles.bodyChoice, selected && styles.bodyChoiceSelected, pressed && styles.pressed]}
    >
      <Text style={[styles.bodyChoiceText, selected && styles.bodyChoiceTextSelected]}>
        {bodyType === "BOY" ? "Boy" : "Girl"}
      </Text>
    </Action>
  );
}

function Swatches({ label, options, selectedId, onSelect, tone = "legacy" }: {
  tone?: Props["tone"];
  label: string;
  options: readonly AppearanceColor[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const styles = tone === "parchment" ? parchmentStyles : legacyStyles;
  const Action = tone === "parchment" ? UiPressable : Pressable;
  return (
    <View>
      <Text accessibilityLiveRegion="polite" aria-live="polite" style={styles.selectedColor}>
        {options.find(({ id }) => id === selectedId)?.name}
      </Text>
      <View accessibilityRole="radiogroup" accessibilityLabel={label} style={styles.swatches}>
        {options.map((option) => {
          const selected = option.id === selectedId;
          return (
            <Action
              key={option.id}
              accessibilityRole="radio"
              accessibilityLabel={`${label}: ${option.name}`}
              accessibilityState={{ checked: selected }}
              aria-checked={selected}
              onPress={() => onSelect(option.id)}
              style={({ pressed }) => [
                styles.swatchShell,
                selected && styles.swatchSelected,
                pressed && styles.pressed,
              ]}
            >
              <View style={[styles.swatch, { backgroundColor: option.color }]} />
              {selected && <Text style={styles.swatchCheck}>✓</Text>}
            </Action>
          );
        })}
      </View>
    </View>
  );
}

const legacyStyles = StyleSheet.create({
  card: { gap: spacing.md },
  controlGroup: { gap: spacing.md },
  headingRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: spacing.md },
  headingCopy: { flex: 1 },
  title: { color: colors.text, fontSize: 24, fontWeight: "800" },
  subtitle: { color: colors.mutedText, fontSize: 13, lineHeight: 19, marginTop: 3 },
  unsavedBadge: { borderRadius: radius.pill, backgroundColor: "#5E4820", paddingHorizontal: 9, paddingVertical: 5 },
  unsavedText: { color: "#F1C66A", fontSize: 9, fontWeight: "900", letterSpacing: 0.8 },
  label: { color: colors.text, fontSize: 13, fontWeight: "800", marginTop: spacing.xs },
  bodyRow: { flexDirection: "row", gap: spacing.sm },
  bodyChoice: { flex: 1, minHeight: 44, alignItems: "center", justifyContent: "center", borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.cardLight },
  bodyChoiceSelected: { borderColor: colors.accent, backgroundColor: "#173329" },
  bodyChoiceText: { color: colors.mutedText, fontSize: 14, fontWeight: "800" },
  bodyChoiceTextSelected: { color: colors.accent },
  hairStyles: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  hairStyle: { minHeight: 44, justifyContent: "center", borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.cardLight, paddingHorizontal: spacing.sm },
  hairStyleSelected: { borderColor: colors.accent, backgroundColor: "#173329" },
  hairStyleText: { color: colors.mutedText, fontSize: 11, fontWeight: "700" },
  hairStyleTextSelected: { color: colors.accent },
  swatches: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  selectedColor: { color: colors.mutedText, fontSize: 12, marginBottom: spacing.sm },
  swatchShell: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "transparent" },
  swatchSelected: { borderColor: colors.accent, backgroundColor: colors.cardLight },
  swatch: { width: 28, height: 28, borderRadius: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.2)" },
  swatchCheck: { position: "absolute", color: colors.text, backgroundColor: colors.background, borderRadius: 8, width: 16, height: 16, textAlign: "center", fontSize: 12, lineHeight: 16, right: 0, bottom: 0 },
  saveButton: { minHeight: 46, alignItems: "center", justifyContent: "center", borderRadius: radius.md, backgroundColor: colors.accent },
  saveError: { color: colors.danger, fontSize: 13, lineHeight: 19 },
  saveButtonDisabled: { backgroundColor: colors.cardLight },
  saveText: { color: colors.background, fontSize: 13, fontWeight: "900" },
  saveTextDisabled: { color: colors.mutedText },
  pressed: { opacity: 0.76 },
});

const parchmentStyles = StyleSheet.create({
  ...legacyStyles,
  card: { gap: ui.spacing.lg, padding: ui.spacing.md },
  controlGroup: { gap: ui.spacing.sm },
  title: { ...ui.type.section, color: ui.colors.text, fontFamily: Platform.select(ui.font.display) },
  subtitle: { ...ui.type.caption, color: ui.colors.secondaryText, marginTop: ui.spacing.xs },
  headingRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "flex-start", gap: ui.spacing.sm },
  unsavedBadge: { borderRadius: ui.radius.pill, backgroundColor: ui.colors.warningSurface, paddingHorizontal: ui.spacing.sm, paddingVertical: ui.spacing.xs },
  unsavedText: { ...ui.type.caption, color: ui.colors.warning },
  label: { ...ui.type.label, color: ui.colors.text, marginTop: ui.spacing.xs },
  bodyRow: { flexDirection: "row", flexWrap: "wrap", gap: ui.spacing.xs, padding: ui.spacing.xs,
    borderRadius: ui.radius.lg, borderWidth: 1, borderColor: ui.colors.border, backgroundColor: ui.colors.paperInset },
  bodyChoice: { flex: 1, minWidth: ui.size.target, minHeight: ui.size.target, alignItems: "center", justifyContent: "center",
    borderRadius: ui.radius.md, borderWidth: 1, borderColor: ui.colors.controlBorder, backgroundColor: ui.colors.surface, padding: ui.spacing.sm },
  bodyChoiceSelected: { borderColor: ui.colors.gold, backgroundColor: ui.colors.primary },
  bodyChoiceText: { ...ui.type.label, color: ui.colors.secondaryText },
  bodyChoiceTextSelected: { color: ui.colors.onPrimary },
  hairStyles: { flexDirection: "row", flexWrap: "wrap", gap: ui.spacing.sm },
  hairStyle: { minHeight: ui.size.target, minWidth: ui.size.target, justifyContent: "center", borderRadius: ui.radius.md,
    borderWidth: 1, borderColor: ui.colors.controlBorder, backgroundColor: ui.colors.surface, paddingHorizontal: ui.spacing.sm, paddingVertical: ui.spacing.sm, maxWidth: "100%" },
  hairStyleSelected: { borderColor: ui.colors.gold, backgroundColor: ui.colors.primary },
  hairStyleText: { ...ui.type.label, color: ui.colors.secondaryText, flexShrink: 1 },
  hairStyleTextSelected: { color: ui.colors.onPrimary },
  swatches: { flexDirection: "row", flexWrap: "wrap", gap: ui.spacing.sm },
  selectedColor: { ...ui.type.caption, color: ui.colors.secondaryText },
  swatchShell: { width: ui.size.target, height: ui.size.target, borderRadius: ui.radius.pill, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: ui.colors.controlBorder },
  swatchSelected: { borderColor: ui.colors.primary, backgroundColor: ui.colors.successSurface },
  swatch: { ...legacyStyles.swatch, borderColor: ui.colors.controlBorder },
  swatchCheck: { ...legacyStyles.swatchCheck, color: ui.colors.onPrimary, backgroundColor: ui.colors.primary },
  saveButton: { minHeight: 52, alignItems: "center", justifyContent: "center", borderRadius: ui.radius.md, backgroundColor: "transparent", padding: 12 },
  saveButtonDisabled: { backgroundColor: "transparent" },
  saveError: { ...ui.type.body, color: ui.colors.danger },
  saveText: { ...ui.type.label, color: ui.colors.onPrimary },
  saveTextDisabled: { color: ui.colors.text },
});
