import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { router, useFocusEffect } from "expo-router";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";

import { useAuth } from "../../src/context/AuthContext";
import LifeCard from "../../src/components/LifeCard";
import LifeButton from "../../src/components/LifeButton";
import XPBar from "../../src/components/XPBar";
import { colors, spacing } from "../../src/theme/theme";
import LifeInput from "../../src/components/LifeInput";
import { api, apiError } from "../../src/api/client";
import { apiRoutes } from "../../src/api/routes";
import { clearLocalAccountData } from "../../src/storage/localAccountData";

export default function ProfileScreen() {
  const { user, logout, clearDeletedAccountSession, refreshUser } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);
  const [displayName, setDisplayName] = useState(user?.username ?? "");
  const [timeZone, setTimeZone] = useState(user?.timeZone ?? "UTC");
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
      setTimeZone(user.timeZone);
    }
  }, [user]);

  async function saveProfile() {
    try {
      setSaving(true);
      await api.patch(apiRoutes.me, {
        displayName: displayName.trim(),
        timeZone: timeZone.trim(),
      });
      await refreshUser();
      Alert.alert("Profile", "Profile settings saved.");
    } catch (error) {
      Alert.alert("Profile", apiError(error, "Could not save profile settings.").message);
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
      Alert.alert("Could not sign out", "Your saved sign-in couldn't be removed. Please try again.");
    } finally {
      setLoggingOut(false);
    }
  }

  async function deleteAccount() {
    if (deletionPending.current) return;
    deletionPending.current = true;
    setDeletingAccount(true);
    try {
      await api.delete(apiRoutes.me);
      await Promise.allSettled([
        clearLocalAccountData(),
        clearDeletedAccountSession(),
      ]);
      router.replace({ pathname: "/login" });
    } catch (error) {
      Alert.alert("Account not deleted", apiError(error, "Could not delete your account. Please try again.").message);
    } finally {
      deletionPending.current = false;
      setDeletingAccount(false);
    }
  }

  function confirmAccountDeletion() {
    if (deletionPending.current) return;
    Alert.alert(
      "Delete Account",
      "This permanently deletes your Evrenthia account and all associated game data. This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete My Account", style: "destructive", onPress: () => void deleteAccount() },
      ],
    );
  }

  const totalXp = user?.totalXp ?? 0;
  const level = user?.level ?? 1;

  const xpForCurrentLevel = level * 100;
  const xpProgress = Math.min(
    (totalXp % xpForCurrentLevel) / xpForCurrentLevel,
    1,
  );

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      alwaysBounceVertical={false}
      bounces={false}
      overScrollMode="never"
    >
      <View style={styles.header}>
        <Text accessibilityRole="header" style={styles.title}>Profile</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to Home"
          onPress={() => router.navigate("/(tabs)/dashboard")}
          style={({ pressed }) => [styles.homeButton, pressed && styles.buttonPressed]}
        >
          <MaterialCommunityIcons name="arrow-left" color={colors.primary} size={22} />
          <Text style={styles.homeButtonText}>Home</Text>
        </Pressable>
      </View>

      <LifeCard style={styles.profileCard}>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarInitial}>
            {(user?.username?.[0] ?? "H").toUpperCase()}
          </Text>
        </View>

        <Text style={styles.username}>{user?.username ?? "Hero"}</Text>
        <Text style={styles.email}>{user?.email ?? "No email found"}</Text>
      </LifeCard>

      <LifeCard>
        <Text style={styles.cardTitle}>Progress</Text>

        <View style={styles.statRow}>
          <Text style={styles.statLabel}>Level</Text>
          <Text style={styles.statValue}>{level}</Text>
        </View>

        <View style={styles.statRow}>
          <Text style={styles.statLabel}>Total XP</Text>
          <Text style={styles.statValue}>{totalXp}</Text>
        </View>

        <View style={styles.xpBarWrapper}>
          <XPBar progress={xpProgress} />
        </View>
      </LifeCard>

      <LifeCard>
        <Text style={styles.cardTitle}>Profile settings</Text>

        <Text style={styles.statLabel}>Display name</Text>
        <LifeInput value={displayName} onChangeText={setDisplayName} placeholder="Adventurer" />

        <Text style={styles.statLabel}>Time zone</Text>
        <LifeInput value={timeZone} onChangeText={setTimeZone} placeholder="America/New_York" autoCapitalize="none" />
        <Text style={styles.helper}>Use an IANA time zone. Task dates and reminders use this setting.</Text>

        <View style={styles.statRow}>
          <Text style={styles.statLabel}>Email</Text>
          <Text style={styles.statValue}>{user?.email}</Text>
        </View>

        <LifeButton title={saving ? "Saving…" : "Save settings"} onPress={saveProfile} disabled={saving || !displayName.trim() || !timeZone.trim()} />
      </LifeCard>

      <LifeButton title={loggingOut ? "Signing out…" : "Logout"} variant="danger" onPress={handleLogout} disabled={loggingOut} />

      <LifeCard>
        <Text style={styles.cardTitle}>Delete Account</Text>
        <Text style={styles.helper}>Permanently delete your account, game progress, tasks, purchases, and settings.</Text>
        <LifeButton
          title={deletingAccount ? "Deleting Account…" : "Delete Account"}
          variant="danger"
          onPress={confirmAccountDeletion}
          disabled={deletingAccount || loggingOut}
        />
      </LifeCard>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  content: {
    padding: spacing.lg,
    paddingBottom: 120,
    gap: spacing.lg,
  },

  title: {
    color: colors.text,
    fontSize: 30,
    fontWeight: "700",
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    flexWrap: "wrap",
  },

  homeButton: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },

  homeButtonText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "600",
  },

  buttonPressed: {
    backgroundColor: colors.cardLight,
  },

  profileCard: {
    alignItems: "center",
  },

  avatarCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.cardLight,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.md,
  },

  avatarInitial: {
    color: colors.text,
    fontSize: 36,
    fontWeight: "700",
  },

  username: {
    color: colors.text,
    fontSize: 24,
    fontWeight: "700",
  },

  email: {
    color: colors.mutedText,
    fontSize: 15,
    marginTop: 4,
  },

  cardTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "700",
    marginBottom: spacing.md,
  },

  statRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
    justifyContent: "space-between",
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },

  statLabel: {
    color: colors.mutedText,
    fontSize: 15,
    fontWeight: "500",
  },

  statValue: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "600",
    flex: 1,
    textAlign: "right",
  },

  xpBarWrapper: {
    marginTop: spacing.md,
  },
  helper: {
    color: colors.mutedText,
    fontSize: 13,
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
});
