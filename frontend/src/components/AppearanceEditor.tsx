import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import {
  EYE_COLORS,
  HAIR_COLORS,
  SKIN_COLORS,
} from "../avatar/appearance";
import type { AppearanceColor, AvatarAppearance, BodyType } from "../avatar/appearance";
import { colors, radius, spacing } from "../theme/theme";
import LifeCard from "./LifeCard";

type Props = {
  appearance: AvatarAppearance;
  dirty: boolean;
  saving: boolean;
  onChange: (patch: Partial<AvatarAppearance>) => void;
  onSave: () => void;
};

export default function AppearanceEditor({ appearance, dirty, saving, onChange, onSave }: Props) {
  return (
    <LifeCard style={styles.card}>
      <View style={styles.headingRow}>
        <View style={styles.headingCopy}>
          <Text accessibilityRole="header" style={styles.title}>Appearance</Text>
          <Text style={styles.subtitle}>Shape your hero, then save all appearance choices together.</Text>
        </View>
        {dirty && <View style={styles.unsavedBadge}><Text style={styles.unsavedText}>UNSAVED</Text></View>}
      </View>

      <Text style={styles.label}>Body</Text>
      <View style={styles.bodyRow}>
        {(["BOY", "GIRL"] as const).map((bodyType) => (
          <BodyChoice
            key={bodyType}
            bodyType={bodyType}
            selected={appearance.bodyType === bodyType}
            onPress={() => onChange({ bodyType })}
          />
        ))}
      </View>

      <Text style={styles.label}>Skin tone</Text>
      <Swatches options={SKIN_COLORS} selectedId={appearance.skinColorId} onSelect={(skinColorId) => onChange({ skinColorId })} />

      <Text style={styles.label}>Hair color</Text>
      <Swatches options={HAIR_COLORS} selectedId={appearance.hairColorId} onSelect={(hairColorId) => onChange({ hairColorId })} />

      <Text style={styles.label}>Eye color</Text>
      <Swatches options={EYE_COLORS} selectedId={appearance.eyeColorId} onSelect={(eyeColorId) => onChange({ eyeColorId })} />

      <Text style={styles.hairHint}>Choose a hair style from the Hair shelf below.</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Save appearance"
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
      </Pressable>
    </LifeCard>
  );
}

function BodyChoice({ bodyType, selected, onPress }: {
  bodyType: BodyType;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.bodyChoice, selected && styles.bodyChoiceSelected, pressed && styles.pressed]}
    >
      <Text style={[styles.bodyChoiceText, selected && styles.bodyChoiceTextSelected]}>
        {bodyType === "BOY" ? "Boy" : "Girl"}
      </Text>
    </Pressable>
  );
}

function Swatches({ options, selectedId, onSelect }: {
  options: readonly AppearanceColor[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <View accessibilityRole="radiogroup" style={styles.swatches}>
      {options.map((option) => {
        const selected = option.id === selectedId;
        return (
          <Pressable
            key={option.id}
            accessibilityRole="radio"
            accessibilityLabel={option.name}
            accessibilityState={{ checked: selected }}
            hitSlop={4}
            onPress={() => onSelect(option.id)}
            style={({ pressed }) => [
              styles.swatchShell,
              selected && styles.swatchSelected,
              pressed && styles.pressed,
            ]}
          >
            <View style={[styles.swatch, { backgroundColor: option.color }]} />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
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
  swatches: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  swatchShell: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "transparent" },
  swatchSelected: { borderColor: colors.accent, backgroundColor: colors.cardLight },
  swatch: { width: 28, height: 28, borderRadius: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.2)" },
  hairHint: { color: colors.mutedText, fontSize: 12 },
  saveButton: { minHeight: 46, alignItems: "center", justifyContent: "center", borderRadius: radius.md, backgroundColor: colors.accent },
  saveButtonDisabled: { backgroundColor: colors.cardLight },
  saveText: { color: colors.background, fontSize: 13, fontWeight: "900" },
  saveTextDisabled: { color: colors.mutedText },
  pressed: { opacity: 0.76 },
});
