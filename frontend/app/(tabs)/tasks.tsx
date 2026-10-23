import { showGameNotice } from "../../src/feedback/notices";
import { useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { AppState } from "react-native";
import type { AxiosRequestConfig } from "axios";

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
import { playerCache } from "../../src/cache/playerData";
import { SupersededCacheRead } from "../../src/cache/PlayerCache";

export default function TasksScreen() {
  const { user, refreshUser, triggerDashboardRefresh } = useAuth();
  const userId = user?.id;
  const celebrate = useCompletionFeedback();
  const { enqueue: enqueueBuildings } = useBuildingFeedback();
  const completing = useRef(false);
  const [data, setData] = useState(() => userId == null ? null : playerCache.peek(userId, "tasks"));
  const [view, setView] = useState<TaskView>("Today");
  const [editing, setEditing] = useState<string | null>(null);
  const [loading, setLoading] = useState(!data);
  const [busy, setBusy] = useState<string | null>(null);
  const [completionError, setCompletionError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [reminderNotice, setReminderNotice] = useState("");
  const loadVersion = useRef(0);

  const loadTasks = useCallback(async () => {
    if (userId == null) return;
    const version = ++loadVersion.current;
    const accountCurrent = playerCache.accountCurrent(userId);
    const current = () => version === loadVersion.current && accountCurrent();
    const showCached = () => {
      const cached = playerCache.peek(userId, "tasks");
      if (current() && cached) { setData(cached); setLoading(false); }
    };
    showCached();
    const hydration = playerCache.hydrate(userId, "tasks").then(showCached);
    try {
      setLoading(!playerCache.peek(userId, "tasks"));
      const data = await playerCache.refresh(userId, "tasks", async () =>
        (await api.get<TasksResponse>(apiRoutes.tasks, { expectedUserId: String(userId) } as AxiosRequestConfig)).data);
      if (current()) { setData(data); setLoadError(""); }
    } catch (error) {
      if (current() && !(error instanceof SupersededCacheRead)) setLoadError(apiError(error, "Could not refresh tasks. Showing the last saved schedule.").message);
    } finally {
      await hydration;
      if (current()) setLoading(false);
    }
  }, [userId]);

  useFocusEffect(useCallback(() => {
    void loadTasks();
    // Server dates remain authoritative across midnight, timezone changes and app resume.
    const timer = setInterval(() => { if (AppState.currentState === "active") void loadTasks(); }, 60_000);
    const subscription = AppState.addEventListener("change", state => { if (state === "active") void loadTasks(); });
    return () => { clearInterval(timer); subscription.remove(); loadVersion.current++; };
  }, [loadTasks]));

  async function createTask(input: TaskInput, savedTaskId?: string) {
    try {
      if (userId == null) return;
      setBusy("create");
      playerCache.invalidate(userId, ["tasks", "goals"]);
      const current = playerCache.accountCurrent(userId);
      const taskId = await saveTask(input, savedTaskId);
      if (!current()) return;
      playerCache.invalidate(userId, ["tasks", "goals"]);
      await loadTasks();
      return taskId;
    } finally {
      setBusy(null);
    }
  }

  async function editTask(task: Task, input: TaskInput) {
    try {
      if (userId == null) return;
      setBusy(task.taskId);
      playerCache.invalidate(userId, ["tasks", "goals"]);
      const current = playerCache.accountCurrent(userId);
      await api.patch(apiRoutes.task(task.taskId), input);
      if (!current()) return;
      playerCache.invalidate(userId, ["tasks", "goals"]);
      await loadTasks();
      return task.taskId;
    } finally { setBusy(null); }
  }

  async function completeTask(task: Task) {
    if (completing.current || busy !== null || !task.isDueToday) return;
    completing.current = true;
    try {
      if (userId == null) return;
      setBusy(task.taskId);
      setCompletionError("");
      playerCache.invalidate(userId);
      const currentAccount = playerCache.accountCurrent(userId);
      // Presentation-only reads: an unavailable world must never block earning rewards.
      const readWorld = () => api.get<WorldResponse>(apiRoutes.world, { timeout: 3000 })
        .then(response => response.data).catch(() => null);
      const previousWorld = await readWorld();
      const response = await api.post<CompletionResponse>(apiRoutes.completeTask(task.taskId), {});
      if (!currentAccount()) return;
      playerCache.invalidate(userId);
      loadVersion.current++; // A pre-completion background read must not undo this confirmed result.
      const cached = playerCache.peek(userId, "tasks");
      if (cached) {
        const confirmed = { ...cached, tasks: cached.tasks.map(item => item.taskId === task.taskId
          ? { ...item, ...response.data.task } : item) };
        playerCache.set(userId, "tasks", confirmed);
        setData(confirmed);
      }
      const profile = playerCache.peek(userId, "profile");
      if (profile) playerCache.set(userId, "profile", { ...profile, xp: response.data.player.xp, coins: response.data.player.coins,
        level: response.data.progression.level, xpIntoLevel: response.data.progression.xpIntoLevel,
        xpForNextLevel: response.data.progression.xpForNextLevel, xpToNextLevel: response.data.progression.xpToNextLevel });
      celebrate(response.data, user);
      // A refresh failure cannot undo a confirmed completion or its feedback.
      await Promise.allSettled([loadTasks(), refreshUser(), readWorld().then(world => {
        enqueueBuildings({ id: completionEvent(response.data).id, upgrades: buildingUpgrades(previousWorld, world) });
      })]);
      triggerDashboardRefresh();
    } catch (error) {
      const failure = apiError(error, "Could not complete the task.");
      setCompletionError(failure.message);
      showGameNotice("Tasks", failure.message, "error");
      if (failure.code === "TASK_ALREADY_COMPLETED") await loadTasks();
    } finally {
      completing.current = false;
      setBusy(null);
    }
  }

  async function archiveTask(task: Task) {
    try {
      if (userId == null) return;
      setBusy(task.taskId);
      playerCache.invalidate(userId, ["tasks", "goals"]);
      const current = playerCache.accountCurrent(userId);
      await api.delete(apiRoutes.task(task.taskId));
      if (!current()) return;
      playerCache.invalidate(userId, ["tasks", "goals"]);
      await loadTasks();
    } catch (error) {
      showGameNotice("Tasks", apiError(error, "Could not archive the task.").message, "error");
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
