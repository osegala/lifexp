import { formatDate } from "../utils/dateFormat";
import { Platform, StyleSheet, Text, View } from "react-native";
import type { GoalProgress, GoalsResponse } from "../types";
import { colors, spacing, uiTheme as ui } from "../theme/theme";
import LifeCard from "./LifeCard";
import XPBar from "./XPBar";
import { BadgePill } from "./ui/Indicators";

type Tone = "legacy" | "parchment";
function QuestCard({ title, goal, tone }: { title: string; goal: GoalProgress; tone: Tone }) {
  const text = tone === "parchment" ? parchment : styles;
  const reward = goal.reward.granted
    ? goal.reward.earnedWorldPoints == null ? "Reward granted" : `+${goal.reward.earnedWorldPoints} World Points earned`
    : `Reward: +${goal.reward.worldPoints} World Points`;
  const status = goal.completed ? "Complete" : "In progress";
  return <LifeCard compact framed={tone === "parchment"} tone={tone} style={[styles.quest, tone === "parchment" && parchment.card]} accessible
    accessibilityLabel={`${title}, ${goal.current} of ${goal.target} tasks completed. ${status}. ${reward}.`}>
    <Text style={text.title}>{title}</Text>
    <Text style={text.muted}>Complete {goal.target} tasks</Text>
    <View style={styles.progressRow}>
      <Text style={text.value}>{goal.current} / {goal.target}</Text>
      <XPBar tone={tone} label={`${title} progress`} progress={goal.progressPercent / 100} style={styles.progressBar} />
    </View>
    <View style={[styles.footer, tone === "parchment" && parchment.footer]}>
      {goal.completed ? <BadgePill label="✓ Complete" tone="success" style={parchment.successChip} textStyle={parchment.chipText} /> : <Text style={text.status}>{status}</Text>}
      <Text style={[text.muted, tone === "parchment" && parchment.reward]}>{reward}</Text>
    </View>
  </LifeCard>;
}

export default function QuestProgress({ goals, tone = "legacy" }: { goals: GoalsResponse; tone?: Tone }) {
  const text = tone === "parchment" ? parchment : styles;
  const streak = goals.streak;
  return <View style={styles.section}>
    <View>
      <Text accessibilityRole="header" aria-level={2} style={[text.title, tone === "parchment" && parchment.sectionTitle]}>Quests & streak</Text>
      <Text style={text.muted}>{formatDate(goals.date, { timeZone: goals.timeZone })}</Text>
    </View>
    <View style={styles.grid}>
      <QuestCard title="Daily Quest" goal={goals.daily.tasks} tone={tone} />
      <QuestCard title="Weekly Quest" goal={goals.weekly.tasks} tone={tone} />
    </View>
    <LifeCard compact framed={tone === "parchment"} tone={tone} style={[styles.streak, tone === "parchment" && parchment.card]} accessible accessibilityLabel={streak
      ? `Daily activity streak, ${streak.currentDays} days. Longest ${streak.longestDays} days. ${streak.completedToday ? "Today counts." : "Complete a task today to keep building your streak."}`
      : "Daily activity streak unavailable."}>
      <Text style={text.title}>Daily activity streak</Text>
      {streak ? <>
        <View style={styles.streakValues}>
          <Text style={[text.value, tone === "parchment" && parchment.streakValue]}>{streak.currentDays} {streak.currentDays === 1 ? "day" : "days"}</Text>
          <Text style={text.muted}>Longest: {streak.longestDays} {streak.longestDays === 1 ? "day" : "days"}</Text>
        </View>
        <View style={[styles.footer, tone === "parchment" && parchment.footer]}>
          {streak.completedToday ? <BadgePill label="✓ Today counts" tone="success" style={parchment.successChip} textStyle={parchment.chipText} />
            : <Text style={text.status}>Complete a task today to keep building your streak.</Text>}
        </View>
      </> : <Text style={text.muted}>Streak status is not available yet.</Text>}
    </LifeCard>
  </View>;
}

const styles = StyleSheet.create({
  section: { gap: ui.spacing.sm },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: ui.spacing.sm },
  quest: { flexGrow: 1, flexBasis: 240, gap: ui.spacing.xs },
  streak: { gap: ui.spacing.xs },
  progressRow: { flexDirection: "row", alignItems: "center", gap: ui.spacing.sm, paddingVertical: ui.spacing.xs },
  progressBar: { flex: 1, height: 9, borderColor: ui.colors.controlBorder },
  footer: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: ui.spacing.sm },
  streakValues: { flexDirection: "row", alignItems: "baseline", flexWrap: "wrap", columnGap: ui.spacing.md, rowGap: ui.spacing.xs },
  title: { color: colors.text, fontSize: 18, fontWeight: "700" },
  value: { color: colors.accent, fontSize: 24, fontWeight: "800", marginVertical: spacing.xs },
  muted: { color: colors.mutedText, lineHeight: 20 },
  status: { color: colors.text, lineHeight: 20, marginTop: spacing.xs },
});

const parchment = StyleSheet.create({
  card: { padding: ui.spacing.sm + ui.spacing.xs, shadowOpacity: 0.04, shadowRadius: 2 },
  title: { ...ui.type.section, fontSize: 18, lineHeight: 24, color: ui.colors.text, fontFamily: Platform.select(ui.font.display) },
  sectionTitle: { ...ui.type.section },
  value: { ...ui.type.label, color: ui.colors.primary, fontVariant: ["tabular-nums"] },
  streakValue: { fontSize: 22, lineHeight: 28, fontWeight: "400", fontFamily: Platform.select(ui.font.display) },
  muted: { ...ui.type.caption, color: ui.colors.secondaryText },
  status: { ...ui.type.caption, color: ui.colors.secondaryText },
  footer: { borderTopWidth: 1, borderTopColor: ui.colors.divider, paddingTop: ui.spacing.sm },
  reward: { color: ui.colors.primary, fontWeight: "600" },
  successChip: { minHeight: 22, paddingVertical: 1, borderWidth: 1, borderColor: "rgba(49,92,64,0.18)", backgroundColor: "rgba(228,236,222,0.65)" },
  chipText: { fontSize: 12, lineHeight: 16 },
});
