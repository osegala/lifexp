import { useCallback } from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { router, useFocusEffect } from "expo-router";

import { useAuth } from "../../src/context/AuthContext";
import LifeCard from "../../src/components/LifeCard";
import LifeButton from "../../src/components/LifeButton";
import XPBar from "../../src/components/XPBar";
import { colors, spacing } from "../../src/theme/theme";

export default function ProfileScreen() {
  const { user, logout, refreshUser } = useAuth();

  useFocusEffect(
    useCallback(() => {
      refreshUser();
    }, [refreshUser]),
  );

  async function handleLogout() {
    await logout();
    router.replace({ pathname: "/login" });
  }

  const totalXp = user?.totalXp ?? 0;
  const level = user?.level ?? 1;

  const xpForCurrentLevel = level * 100;
  const xpProgress = Math.min(
    (totalXp % xpForCurrentLevel) / xpForCurrentLevel,
    1,
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Profile</Text>
      <Text style={styles.subtitle}>Your LifeXP account and progress.</Text>

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
        <Text style={styles.cardTitle}>Account</Text>

        <View style={styles.statRow}>
          <Text style={styles.statLabel}>Username</Text>
          <Text style={styles.statValue}>{user?.username}</Text>
        </View>

        <View style={styles.statRow}>
          <Text style={styles.statLabel}>Email</Text>
          <Text style={styles.statValue}>{user?.email}</Text>
        </View>
      </LifeCard>

      <LifeButton title="Logout" variant="danger" onPress={handleLogout} />
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
    fontSize: 36,
    fontWeight: "900",
  },

  subtitle: {
    color: colors.mutedText,
    fontSize: 16,
    marginTop: -spacing.md,
  },

  profileCard: {
    alignItems: "center",
  },

  avatarCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.md,
  },

  avatarInitial: {
    color: colors.text,
    fontSize: 42,
    fontWeight: "900",
  },

  username: {
    color: colors.text,
    fontSize: 26,
    fontWeight: "900",
  },

  email: {
    color: colors.mutedText,
    fontSize: 15,
    marginTop: 4,
  },

  cardTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "900",
    marginBottom: spacing.md,
  },

  statRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },

  statLabel: {
    color: colors.mutedText,
    fontSize: 15,
    fontWeight: "700",
  },

  statValue: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "900",
    maxWidth: "60%",
    textAlign: "right",
  },

  xpBarWrapper: {
    marginTop: spacing.md,
  },
});
