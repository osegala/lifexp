import { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { useFocusEffect } from "expo-router";

import { api } from "../../src/api/client";
import { useAuth } from "../../src/context/AuthContext";
import LifeCard from "../../src/components/LifeCard";
import LifeButton from "../../src/components/LifeButton";
import XPBar from "../../src/components/XPBar";
import AvatarRenderer from "../../src/components/AvatarRenderer";
import { colors, spacing } from "../../src/theme/theme";

type Avatar = {
  equippedHatId: number | null;
  equippedOutfitId: number | null;
  equippedBackgroundId: number | null;
  equippedPetId: number | null;
  equippedAuraId: number | null;
};

export default function DashboardScreen() {
  const { user, refreshUser } = useAuth();
  const [avatar, setAvatar] = useState<Avatar | null>(null);

  useFocusEffect(
    useCallback(() => {
      async function loadDashboard() {
        await refreshUser();

        const res = await api.get<Avatar>("/avatar");
        setAvatar(res.data);
      }

      loadDashboard();
    }, [refreshUser]),
  );

  const totalXp = user?.totalXp ?? 0;
  const level = user?.level ?? 1;

  const xpForCurrentLevel = level * 100;
  const xpProgress = Math.min(
    (totalXp % xpForCurrentLevel) / xpForCurrentLevel,
    1,
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Dashboard</Text>
      <Text style={styles.subtitle}>
        Welcome back, {user?.username ?? "Hero"}.
      </Text>

      <LifeCard style={styles.heroCard}>
        <AvatarRenderer
          hatId={avatar?.equippedHatId}
          outfitId={avatar?.equippedOutfitId}
          auraId={avatar?.equippedAuraId}
        />

        <Text style={styles.level}>Level {level}</Text>
        <Text style={styles.xpText}>{totalXp} Total XP</Text>

        <View style={styles.xpBarWrapper}>
          <XPBar progress={xpProgress} />
        </View>
      </LifeCard>

      <View style={styles.statsGrid}>
        <LifeCard style={styles.statCard}>
          <Text style={styles.statValue}>🔥</Text>
          <Text style={styles.statLabel}>Streak</Text>
          <Text style={styles.statSubtext}>Coming soon</Text>
        </LifeCard>

        <LifeCard style={styles.statCard}>
          <Text style={styles.statValue}>⚔️</Text>
          <Text style={styles.statLabel}>Rank</Text>
          <Text style={styles.statSubtext}>Adventurer</Text>
        </LifeCard>
      </View>

      <LifeCard>
        <Text style={styles.cardTitle}>Today’s Goal</Text>
        <Text style={styles.cardText}>
          Complete at least one task today to keep leveling up.
        </Text>

        <View style={styles.buttonSpacing}>
          <LifeButton title="Refresh Stats" onPress={refreshUser} />
        </View>
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
    fontSize: 36,
    fontWeight: "900",
  },

  subtitle: {
    color: colors.mutedText,
    fontSize: 16,
    marginTop: -spacing.md,
  },

  heroCard: {
    alignItems: "center",
  },

  level: {
    color: colors.text,
    fontSize: 26,
    fontWeight: "900",
    marginTop: spacing.md,
  },

  xpText: {
    color: colors.accent,
    fontSize: 16,
    fontWeight: "800",
    marginTop: 4,
  },

  xpBarWrapper: {
    width: "100%",
    marginTop: spacing.md,
  },

  statsGrid: {
    flexDirection: "row",
    gap: spacing.md,
  },

  statCard: {
    flex: 1,
    alignItems: "center",
  },

  statValue: {
    fontSize: 32,
    marginBottom: spacing.sm,
  },

  statLabel: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900",
  },

  statSubtext: {
    color: colors.mutedText,
    marginTop: 4,
  },

  cardTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "900",
    marginBottom: spacing.sm,
  },

  cardText: {
    color: colors.mutedText,
    fontSize: 16,
    lineHeight: 24,
  },

  buttonSpacing: {
    marginTop: spacing.lg,
  },
});
