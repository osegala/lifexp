import { View, Text, StyleSheet } from "react-native";
import { router } from "expo-router";

import LifeButton from "../src/components/LifeButton";
import LifeCard from "../src/components/LifeCard";

import { colors, spacing } from "../src/theme/theme";

export default function ModalScreen() {
  return (
    <View style={styles.container}>
      <LifeCard style={styles.card}>
        <Text style={styles.title}>LifeXP</Text>

        <Text style={styles.subtitle}>
          Complete tasks, earn XP, and level up your real life.
        </Text>

        <View style={styles.buttonContainer}>
          <LifeButton
            title="Go to Dashboard"
            onPress={() => router.replace("/(tabs)/dashboard")}
          />

          <LifeButton
            title="Close"
            variant="secondary"
            onPress={() => router.back()}
          />
        </View>
      </LifeCard>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.lg,
  },

  card: {
    width: "100%",
    maxWidth: 420,
    alignItems: "center",
    gap: spacing.lg,
  },

  title: {
    color: colors.text,
    fontSize: 32,
    fontWeight: "900",
  },

  subtitle: {
    color: colors.mutedText,
    textAlign: "center",
    fontSize: 16,
    lineHeight: 24,
  },

  buttonContainer: {
    width: "100%",
    gap: spacing.md,
  },
});
