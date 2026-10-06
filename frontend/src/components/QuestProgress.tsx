import { StyleSheet, Text, View } from "react-native";
import type { GoalProgress, GoalsResponse } from "../types";
import { colors, spacing } from "../theme/theme";
import LifeCard from "./LifeCard";
import XPBar from "./XPBar";

function QuestCard({ title, goal }: { title: string; goal: GoalProgress }) {
  const reward = goal.reward.granted
    ? goal.reward.earnedWorldPoints == null ? "Reward granted" : `+${goal.reward.earnedWorldPoints} World Points earned`
    : `Reward: +${goal.reward.worldPoints} World Points`;
  const status = goal.completed ? "Complete" : "In progress";
  return <LifeCard compact style={styles.quest} accessible
    accessibilityLabel={`${title}, ${goal.current} of ${goal.target} tasks completed. ${status}. ${reward}.`}>
    <Text style={styles.title}>{title}</Text>
    <Text style={styles.muted}>Complete {goal.target} tasks</Text>
    <Text style={styles.value}>{goal.current} / {goal.target}</Text>
    <XPBar progress={goal.progressPercent / 100} />
    <Text style={styles.status}>{goal.completed ? "✓ " : ""}{status}</Text>
    <Text style={styles.muted}>{reward}</Text>
  </LifeCard>;
}

export default function QuestProgress({ goals }: { goals: GoalsResponse }) {
  const streak = goals.streak;
  return <View style={styles.section}>
    <View>
      <Text accessibilityRole="header" style={styles.title}>Quests & streak</Text>
      <Text style={styles.muted}>{goals.date} · {goals.timeZone} · {goals.week}</Text>
    </View>
    <View style={styles.grid}>
      <QuestCard title="Daily Quest" goal={goals.daily.tasks} />
      <QuestCard title="Weekly Quest" goal={goals.weekly.tasks} />
    </View>
    <LifeCard compact accessible accessibilityLabel={streak
      ? `Daily activity streak, ${streak.currentDays} days. Longest ${streak.longestDays} days. ${streak.completedToday ? "Today counts." : "Complete a task today to keep building your streak."}`
      : "Daily activity streak unavailable."}>
      <Text style={styles.title}>Daily activity streak</Text>
      {streak ? <>
        <Text style={styles.value}>{streak.currentDays} {streak.currentDays === 1 ? "day" : "days"}</Text>
        <Text style={styles.muted}>Longest: {streak.longestDays} {streak.longestDays === 1 ? "day" : "days"}</Text>
        <Text style={styles.status}>{streak.completedToday ? "✓ Today counts" : "Complete a task today to keep building your streak."}</Text>
      </> : <Text style={styles.muted}>Streak status is not available yet.</Text>}
    </LifeCard>
  </View>;
}

const styles = StyleSheet.create({
  section: { gap: spacing.md },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  quest: { flexGrow: 1, flexBasis: 240, gap: spacing.sm },
  title: { color: colors.text, fontSize: 18, fontWeight: "700" },
  value: { color: colors.accent, fontSize: 24, fontWeight: "800", marginVertical: spacing.xs },
  muted: { color: colors.mutedText, lineHeight: 20 },
  status: { color: colors.text, lineHeight: 20, marginTop: spacing.xs },
});
