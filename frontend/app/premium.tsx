import { useFocusEffect, router } from "expo-router";
import { useCallback } from "react";
import { ScrollView, StyleSheet, Text } from "react-native";
import { useEntitlements } from "../src/entitlements/useEntitlements";
import LifeCard from "../src/components/LifeCard";
import LifeButton from "../src/components/LifeButton";
import { colors, spacing } from "../src/theme/theme";

export default function PremiumScreen() {
  const entitlement = useEntitlements();
  const { refresh } = entitlement;
  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));
  return <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
    <Text accessibilityRole="header" style={styles.title}>Evrenthia Premium</Text>
    <LifeCard>
      <Text style={styles.heading}>{entitlement.loading ? "Checking your plan…" : entitlement.premium ? "Premium · Ad-free" : "Free Plan"}</Text>
      {!!entitlement.error && <Text accessibilityRole="alert" style={styles.copy}>{entitlement.error}</Text>}
      <Text style={styles.copy}>{entitlement.confirmed ? "Your plan is confirmed by Evrenthia." : "Your plan has not yet been confirmed."} Core productivity features remain available on the Free Plan.</Text>
    </LifeCard>
    <LifeCard>
      <Text style={styles.heading}>Premium benefits</Text>
      <Text style={styles.copy}>• No ads</Text>
      <Text style={styles.copy}>• Premium cosmetic and content access as released</Text>
      <Text style={styles.copy}>• More premium benefits may be added later</Text>
    </LifeCard>
    <Text style={styles.copy}>Purchases are not available in this version. Subscription purchase and restore will become available after store verification is connected.</Text>
    <LifeButton title="Purchases unavailable" disabled onPress={() => {}} />
    <LifeButton title={entitlement.loading ? "Checking plan…" : "Refresh plan"} variant="secondary" disabled={entitlement.loading} onPress={() => void entitlement.refresh()} />
    <LifeButton title="Back to Profile" variant="secondary" onPress={() => router.replace("/(tabs)/profile")} />
  </ScrollView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xl, gap: spacing.md, width: "100%", maxWidth: 680, alignSelf: "center" },
  title: { color: colors.text, fontSize: 28, fontWeight: "700" },
  heading: { color: colors.text, fontSize: 18, fontWeight: "700" },
  copy: { color: colors.mutedText, fontSize: 15, lineHeight: 22, marginTop: spacing.sm },
});
