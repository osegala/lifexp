import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { BannerAdPlacement } from "../../src/ads/Ads";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, AppState, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { api, apiError } from "../../src/api/client";
import { apiRoutes } from "../../src/api/routes";
import LifeCard from "../../src/components/LifeCard";
import XPBar from "../../src/components/XPBar";
import QuestProgress from "../../src/components/QuestProgress";
import { useAuth } from "../../src/context/AuthContext";
import { colors, spacing } from "../../src/theme/theme";
import type { AchievementsResponse, GoalsResponse } from "../../src/types";

export default function DashboardScreen() {
  const { user, refreshUser } = useAuth();
  const [goals, setGoals] = useState<GoalsResponse | null>(null);
  const [achievementData, setAchievementData] = useState<AchievementsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [questError, setQuestError] = useState(false);

  useFocusEffect(useCallback(() => {
    let active = true;
    let refreshing = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function refreshGoals() {
      if (!active || refreshing) return;
      refreshing = true;
      clearTimeout(timer);
      let delay = 60_000;
      try {
        const result = await api.get<GoalsResponse>(apiRoutes.goals);
        if (active) {
          setGoals(result.data);
          setQuestError(false);
          // The server schedules local midnight, including DST. A bounded refresh
          // also picks up timezone/building changes without using the device date.
          delay = Math.max(1000, Math.min(delay, result.data.refreshAfterMs ?? delay));
        }
      } catch {
        if (active) setQuestError(true); // Keep the last confirmed snapshot.
      } finally {
        refreshing = false;
        if (active) {
          setLoading(false);
          if (AppState.currentState !== "background" && AppState.currentState !== "inactive") {
            timer = setTimeout(() => { void refreshGoals(); }, delay);
          }
        }
      }
    }
    async function loadDashboard() {
      try {
        setLoading(true);
        if (!await refreshUser()) return;
        const [, achievementsResponse] = await Promise.all([
          refreshGoals(), api.get<AchievementsResponse>(apiRoutes.achievements),
        ]);
        if (active) {
          setAchievementData(achievementsResponse.data);
        }
      } catch (error) {
        Alert.alert("Home", apiError(error, "Could not load your progress.").message);
      } finally {
        if (active) setLoading(false);
      }
    }
    void loadDashboard();
    const subscription = AppState.addEventListener("change", state => {
      if (state === "active") void refreshGoals();
      else clearTimeout(timer);
    });
    return () => { active = false; clearTimeout(timer); subscription.remove(); };
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

      {questError && <Text accessibilityRole="alert" style={styles.muted}>
        {goals ? "Could not refresh quests. Showing last confirmed progress; retrying shortly." : "Could not load quests. Retrying shortly."}
      </Text>}
      {goals ? <QuestProgress goals={goals} /> : !loading && !questError
        ? <Text style={styles.muted}>Quest status is unavailable.</Text> : null}

      <LifeCard compact>
        <View style={styles.row}>
          <Text style={styles.cardTitle}>World Points</Text>
          <Text style={styles.value}>{goals?.player.worldPoints ?? "—"}</Text>
        </View>
        <Text style={styles.muted}>Quest rewards are granted automatically when tasks are completed.</Text>
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
      <BannerAdPlacement placement="HOME" />
    </ScrollView>
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
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: spacing.md },
  cardTitle: { color: colors.text, fontSize: 18, fontWeight: "700", marginBottom: spacing.sm },
  value: { color: colors.accent, fontSize: 20, fontWeight: "800" },
  muted: { color: colors.mutedText, marginTop: spacing.sm, lineHeight: 19 },
  achievement: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.sm },
  achievementCopy: { flex: 1 },
  achievementName: { color: colors.text, fontWeight: "700" },
});
