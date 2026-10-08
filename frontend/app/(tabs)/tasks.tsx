import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { ActivityIndicator, Alert, AppState, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { api, apiError } from "../../src/api/client";
import { apiRoutes } from "../../src/api/routes";
import LifeCard from "../../src/components/LifeCard";
import TaskEditor from "../../src/components/TaskEditor";
import { saveTask } from "../../src/tasks/saveTask";
import { useAuth } from "../../src/context/AuthContext";
import { useBuildingFeedback, useCompletionFeedback } from "../../src/context/CompletionFeedbackContext";
import { buildingUpgrades } from "../../src/base/buildingProgress";
import { completionEvent } from "../../src/feedback/completion";
import { colors, radius, spacing } from "../../src/theme/theme";
import type { CompletionResponse, Task, TasksResponse } from "../../src/types";
import type { WorldResponse } from "../../src/types/progression";
import { recurrenceLabel, TASK_SIZE_OPTIONS, tasksForView, type TaskInput, type TaskView } from "../../src/tasks/scheduling";

export default function TasksScreen() {
  const { user, refreshUser, triggerDashboardRefresh } = useAuth();
  const celebrate = useCompletionFeedback();
  const { enqueue: enqueueBuildings } = useBuildingFeedback();
  const completing = useRef(false);
  const [data, setData] = useState<TasksResponse | null>(null);
  const [view, setView] = useState<TaskView>("Today");
  const [editing, setEditing] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [completionError, setCompletionError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [reminderNotice, setReminderNotice] = useState("");
  const loadVersion = useRef(0);

  const loadTasks = useCallback(async () => {
    const version = ++loadVersion.current;
    try {
      setLoading(true);
      const response = await api.get<TasksResponse>(apiRoutes.tasks);
      if (version === loadVersion.current) { setData(response.data); setLoadError(""); }
    } catch (error) {
      if (version === loadVersion.current) setLoadError(apiError(error, "Could not refresh tasks. Showing the last saved schedule.").message);
    } finally {
      if (version === loadVersion.current) setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    void loadTasks();
    // Server dates remain authoritative across midnight, timezone changes and app resume.
    const timer = setInterval(() => { if (AppState.currentState === "active") void loadTasks(); }, 60_000);
    const subscription = AppState.addEventListener("change", state => { if (state === "active") void loadTasks(); });
    return () => { clearInterval(timer); subscription.remove(); loadVersion.current++; };
  }, [loadTasks]));

  async function createTask(input: TaskInput, savedTaskId?: string) {
    try {
      setBusy("create");
      const taskId = await saveTask(input, savedTaskId);
      await loadTasks();
      return taskId;
    } finally {
      setBusy(null);
    }
  }

  async function editTask(task: Task, input: TaskInput) {
    try {
      setBusy(task.taskId);
      await api.patch(apiRoutes.task(task.taskId), input);
      await loadTasks();
      return task.taskId;
    } finally { setBusy(null); }
  }

  async function completeTask(task: Task) {
    if (completing.current || busy !== null || !task.isDueToday) return;
    completing.current = true;
    try {
      setBusy(task.taskId);
      setCompletionError("");
      // Presentation-only reads: an unavailable world must never block earning rewards.
      const readWorld = () => api.get<WorldResponse>(apiRoutes.world, { timeout: 3000 })
        .then(response => response.data).catch(() => null);
      const previousWorld = await readWorld();
      const response = await api.post<CompletionResponse>(apiRoutes.completeTask(task.taskId), {});
      loadVersion.current++; // A pre-completion background read must not undo this confirmed result.
      setData(current => current ? { ...current, tasks: current.tasks.map(item => item.taskId === task.taskId
        ? { ...item, ...response.data.task } : item) } : current);
      celebrate(response.data, user);
      // A refresh failure cannot undo a confirmed completion or its feedback.
      await Promise.allSettled([loadTasks(), refreshUser(), readWorld().then(world => {
        enqueueBuildings({ id: completionEvent(response.data).id, upgrades: buildingUpgrades(previousWorld, world) });
      })]);
      triggerDashboardRefresh();
    } catch (error) {
      const failure = apiError(error, "Could not complete the task.");
      setCompletionError(failure.message);
      Alert.alert("Tasks", failure.message);
      if (failure.code === "TASK_ALREADY_COMPLETED") await loadTasks();
    } finally {
      completing.current = false;
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

  const tasks = tasksForView(data?.tasks ?? [], view, data?.time.date ?? "");

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text accessibilityRole="header" style={styles.title}>Tasks</Text>
      {!!reminderNotice && <Text accessibilityLiveRegion="polite" style={styles.summary}>{reminderNotice}</Text>}
      {!!completionError && <Text accessibilityRole="alert" style={styles.error}>{completionError}</Text>}
      {!!loadError && <View>
        <Text accessibilityRole="alert" style={styles.error}>{loadError}</Text>
        <Pressable accessibilityRole="button" onPress={() => void loadTasks()} style={styles.chip}><Text style={styles.chipText}>Refresh tasks</Text></Pressable>
      </View>}

      <LifeCard compact>
        <TaskEditor time={data?.time} disabled={busy !== null || !data} onSave={createTask} />
      </LifeCard>

      <LifeCard compact>
        <Text style={styles.cardTitle}>{data?.time.weekday ?? "Today"} · {data?.time.date ?? ""}</Text>
        <Text style={styles.summary}>
          {data?.summary.dueToday ?? 0} due · {data?.summary.completedToday ?? 0} completed
        </Text>
        <Text style={styles.meta}>{data?.time.timeZone}</Text>
        <View style={styles.options}>{(["Today", "Upcoming", "All"] as TaskView[]).map(option => <Pressable key={option}
          accessibilityRole="button" accessibilityLabel={`${option} tasks`} accessibilityState={{ selected: view === option }}
          onPress={() => { setView(option); setEditing(null); }} style={[styles.chip, view === option && styles.selectedChip]}>
          <Text style={[styles.chipText, view === option && styles.selectedChipText]}>{option}</Text>
        </Pressable>)}</View>
        {view === "Upcoming" && <Text style={styles.summary}>Next available occurrence of each task.</Text>}
      </LifeCard>

      {loading && !data ? <ActivityIndicator color={colors.primary} /> : null}
      {tasks.map((task) => (
        <LifeCard compact key={task.taskId} style={[!task.active && styles.inactiveCard, task.completedToday && styles.completedCard]}>
          {editing === task.taskId ? <TaskEditor task={task} time={data?.time} disabled={busy !== null}
            onSave={input => editTask(task, input)} onCancel={() => setEditing(null)} onReminderNotice={setReminderNotice} /> : <>
          <View style={styles.taskRow}>
            <View style={styles.taskCopy}>
              <Text style={styles.taskTitle}>{task.title}</Text>
              {task.description ? <Text style={styles.description}>{task.description}</Text> : null}
              <Text style={styles.meta}>
                {TASK_SIZE_OPTIONS.find((option) => option.value === task.taskSize)?.label ?? "Normal"}
                {` · +${task.xpReward} XP · +${task.coinReward} coin${task.coinReward === 1 ? "" : "s"}`}
              </Text>
              <Text style={styles.meta}>
                {recurrenceLabel(task)}{task.dueTime ? ` · ${task.dueTime}` : ""}
              </Text>
              {task.repeatType === "NONE" && !!task.startDate && <Text style={styles.meta}>Due: {task.startDate}</Text>}
              {!!task.nextScheduledDate && <Text style={styles.meta}>Next: {task.nextScheduledDate}</Text>}
              {!task.active && <Text style={styles.meta}>Inactive</Text>}
              {task.completed && task.repeatType === "NONE" && <Text style={styles.meta}>Completed</Text>}
              {task.repeatType !== "NONE" ? (
                <Text style={styles.meta}>Streak {task.currentStreak} · best {task.bestStreak}</Text>
              ) : null}
            </View>
            <View style={styles.actions}>
              <Pressable
                accessibilityLabel={`Complete ${task.title}`}
                accessibilityRole="button"
                onPress={() => void completeTask(task)}
                disabled={view === "Upcoming" || !task.isDueToday || busy !== null}
                accessibilityState={{ disabled: view === "Upcoming" || !task.isDueToday || busy !== null }}
                style={[styles.iconButton, (view === "Upcoming" || !task.isDueToday || busy !== null) && styles.disabled]}
              >
                <MaterialCommunityIcons name={task.completedToday ? "check-circle" : "check"} color={colors.text} size={22} />
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel={`Edit ${task.title}`} onPress={() => setEditing(task.taskId)} disabled={busy !== null} style={styles.iconButton}>
                <MaterialCommunityIcons name="pencil-outline" color={colors.mutedText} size={22} />
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel={`Archive ${task.title}`} onPress={() => void archiveTask(task)} disabled={busy !== null} style={styles.iconButton}>
                <MaterialCommunityIcons name="archive-outline" color={colors.mutedText} size={22} />
              </Pressable>
            </View>
          </View>
          </>}
        </LifeCard>
      ))}
      {!loading && data && tasks.length === 0 ? <Text style={styles.empty}>{view === "Today" ? "Nothing scheduled for today." : view === "Upcoming" ? "No upcoming tasks." : "No tasks yet."}</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: 120, gap: spacing.md },
  title: { color: colors.text, fontSize: 30, fontWeight: "700" },
  cardTitle: { color: colors.text, fontSize: 18, fontWeight: "700", marginBottom: spacing.sm },
  options: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginVertical: spacing.sm },
  chip: { minHeight: 44, justifyContent: "center", borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  selectedChip: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.mutedText, fontWeight: "700" },
  selectedChipText: { color: colors.background },
  summary: { color: colors.mutedText },
  taskRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  taskCopy: { flex: 1 },
  taskTitle: { color: colors.text, fontSize: 17, fontWeight: "700" },
  description: { color: colors.mutedText, marginTop: 3 },
  meta: { color: colors.accent, fontSize: 12, marginTop: spacing.xs },
  actions: { gap: spacing.xs },
  iconButton: { minWidth: 44, minHeight: 44, borderRadius: radius.md, backgroundColor: colors.cardLight, alignItems: "center", justifyContent: "center" },
  disabled: { opacity: 0.35 },
  inactiveCard: { opacity: 0.55 },
  completedCard: { borderColor: colors.accent },
  error: { color: colors.danger },
  empty: { color: colors.mutedText, textAlign: "center", marginTop: spacing.xl },
});
