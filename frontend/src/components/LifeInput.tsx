import { TextInput, StyleSheet, TextInputProps } from "react-native";
import { colors, radius, spacing } from "../theme/theme";

export default function LifeInput(props: TextInputProps) {
  return (
    <TextInput
      placeholderTextColor={colors.mutedText}
      style={styles.input}
      {...props}
    />
  );
}

const styles = StyleSheet.create({
  input: {
    backgroundColor: colors.card,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: 16,
  },
});