import { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { useFocusEffect } from "expo-router";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";

import { api } from "../../src/api/client";
import { useAuth } from "../../src/context/AuthContext";
import LifeCard from "../../src/components/LifeCard";
import LifeButton from "../../src/components/LifeButton";
import XPBar from "../../src/components/XPBar";
import AvatarRenderer from "../../src/components/AvatarRenderer";
import { colors, spacing } from "../../src/theme/theme";
import { Achievement, WeeklyQuest } from "../../src/types";

type Avatar = {
  equippedHatId: number | null;
  equippedOutfitId: number | null;
  equippedBackgroundId: number | null;
  equippedPetId: number | null;
  equippedAuraId: number | null;
  bodyType?: "BOY" | "GIRL";
};

export default function DashboardScreen() {
  const { user, refreshUser } = useAuth();
  const [avatar, setAvatar] = useState<Avatar | null>(null);
  const [weeklyQuest, setWeeklyQuest] = useState<WeeklyQuest | null>(null);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [questBusy, setQuestBusy] = useState(false);

  useFocusEffect(
    useCallback(() => {
      async function loadDashboard() {
        try {
          const sessionIsValid = await refreshUser();

          if (!sessionIsValid) {
            return;
          }

          const res = await api.get<Avatar>("/avatar");
          setAvatar(res.data);
          const questRes = await api.get<WeeklyQuest>("/weekly-quests/current");
          setWeeklyQuest(questRes.data);
          const achievementRes = await api.get<Achievement[]>("/achievements");
          setAchievements(achievementRes.data);
        } catch (error) {
          console.log("Dashboard load error:", error);
        }
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

  async function reloadQuestAndAchievements() {
    await refreshUser();
    const [questRes, achievementRes] = await Promise.all([
      api.get<WeeklyQuest>("/weekly-quests/current"),
      api.get<Achievement[]>("/achievements"),
    ]);
    setWeeklyQuest(questRes.data);
    setAchievements(achievementRes.data);
  }

  async function handleQuestAction() {
    if (!weeklyQuest || questBusy) {
      return;
    }

    try {
      setQuestBusy(true);

      if (weeklyQuest.completed && !weeklyQuest.claimed) {
        await api.post("/weekly-quests/current/claim");
      } else if (!weeklyQuest.completed) {
        const today = new Date().toISOString().slice(0, 10);
        const taskRes = await api.post<{ id: number }>("/tasks", {
          title: weeklyQuest.taskTitle,
          description: weeklyQuest.category,
          category: weeklyQuest.category,
          dueDate: today,
          repeatType: "NONE",
        });
        await api.put(`/tasks/${taskRes.data.id}/complete?date=${today}`);
      }

      await reloadQuestAndAchievements();
    } catch (error) {
      console.log("Quest action error:", error);
    } finally {
      setQuestBusy(false);
    }
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      alwaysBounceVertical={false}
      bounces={false}
      overScrollMode="never"
    >
      <LifeCard style={styles.heroCard}>
        <AvatarRenderer
          hatId={avatar?.equippedHatId}
          outfitId={avatar?.equippedOutfitId}
          backgroundId={avatar?.equippedBackgroundId}
          petId={avatar?.equippedPetId}
          auraId={avatar?.equippedAuraId}
          bodyType={avatar?.bodyType}
          size="compact"
        />

        <Text style={styles.level}>Level {level}</Text>
        <Text style={styles.xpText}>{totalXp} Total XP</Text>

        <View style={styles.xpBarWrapper}>
          <XPBar progress={xpProgress} />
        </View>
      </LifeCard>

      <View style={styles.statsGrid}>
        <LifeCard compact style={styles.statCard}>
          <View style={styles.statIcon}>
            <MaterialCommunityIcons name="fire" color={colors.primary} size={26} />
          </View>
          <Text style={styles.statLabel}>Streak</Text>
          <Text style={styles.statSubtext}>
            {user?.currentStreak ?? 0} day{(user?.currentStreak ?? 0) === 1 ? "" : "s"}
          </Text>
        </LifeCard>

        <LifeCard compact style={styles.statCard}>
          <View style={styles.statIcon}>
            <MaterialCommunityIcons
              name="shield-star"
              color={colors.accent}
              size={26}
            />
          </View>
          <Text style={styles.statLabel}>Rank</Text>
          <Text style={styles.statSubtext}>{user?.coins ?? 0} coins</Text>
        </LifeCard>
      </View>

      <LifeCard>
        <Text style={styles.cardTitle}>
          {weeklyQuest?.title ?? "Weekly Quest"}
        </Text>
        <Text style={styles.cardText}>
          {weeklyQuest?.storyText ??
            "Complete quests this week to keep your town prepared."}
        </Text>
        {weeklyQuest && (
          <>
            <Text style={styles.questTask}>{weeklyQuest.taskTitle}</Text>
            <View style={styles.xpBarWrapper}>
              <XPBar
                progress={Math.min(
                  weeklyQuest.progress / weeklyQuest.requiredCompletions,
                  1,
                )}
              />
            </View>
            <Text style={styles.statSubtext}>
              {weeklyQuest.progress}/{weeklyQuest.requiredCompletions} complete -
              {" "}+{weeklyQuest.xpReward} XP / +{weeklyQuest.coinReward} coins
            </Text>
          </>
        )}

        <View style={styles.buttonSpacing}>
          <LifeButton
            title={
              questBusy
                ? "Working..."
                : weeklyQuest?.claimed
                ? "Reward Claimed"
                : weeklyQuest?.completed
                  ? "Claim Weekly Reward"
                  : "Complete Quest"
            }
            onPress={handleQuestAction}
            disabled={weeklyQuest?.claimed || questBusy || !weeklyQuest}
          />
        </View>
      </LifeCard>

      <LifeCard compact>
        <Text style={styles.cardTitle}>Achievements</Text>
        {achievements.slice(0, 3).map((achievement) => (
          <View key={achievement.key} style={styles.achievementRow}>
            <View style={styles.achievementCopy}>
              <Text style={styles.achievementTitle}>{achievement.title}</Text>
              <Text style={styles.statSubtext}>
                {achievement.progress}/{achievement.target} - {achievement.coinReward} coins
              </Text>
            </View>
            <LifeButton
              title={achievement.claimed ? "Claimed" : achievement.completed ? "Claim" : "Locked"}
              variant="secondary"
              disabled={!achievement.completed || achievement.claimed}
              onPress={async () => {
                await api.post(`/achievements/${achievement.key}/claim`);
                await refreshUser();
                const achievementRes = await api.get<Achievement[]>("/achievements");
                setAchievements(achievementRes.data);
              }}
            />
          </View>
        ))}
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

  subtitle: {
    color: colors.mutedText,
    fontSize: 16,
    marginTop: 2,
  },

  heroCard: {
    alignItems: "center",
  },

  level: {
    color: colors.text,
    fontSize: 24,
    fontWeight: "700",
    marginTop: spacing.md,
  },

  xpText: {
    color: colors.accent,
    fontSize: 16,
    fontWeight: "600",
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

  statIcon: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: colors.cardLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },

  statLabel: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "700",
  },

  statSubtext: {
    color: colors.mutedText,
    marginTop: 4,
  },

  cardTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "700",
    marginBottom: spacing.sm,
  },

  cardText: {
    color: colors.mutedText,
    fontSize: 16,
    lineHeight: 24,
  },

  questTask: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
    marginTop: spacing.md,
  },

  achievementRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },

  achievementCopy: {
    flex: 1,
  },

  achievementTitle: {
    color: colors.text,
    fontWeight: "700",
  },

  buttonSpacing: {
    marginTop: spacing.lg,
  },
});
