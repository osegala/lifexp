import { useFocusEffect, router } from "expo-router";
import { useCallback } from "react";
import { ScrollView, StyleSheet, Text } from "react-native";
import { useEntitlements } from "../src/entitlements/useEntitlements";
import LifeCard from "../src/components/LifeCard";
import LifeButton from "../src/components/LifeButton";
import { colors, spacing } from "../src/theme/theme";
import { useAuth } from "../src/context/AuthContext";

export default function PremiumScreen() {
  const entitlement = useEntitlements();
  const { refresh } = entitlement;
  const { billing, billingState: state } = useAuth();
  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));
  useFocusEffect(useCallback(() => { if (state.ready) void billing.load(); }, [billing, state.ready]));
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
    {!billing.provider.available ? <Text style={styles.copy}>Subscriptions are available in the configured iOS/Android app, not on web or Expo Go. Store billing is currently unavailable here.</Text> : null}
    {state.error ? <Text accessibilityRole="alert" style={styles.copy}>{state.error}</Text> : null}
    {state.message ? <Text accessibilityLiveRegion="polite" style={styles.copy}>{state.message}</Text> : null}
    {entitlement.premium ? <LifeButton title="Manage Subscription" disabled={state.busy || !state.ready} onPress={() => void billing.manage()} />
      : state.options.map(option => <LifeButton key={option.id} title={`Subscribe ${option.label} · ${option.price}`}
        disabled={state.busy || !state.ready || state.verificationPending || !entitlement.confirmed || entitlement.loading}
        onPress={() => void billing.purchase(option.id)} />)}
    {!entitlement.premium && !state.options.length ? <LifeButton title={state.busy ? "Loading store…" : "Load subscription prices"}
      disabled={state.busy || !billing.provider.available} onPress={() => void billing.load()} /> : null}
    <LifeButton title="Restore Purchases" variant="secondary" disabled={state.busy || !state.ready} onPress={() => void billing.restore()} />
    {state.verificationPending ? <LifeButton title="Retry plan verification" disabled={state.busy} onPress={() => void billing.sync()} /> : null}
    <Text style={styles.copy}>Subscriptions renew through your app store. Deleting an Evrenthia account does not cancel store billing.</Text>
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
