import { showGameNotice } from "../../src/feedback/notices";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, View, StyleSheet } from "react-native";
import { router, useFocusEffect } from "expo-router";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";

import { useAuth } from "../../src/context/AuthContext";
import { ScreenShell, SectionHeader, SurfaceCard, UiText } from "../../src/components/ui/Primitives";
import { BadgePill } from "../../src/components/ui/Indicators";
import NotificationSettings from "../../src/components/NotificationSettings";
import { DestructiveButton, PrimaryButton, SecondaryButton } from "../../src/components/ui/Buttons";
import XPBar from "../../src/components/XPBar";
import { uiTheme as ui } from "../../src/theme/theme";
import LifeInput from "../../src/components/LifeInput";
import { api, apiError } from "../../src/api/client";
import { apiRoutes } from "../../src/api/routes";
import { clearLocalAccountData } from "../../src/storage/localAccountData";
import { disableCurrentDevice } from "../../src/notifications/device";
import { useEntitlements } from "../../src/entitlements/useEntitlements";
import { timeZoneLabel } from "../../src/utils/timeZone";
import type { AxiosRequestConfig } from "axios";
import { playerCache } from "../../src/cache/playerData";
import type { ProfileResponse } from "../../src/auth/session";

export default function ProfileScreen() {
  const { user, logout, clearDeletedAccountSession, refreshUser } = useAuth();
  const entitlement = useEntitlements();
  const [loggingOut, setLoggingOut] = useState(false);
  const [displayName, setDisplayName] = useState(user?.username ?? "");
  const [saving, setSaving] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const deletionPending = useRef(false);

  useFocusEffect(
    useCallback(() => {
      void refreshUser();
    }, [refreshUser]),
  );

  useEffect(() => {
    if (user) {
      setDisplayName(user.username);
    }
  }, [user]);

  async function saveProfile() {
    if (!user) return;
    try {
      setSaving(true);
      playerCache.invalidate(user.id, ["profile"]);
      const accountCurrent = playerCache.accountCurrent(user.id);
      const saved = await api.patch<Partial<ProfileResponse>>(apiRoutes.me, {
        displayName: displayName.trim(),
      }, { expectedUserId: String(user.id) } as AxiosRequestConfig);
      if (!accountCurrent()) return;
      playerCache.invalidate(user.id, ["profile"]);
      const profile = playerCache.peek(user.id, "profile");
      if (profile && typeof saved.data.displayName === "string") playerCache.set(user.id, "profile", { ...profile, displayName: saved.data.displayName });
      await refreshUser();
      showGameNotice("Profile saved", "Profile settings saved.", "success");
    } catch (error) {
      showGameNotice("Profile", apiError(error, "Could not save profile settings.").message, "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await logout();
      router.replace({ pathname: "/login" });
    } catch {
      showGameNotice("Could not sign out", "We could not disable device notifications or clear your sign-in. Reconnect and try again.", "error");
    } finally {
      setLoggingOut(false);
    }
  }

  async function deleteAccount() {
    if (deletionPending.current) return;
    deletionPending.current = true;
    setDeletingAccount(true);
    try {
      await disableCurrentDevice();
      await api.delete(apiRoutes.me);
      await Promise.allSettled([
        clearLocalAccountData(user?.id),
        clearDeletedAccountSession(),
      ]);
      router.replace({ pathname: "/login" });
    } catch (error) {
      showGameNotice("Account not deleted", apiError(error, "Could not delete your account. Please try again.").message, "error");
    } finally {
      deletionPending.current = false;
      setDeletingAccount(false);
    }
  }

  function confirmAccountDeletion() {
    if (deletionPending.current) return;
    Alert.alert(
      "Delete Account",
      "This permanently deletes your Evrenthia account and all associated game data. This action cannot be undone. Deleting this account does not cancel an Apple or Google subscription; manage billing separately in your app store.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete My Account", style: "destructive", onPress: () => void deleteAccount() },
      ],
    );
  }

  const totalXp = user?.totalXp ?? 0;
  const level = user?.level ?? 1;
  const xpIntoLevel = user?.xpIntoLevel ?? 0;
  const xpForNextLevel = user?.xpForNextLevel ?? 100;
  const xpProgress = Math.min(xpIntoLevel / xpForNextLevel, 1);

  return <ScreenShell keyboardSafe>
    <View style={styles.header}>
      <UiText variant="display" accessibilityRole="header" aria-level={1}>Profile</UiText>
      <SecondaryButton title="Home" accessibilityLabel="Back to Home" onPress={() => router.navigate("/(tabs)/dashboard")}
        leading={<MaterialCommunityIcons name="arrow-left" color={ui.colors.primary} size={18} accessible={false} aria-hidden />} style={styles.back} />
    </View>
    <SurfaceCard framed style={styles.identity}>
      <View style={styles.initial}><UiText variant="section" style={styles.onPrimary}>{(user?.username?.[0] ?? "H").toUpperCase()}</UiText></View>
      <View style={styles.identityCopy}><UiText variant="section">{user?.username ?? "Hero"}</UiText>
        <UiText variant="caption" style={styles.secondary}>{user?.email ?? "No email found"}</UiText></View>
    </SurfaceCard>
    <SurfaceCard framed style={styles.section}>
      <SectionHeader title="Your progress" trailing={<BadgePill label={`Lv. ${level}`} />} />
      <View style={styles.statRow}><UiText variant="caption" style={styles.secondary}>{totalXp} total XP</UiText><UiText variant="caption">{xpIntoLevel} / {xpForNextLevel} XP</UiText></View>
      <XPBar tone="parchment" progress={xpProgress} />
    </SurfaceCard>
    <SurfaceCard framed style={styles.section}>
      <SectionHeader title="Account & preferences" />
      <UiText variant="label">Display name</UiText>
      <LifeInput tone="parchment" accessibilityLabel="Display name" value={displayName} onChangeText={setDisplayName} placeholder="Adventurer" />
      <UiText variant="label">Time zone · Automatic</UiText>
      <UiText>{timeZoneLabel(user?.timeZone ?? "UTC")}</UiText>
      <UiText variant="caption" style={styles.secondary}>Follows your device’s time zone for task dates and reminders. No location access needed.</UiText>
      <PrimaryButton title={saving ? "Saving…" : "Save settings"} onPress={saveProfile} disabled={saving || !displayName.trim()} />
    </SurfaceCard>
    <SurfaceCard framed style={styles.premium}>
      <SectionHeader title={entitlement.loading ? "Checking plan…" : entitlement.premium ? "Premium" : "Free Plan"}
        trailing={<MaterialCommunityIcons name="crown-outline" color={ui.colors.coin} size={24} accessible={false} />} />
      <UiText variant="caption" style={styles.secondary}>{entitlement.premium ? "Ad-free" : "Your core productivity features are included."}</UiText>
      {!!entitlement.error && <UiText accessibilityRole="alert" style={styles.secondary}>{entitlement.error}</UiText>}
      <PrimaryButton title={entitlement.premium ? "View Premium" : "Upgrade to Premium"} onPress={() => router.push("/premium")} />
    </SurfaceCard>
    <NotificationSettings tone="parchment" timeZone={user?.timeZone ?? "UTC"} />
    <SurfaceCard framed style={styles.section}>
      <SectionHeader title="Account actions" />
      <SecondaryButton title={loggingOut ? "Signing out…" : "Logout"} onPress={handleLogout} disabled={loggingOut} />
      <View style={styles.destructive}>
        <UiText variant="label" style={styles.danger}>Delete Account</UiText>
        <UiText variant="caption" style={styles.secondary}>Permanently delete your account, game progress, tasks, purchases, and settings. This does not cancel Apple or Google subscription billing.</UiText>
        <DestructiveButton title={deletingAccount ? "Deleting Account…" : "Delete Account"} onPress={confirmAccountDeletion} disabled={deletingAccount || loggingOut} />
      </View>
    </SurfaceCard>
  </ScreenShell>;
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: ui.spacing.sm },
  back: { paddingHorizontal: ui.spacing.md },
  identity: { flexDirection: "row", alignItems: "center", gap: ui.spacing.md, paddingVertical: ui.spacing.lg },
  initial: { width: 52, height: 52, borderRadius: ui.radius.pill, backgroundColor: ui.colors.primaryPressed, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: ui.colors.gold },
  onPrimary: { color: ui.colors.onPrimary },
  identityCopy: { flex: 1, gap: ui.spacing.xs },
  section: { gap: ui.spacing.sm },
  statRow: { flexDirection: "row", justifyContent: "space-between", flexWrap: "wrap", gap: ui.spacing.sm },
  secondary: { color: ui.colors.secondaryText },
  premium: { gap: ui.spacing.sm, borderLeftWidth: 0, borderLeftColor: ui.colors.gold },
  destructive: { paddingTop: ui.spacing.md, borderTopWidth: 1, borderTopColor: ui.colors.divider, gap: ui.spacing.sm },
  danger: { color: ui.colors.danger },
});
