import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { StyleSheet, Text, View } from "react-native";
import LifeCard from "../../src/components/LifeCard";
import { colors, spacing } from "../../src/theme/theme";

export default function SocialScreen() {
  return (
    <View style={styles.container}>
      <LifeCard style={styles.card}>
        <MaterialCommunityIcons name="account-group-outline" color={colors.mutedText} size={42} />
        <Text style={styles.title}>Social is unavailable</Text>
        <Text style={styles.copy}>Friends, chat, search, and visiting other bases need a future backend API.</Text>
      </LifeCard>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.lg, justifyContent: "center" },
  card: { alignItems: "center" },
  title: { color: colors.text, fontSize: 22, fontWeight: "700", marginTop: spacing.md },
  copy: { color: colors.mutedText, textAlign: "center", lineHeight: 21, marginTop: spacing.sm },
});
