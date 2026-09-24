import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import LifeButton from "../src/components/LifeButton";
import LifeCard from "../src/components/LifeCard";
import { colors, spacing } from "../src/theme/theme";

export default function SocialBaseScreen() {
  return (
    <View style={styles.container}>
      <LifeCard style={styles.card}>
        <Text style={styles.title}>Social bases are unavailable</Text>
        <Text style={styles.copy}>This screen is disabled until the SAM backend exposes a social-base contract.</Text>
        <LifeButton title="Go back" onPress={() => router.back()} />
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
