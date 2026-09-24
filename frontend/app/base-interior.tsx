import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import LifeButton from "../src/components/LifeButton";
import LifeCard from "../src/components/LifeCard";
import { colors, spacing } from "../src/theme/theme";

export default function BaseInteriorScreen() {
  return (
    <View style={styles.container}>
      <LifeCard style={styles.card}>
        <Text style={styles.title}>Interiors are unavailable</Text>
        <Text style={styles.copy}>Interior loading and saving need a future backend API. No production request is made from this screen.</Text>
        <LifeButton title="Back to world" onPress={() => router.back()} />
      </LifeCard>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.lg, justifyContent: "center" },
  card: { alignItems: "center", gap: spacing.md },
  title: { color: colors.text, fontSize: 22, fontWeight: "700", textAlign: "center" },
  copy: { color: colors.mutedText, textAlign: "center", lineHeight: 21 },
});
