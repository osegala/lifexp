import GameNotice from "../src/components/ui/GameNotice";
import { useFocusEffect, router } from "expo-router";
import { useCallback } from "react";
import { Platform, StyleSheet, Text } from "react-native";
import { useEntitlements } from "../src/entitlements/useEntitlements";
import LifeCard from "../src/components/LifeCard";
import LifeButton from "../src/components/LifeButton";
import { ScreenShell } from "../src/components/ui/Primitives";
import { uiTheme as ui } from "../src/theme/theme";
import { useAuth } from "../src/context/AuthContext";

export default function PremiumScreen() {
  const entitlement = useEntitlements();
  const { refresh } = entitlement;
  const { billing, billingState: state } = useAuth();
  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));
  useFocusEffect(useCallback(() => { if (state.ready) void billing.load(); }, [billing, state.ready]));
  return <ScreenShell contentContainerStyle={styles.content}>
    <Text accessibilityRole="header" style={styles.title}>Evrenthia Premium</Text>
    <LifeCard tone="parchment" framed>
      <Text style={styles.heading}>{entitlement.loading ? "Checking your plan…" : entitlement.premium ? "Premium · Ad-free" : "Free Plan"}</Text>
      {!!entitlement.error && <GameNotice title="Plan status unavailable" message={entitlement.error} variant="error" />}
      <Text style={styles.copy}>{entitlement.confirmed ? "Your plan is confirmed by Evrenthia." : "Your plan has not yet been confirmed."} Core productivity features remain available on the Free Plan.</Text>
    </LifeCard>
    <LifeCard tone="parchment" framed>
      <Text style={styles.heading}>Premium benefits</Text>
      <Text style={styles.copy}>• No ads</Text>
      <Text style={styles.copy}>• Premium cosmetic and content access as released</Text>
      <Text style={styles.copy}>• More premium benefits may be added later</Text>
    </LifeCard>
    {!billing.provider.available ? <Text style={styles.copy}>Subscriptions are available in the configured iOS/Android app, not on web or Expo Go. Store billing is currently unavailable here.</Text> : null}
    {state.error ? <GameNotice title="Store status" message={state.error} variant="error" /> : null}
    {state.message ? <GameNotice title={state.verificationPending ? "Verifying plan" : "Store status"} message={state.message}
      variant={state.verificationPending ? "info" : entitlement.premium ? "success" : "info"} /> : null}
    {entitlement.premium ? <LifeButton tone="parchment" title="Manage Subscription" disabled={state.busy || !state.ready} onPress={() => void billing.manage()} />
      : state.options.map(option => <LifeButton tone="parchment" key={option.id} title={`Subscribe ${option.label} · ${option.price}`}
        disabled={state.busy || !state.ready || state.verificationPending || !entitlement.confirmed || entitlement.loading}
        onPress={() => void billing.purchase(option.id)} />)}
    {!entitlement.premium && !state.options.length ? <LifeButton tone="parchment" title={state.busy ? "Loading store…" : "Load subscription prices"}
      disabled={state.busy || !billing.provider.available} onPress={() => void billing.load()} /> : null}
    <LifeButton tone="parchment" title="Restore Purchases" variant="secondary" disabled={state.busy || !state.ready} onPress={() => void billing.restore()} />
    {state.verificationPending ? <LifeButton tone="parchment" title="Retry plan verification" disabled={state.busy} onPress={() => void billing.sync()} /> : null}
    <Text style={styles.copy}>Subscriptions renew through your app store. Deleting an Evrenthia account does not cancel store billing.</Text>
    <LifeButton tone="parchment" title={entitlement.loading ? "Checking plan…" : "Refresh plan"} variant="secondary" disabled={entitlement.loading} onPress={() => void entitlement.refresh()} />
    <LifeButton tone="parchment" title="Back to Profile" variant="secondary" onPress={() => router.replace("/(tabs)/profile")} />
  </ScreenShell>;
}

const styles = StyleSheet.create({
  content: { gap: ui.spacing.md, maxWidth: 680 },
  title: { ...ui.type.display, fontFamily: Platform.select(ui.font.display), color: ui.colors.text },
  heading: { ...ui.type.section, fontFamily: Platform.select(ui.font.display), color: ui.colors.text },
  copy: { ...ui.type.body, color: ui.colors.secondaryText, marginTop: ui.spacing.sm },
});
