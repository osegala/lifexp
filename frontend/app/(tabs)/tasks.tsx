import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { api, apiError } from "../../src/api/client";
import { apiRoutes } from "../../src/api/routes";
import LifeButton from "../../src/components/LifeButton";
import LifeCard from "../../src/components/LifeCard";
import LifeInput from "../../src/components/LifeInput";
import { useAuth } from "../../src/context/AuthContext";
import { colors, radius, spacing } from "../../src/theme/theme";
import type { Task, TasksResponse } from "../../src/types";

type RepeatType = Task["repeatType"];
type CompletionResponse = {
  rewards: { xp: number; coins: number; worldPoints: number };
};

const WEEKDAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

export default function TasksScreen() {
  const { refreshUser, triggerDashboardRefresh } = useAuth();
  const [data, setData] = useState<TasksResponse | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [repeatType, setRepeatType] = useState<RepeatType>("NONE");
  const [repeatDays, setRepeatDays] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const loadTasks = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get<TasksResponse>(apiRoutes.tasks);
      setData(response.data);
    } catch (error) {
      Alert.alert("Tasks", apiError(error, "Could not load tasks.").message);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void loadTasks(); }, [loadTasks]));

  async function createTask() {
    if (!title.trim()) {
      Alert.alert("Tasks", "Enter a task title.");
      return;
    }
    if (repeatType === "WEEKLY" && repeatDays.length === 0) {
      Alert.alert("Tasks", "Choose at least one weekday for a weekly task.");
      return;
    }

    try {
      setBusy("create");
      await api.post(apiRoutes.tasks, {
        title: title.trim(),
        description: description.trim() || null,
        repeatType,
        repeatDays: repeatType === "WEEKLY" ? repeatDays : [],
        active: true,
      });
      setTitle("");
      setDescription("");
      setRepeatType("NONE");
      setRepeatDays([]);
      await loadTasks();
    } catch (error) {
      Alert.alert("Tasks", apiError(error, "Could not create the task.").message);
    } finally {
      setBusy(null);
    }
  }

  async function completeTask(task: Task) {
    try {
      setBusy(task.taskId);
      const response = await api.post<CompletionResponse>(apiRoutes.completeTask(task.taskId), {});
      const { xp, coins, worldPoints } = response.data.rewards;
      Alert.alert("Task complete", `+${xp} XP · +${coins} coins · +${worldPoints} World Points`);
      await Promise.all([loadTasks(), refreshUser()]);
      triggerDashboardRefresh();
    } catch (error) {
      Alert.alert("Tasks", apiError(error, "Could not complete the task.").message);
    } finally {
      setBusy(null);
    }
  }

  async function archiveTask(task: Task) {
    try {
      setBusy(task.taskId);
      await api.delete(apiRoutes.task(task.taskId));
      await loadTasks();
    } catch (error) {
      Alert.alert("Tasks", apiError(error, "Could not archive the task.").message);
    } finally {
      setBusy(null);
    }
  }

  function toggleDay(day: string) {
    setRepeatDays((current) =>
      current.includes(day) ? current.filter((value) => value !== day) : [...current, day],
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text accessibilityRole="header" style={styles.title}>Tasks</Text>

      <LifeCard compact>
        <Text style={styles.cardTitle}>Add a task</Text>
        <LifeInput placeholder="Task title" value={title} onChangeText={setTitle} />
        <LifeInput placeholder="Description (optional)" value={description} onChangeText={setDescription} />
        <View style={styles.options}>
          {(["NONE", "DAILY", "WEEKLY"] as RepeatType[]).map((value) => (
            <Pressable
              key={value}
              onPress={() => { setRepeatType(value); if (value !== "WEEKLY") setRepeatDays([]); }}
              style={[styles.chip, repeatType === value && styles.selectedChip]}
            >
              <Text style={[styles.chipText, repeatType === value && styles.selectedChipText]}>{value}</Text>
            </Pressable>
          ))}
        </View>
        {repeatType === "WEEKLY" ? (
          <View style={styles.options}>
            {WEEKDAYS.map((day) => (
              <Pressable key={day} onPress={() => toggleDay(day)} style={[styles.day, repeatDays.includes(day) && styles.selectedChip]}>
                <Text style={[styles.chipText, repeatDays.includes(day) && styles.selectedChipText]}>{day.slice(0, 1)}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
        <LifeButton title={busy === "create" ? "Adding…" : "Add task"} onPress={createTask} disabled={busy !== null} />
      </LifeCard>

      <LifeCard compact>
        <Text style={styles.cardTitle}>{data?.time.weekday ?? "Today"} · {data?.time.date ?? ""}</Text>
        <Text style={styles.summary}>
          {data?.summary.dueToday ?? 0} due · {data?.summary.completedToday ?? 0} completed
        </Text>
      </LifeCard>

      {loading && !data ? <ActivityIndicator color={colors.primary} /> : null}
      {(data?.tasks ?? []).map((task) => (
        <LifeCard compact key={task.taskId} style={!task.active && styles.inactiveCard}>
          <View style={styles.taskRow}>
            <View style={styles.taskCopy}>
              <Text style={styles.taskTitle}>{task.title}</Text>
              {task.description ? <Text style={styles.description}>{task.description}</Text> : null}
              <Text style={styles.meta}>
                {task.repeatType}{task.repeatDays.length ? ` · ${task.repeatDays.join(", ")}` : ""}
                {` · +${task.xpReward} XP · +${task.coinReward} coin`}
              </Text>
              {task.repeatType !== "NONE" ? (
                <Text style={styles.meta}>Streak {task.currentStreak} · best {task.bestStreak}</Text>
              ) : null}
            </View>
            <View style={styles.actions}>
              <Pressable
                accessibilityLabel={`Complete ${task.title}`}
                onPress={() => void completeTask(task)}
                disabled={!task.isDueToday || busy !== null}
                style={[styles.iconButton, (!task.isDueToday || busy !== null) && styles.disabled]}
              >
                <MaterialCommunityIcons name={task.completedToday ? "check-circle" : "check"} color={colors.text} size={22} />
              </Pressable>
              <Pressable accessibilityLabel={`Archive ${task.title}`} onPress={() => void archiveTask(task)} disabled={busy !== null} style={styles.iconButton}>
                <MaterialCommunityIcons name="archive-outline" color={colors.mutedText} size={22} />
              </Pressable>
            </View>
          </View>
        </LifeCard>
      ))}
      {!loading && data?.tasks.length === 0 ? <Text style={styles.empty}>No active tasks yet.</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: 120, gap: spacing.md },
  title: { color: colors.text, fontSize: 30, fontWeight: "700" },
  cardTitle: { color: colors.text, fontSize: 18, fontWeight: "700", marginBottom: spacing.sm },
  options: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginVertical: spacing.sm },
  chip: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  day: { width: 40, height: 40, borderWidth: 1, borderColor: colors.border, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  selectedChip: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.mutedText, fontWeight: "700" },
  selectedChipText: { color: colors.background },
  summary: { color: colors.mutedText },
  taskRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  taskCopy: { flex: 1 },
  taskTitle: { color: colors.text, fontSize: 17, fontWeight: "700" },
  description: { color: colors.mutedText, marginTop: 3 },
  meta: { color: colors.accent, fontSize: 12, marginTop: spacing.xs },
  actions: { flexDirection: "row", gap: spacing.xs },
  iconButton: { minWidth: 44, minHeight: 44, borderRadius: radius.md, backgroundColor: colors.cardLight, alignItems: "center", justifyContent: "center" },
  disabled: { opacity: 0.35 },
  inactiveCard: { opacity: 0.55 },
  empty: { color: colors.mutedText, textAlign: "center", marginTop: spacing.xl },
});
