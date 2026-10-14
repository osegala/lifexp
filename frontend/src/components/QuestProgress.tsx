import { Platform, StyleSheet, Text, View } from "react-native";
import type { GoalProgress, GoalsResponse } from "../types";
import { colors, spacing, uiTheme as ui } from "../theme/theme";
import LifeCard from "./LifeCard";
import XPBar from "./XPBar";

type Tone = "legacy" | "parchment";
function QuestCard({ title, goal, tone }: { title: string; goal: GoalProgress; tone: Tone }) {
  const text = tone === "parchment" ? parchment : styles;
  const reward = goal.reward.granted
    ? goal.reward.earnedWorldPoints == null ? "Reward granted" : `+${goal.reward.earnedWorldPoints} World Points earned`
    : `Reward: +${goal.reward.worldPoints} World Points`;
  const status = goal.completed ? "Complete" : "In progress";
  return <LifeCard compact tone={tone} style={styles.quest} accessible
    accessibilityLabel={`${title}, ${goal.current} of ${goal.target} tasks completed. ${status}. ${reward}.`}>
    <Text style={text.title}>{title}</Text>
    <Text style={text.muted}>Complete {goal.target} tasks</Text>
    <Text style={text.value}>{goal.current} / {goal.target}</Text>
    <XPBar tone={tone} label={`${title} progress`} progress={goal.progressPercent / 100} />
    <Text style={text.status}>{goal.completed ? "✓ " : ""}{status}</Text>
    <Text style={text.muted}>{reward}</Text>
  </LifeCard>;
}

export default function QuestProgress({ goals, tone = "legacy" }: { goals: GoalsResponse; tone?: Tone }) {
  const text = tone === "parchment" ? parchment : styles;
  const streak = goals.streak;
  return <View style={styles.section}>
    <View>
      <Text accessibilityRole="header" aria-level={2} style={text.title}>Quests & streak</Text>
      <Text style={text.muted}>{goals.date} · {goals.timeZone} · {goals.week}</Text>
    </View>
    <View style={styles.grid}>
      <QuestCard title="Daily Quest" goal={goals.daily.tasks} tone={tone} />
      <QuestCard title="Weekly Quest" goal={goals.weekly.tasks} tone={tone} />
    </View>
    <LifeCard compact tone={tone} accessible accessibilityLabel={streak
      ? `Daily activity streak, ${streak.currentDays} days. Longest ${streak.longestDays} days. ${streak.completedToday ? "Today counts." : "Complete a task today to keep building your streak."}`
      : "Daily activity streak unavailable."}>
      <Text style={text.title}>Daily activity streak</Text>
      {streak ? <>
        <Text style={text.value}>{streak.currentDays} {streak.currentDays === 1 ? "day" : "days"}</Text>
        <Text style={text.muted}>Longest: {streak.longestDays} {streak.longestDays === 1 ? "day" : "days"}</Text>
        <Text style={text.status}>{streak.completedToday ? "✓ Today counts" : "Complete a task today to keep building your streak."}</Text>
      </> : <Text style={text.muted}>Streak status is not available yet.</Text>}
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

const parchment = StyleSheet.create({
  title: { ...ui.type.section, color: ui.colors.text, fontFamily: Platform.select(ui.font.display) },
  value: { ...ui.type.display, color: ui.colors.primary, marginVertical: ui.spacing.xs },
  muted: { ...ui.type.caption, color: ui.colors.secondaryText },
  status: { ...ui.type.body, color: ui.colors.text, marginTop: ui.spacing.xs },
});
