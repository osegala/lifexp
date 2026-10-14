import { useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { Alert, AppState } from "react-native";

import { api, apiError } from "../../src/api/client";
import { apiRoutes } from "../../src/api/routes";
import TasksContent from "../../src/components/TasksContent";
import TaskEditor from "../../src/components/TaskEditor";
import { saveTask } from "../../src/tasks/saveTask";
import { useAuth } from "../../src/context/AuthContext";
import { useBuildingFeedback, useCompletionFeedback } from "../../src/context/CompletionFeedbackContext";
import { buildingUpgrades } from "../../src/base/buildingProgress";
import { completionEvent } from "../../src/feedback/completion";
import type { CompletionResponse, Task, TasksResponse } from "../../src/types";
import type { WorldResponse } from "../../src/types/progression";
import type { TaskInput, TaskView } from "../../src/tasks/scheduling";

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

  return <TasksContent data={data} view={view} editing={editing} loading={loading} busy={busy}
    loadError={loadError} completionError={completionError} reminderNotice={reminderNotice}
    onView={option => { setView(option); setEditing(null); }} onRetry={() => void loadTasks()}
    onComplete={task => void completeTask(task)} onEdit={task => setEditing(task.taskId)}
    onArchive={task => void archiveTask(task)}
    createEditor={<TaskEditor tone="parchment" time={data?.time} disabled={busy !== null || !data} onSave={createTask} />}
    renderEditor={task => <TaskEditor tone="parchment" task={task} time={data?.time} disabled={busy !== null}
      onSave={input => editTask(task, input)} onCancel={() => setEditing(null)} onReminderNotice={setReminderNotice} />} />;
}
