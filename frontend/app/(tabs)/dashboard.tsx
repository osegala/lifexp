import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { api, apiError } from "../../src/api/client";
import { apiRoutes } from "../../src/api/routes";
import LifeCard from "../../src/components/LifeCard";
import XPBar from "../../src/components/XPBar";
import { useAuth } from "../../src/context/AuthContext";
import { colors, spacing } from "../../src/theme/theme";
import type { AchievementsResponse, GoalsResponse } from "../../src/types";

export default function DashboardScreen() {
  const { user, refreshUser } = useAuth();
  const [goals, setGoals] = useState<GoalsResponse | null>(null);
  const [achievementData, setAchievementData] = useState<AchievementsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useFocusEffect(useCallback(() => {
    let active = true;
    async function loadDashboard() {
      try {
        setLoading(true);
        if (!await refreshUser()) return;
        const [goalsResponse, achievementsResponse] = await Promise.all([
          api.get<GoalsResponse>(apiRoutes.goals),
          api.get<AchievementsResponse>(apiRoutes.achievements),
        ]);
        if (active) {
          setGoals(goalsResponse.data);
          setAchievementData(achievementsResponse.data);
        }
      } catch (error) {
        Alert.alert("Home", apiError(error, "Could not load your progress.").message);
      } finally {
        if (active) setLoading(false);
      }
    }
    void loadDashboard();
    return () => { active = false; };
  }, [refreshUser]));

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text accessibilityRole="header" style={styles.title}>Home</Text>
        <Pressable onPress={() => router.navigate("/(tabs)/profile")} style={styles.profileButton}>
          <MaterialCommunityIcons name="account-cog" color={colors.primary} size={22} />
          <Text style={styles.profileButtonText}>Profile</Text>
        </Pressable>
      </View>

      <LifeCard>
        <Text style={styles.heroTitle}>{user?.username ?? "Adventurer"}</Text>
        <Text style={styles.heroMeta}>
          Level {user?.level ?? 1} · {user?.xpIntoLevel ?? 0} / {user?.xpForNextLevel ?? 100} XP
        </Text>
        <View style={styles.progress}><XPBar progress={(user?.progressPercent ?? 0) / 100} /></View>
      </LifeCard>

      {loading && !goals ? <ActivityIndicator color={colors.primary} /> : null}

      <View style={styles.grid}>
        <GoalCard title="Today" goal={goals?.daily.tasks} />
        <GoalCard title="This week" goal={goals?.weekly.tasks} />
      </View>

      <LifeCard compact>
        <View style={styles.row}>
          <Text style={styles.cardTitle}>World Points</Text>
          <Text style={styles.value}>{goals?.player.worldPoints ?? 0}</Text>
        </View>
        <Text style={styles.muted}>Goal rewards are granted automatically when tasks are completed.</Text>
      </LifeCard>

      <LifeCard compact>
        <View style={styles.row}>
          <Text style={styles.cardTitle}>Achievements</Text>
          <Text style={styles.value}>{achievementData?.summary.earned ?? 0}/{achievementData?.summary.total ?? 0}</Text>
        </View>
        {(achievementData?.achievements ?? []).slice(0, 3).map((achievement) => (
          <View key={achievement.achievementId} style={styles.achievement}>
            <MaterialCommunityIcons
              name={achievement.earned ? "trophy" : "lock-outline"}
              color={achievement.earned ? colors.accent : colors.mutedText}
              size={22}
            />
            <View style={styles.achievementCopy}>
              <Text style={styles.achievementName}>{achievement.name}</Text>
              <Text style={styles.muted}>{achievement.currentValue}/{achievement.requiredValue} · {achievement.description}</Text>
              {(achievement.rewards ?? []).length ? (
                <Text style={styles.muted}>Rewards: {(achievement.rewards ?? []).map((reward) => reward.name).join(", ")}</Text>
              ) : null}
            </View>
          </View>
        ))}
      </LifeCard>
    </ScrollView>
  );
}

function GoalCard({ title, goal }: { title: string; goal?: GoalsResponse["daily"]["tasks"] }) {
  return (
    <LifeCard compact style={styles.goalCard}>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.value}>{goal?.current ?? 0}/{goal?.target ?? 0}</Text>
      <XPBar progress={(goal?.progressPercent ?? 0) / 100} />
      <Text style={styles.muted}>
        {goal?.reward.granted
          ? `${goal.reward.worldPoints} World Points earned`
          : `${goal?.reward.worldPoints ?? 0} World Points at goal`}
      </Text>
    </LifeCard>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: 120, gap: spacing.lg },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { color: colors.text, fontSize: 30, fontWeight: "700" },
  profileButton: { flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.sm },
  profileButtonText: { color: colors.text, fontWeight: "600" },
  heroTitle: { color: colors.text, fontSize: 25, fontWeight: "800" },
  heroMeta: { color: colors.accent, fontSize: 16, marginTop: spacing.xs },
  progress: { marginTop: spacing.md },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  goalCard: { flexGrow: 1, flexBasis: 240 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: spacing.md },
  cardTitle: { color: colors.text, fontSize: 18, fontWeight: "700", marginBottom: spacing.sm },
  value: { color: colors.accent, fontSize: 20, fontWeight: "800" },
  muted: { color: colors.mutedText, marginTop: spacing.sm, lineHeight: 19 },
  achievement: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.sm },
  achievementCopy: { flex: 1 },
  achievementName: { color: colors.text, fontWeight: "700" },
});
