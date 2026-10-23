import { showGameNotice } from "../../src/feedback/notices";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { AppState } from "react-native";
import type { AxiosRequestConfig } from "axios";
import { BannerAdPlacement } from "../../src/ads/Ads";
import { api, apiError } from "../../src/api/client";
import { apiRoutes } from "../../src/api/routes";
import { loadPreferredAppearance, normalizeAppearance } from "../../src/avatar/appearance";
import { getLocalAppearance, setLocalAppearance } from "../../src/avatar/localAppearance";
import HomeContent from "../../src/components/HomeContent";
import { useAuth } from "../../src/context/AuthContext";
import { homeAvatarFromInventory, type HomeAvatar } from "../../src/home/avatar";
import type { AchievementsResponse, GoalsResponse, TasksResponse } from "../../src/types";
import type { InventoryResponse } from "../../src/types/avatar";
import type { ProfileResponse } from "../../src/auth/session";
import { playerCache } from "../../src/cache/playerData";
import { SupersededCacheRead } from "../../src/cache/PlayerCache";
import { prefetchAvatarAssets } from "../../src/avatar/prefetch";

function cachedScene(userId: string | number | undefined) {
  if (userId == null) return null;
  const inventory = playerCache.peek(userId, "inventory"), profile = playerCache.peek(userId, "profile");
  return inventory && profile ? homeAvatarFromInventory(inventory, normalizeAppearance(profile)) : null;
}

export default function DashboardScreen() {
  const { user, refreshUser } = useAuth();
  const userId = user?.id;
  const [goals, setGoals] = useState(() => userId == null ? null : playerCache.peek(userId, "goals"));
  const [achievementData, setAchievementData] = useState(() => userId == null ? null : playerCache.peek(userId, "achievements"));
  const [loading, setLoading] = useState(!goals);
  const [achievementsLoading, setAchievementsLoading] = useState(!achievementData);
  const [questError, setQuestError] = useState(false);
  const [tasks, setTasks] = useState(() => userId == null ? null : playerCache.peek(userId, "tasks"));
  const [scene, setScene] = useState<HomeAvatar | null>(() => cachedScene(userId));
  const [tasksLoading, setTasksLoading] = useState(!tasks);
  const [avatarLoading, setAvatarLoading] = useState(!scene);
  const [taskError, setTaskError] = useState("");
  const [avatarError, setAvatarError] = useState("");
  const [progressError, setProgressError] = useState("");
  const refreshHome = useRef<() => void>(() => {});

  useFocusEffect(useCallback(() => {
    if (userId == null) return;
    const accountId = userId;
    let active = true;
    const accountCurrent = playerCache.accountCurrent(userId);
    const current = () => active && accountCurrent();
    const config = { expectedUserId: String(userId) } as AxiosRequestConfig;
    let refreshing = false;
    let refreshingTasks = false;
    let refreshingAvatar = false;
    let loadingDashboard = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    function showCachedState() {
      if (!current()) return;
      const goals = playerCache.peek(accountId, "goals"), achievements = playerCache.peek(accountId, "achievements");
      const tasks = playerCache.peek(accountId, "tasks"), scene = cachedScene(userId);
      if (goals) { setGoals(goals); setLoading(false); }
      if (achievements) { setAchievementData(achievements); setAchievementsLoading(false); }
      if (tasks) { setTasks(tasks); setTasksLoading(false); }
      if (scene) { setScene(scene); setAvatarLoading(false); void prefetchAvatarAssets(scene.avatar, scene.cosmetics); }
    }
    showCachedState();
    const hydration = playerCache.hydrateUser(userId).then(showCachedState);
    async function refreshTasks() {
      if (!current() || refreshingTasks) return;
      refreshingTasks = true;
      setTasksLoading(!playerCache.peek(accountId, "tasks"));
      try {
        const data = await playerCache.refresh(accountId, "tasks", async () => (await api.get<TasksResponse>(apiRoutes.tasks, config)).data);
        if (current()) { setTasks(data); setTaskError(""); }
      } catch (error) {
        if (current() && !(error instanceof SupersededCacheRead)) setTaskError(apiError(error, "Could not refresh tasks. Any saved schedule shown below is the last confirmed one.").message);
      } finally {
        refreshingTasks = false;
        await hydration;
        if (current()) setTasksLoading(false);
      }
    }
    async function refreshAvatar() {
      if (!current() || refreshingAvatar) return;
      refreshingAvatar = true;
      setAvatarLoading(!cachedScene(userId));
      try {
        const [inventory, appearance] = await Promise.all([
          playerCache.refresh(accountId, "inventory", async () => (await api.get<InventoryResponse>(apiRoutes.inventory, config)).data),
          loadPreferredAppearance(
            () => playerCache.refresh(accountId, "profile", async () => (await api.get<ProfileResponse>(apiRoutes.me, config)).data),
            () => getLocalAppearance(accountId),
            value => current() ? setLocalAppearance(accountId, value) : Promise.resolve(),
          ),
        ]);
        if (current()) {
          const scene = cachedScene(userId) ?? homeAvatarFromInventory(inventory, appearance);
          setScene(scene); setAvatarError(""); void prefetchAvatarAssets(scene.avatar, scene.cosmetics);
        }
      } catch (error) {
        if (current() && !(error instanceof SupersededCacheRead)) setAvatarError(apiError(error, "Could not refresh your character. Your equipment has not changed.").message);
      } finally {
        refreshingAvatar = false;
        await hydration;
        if (current()) setAvatarLoading(false);
      }
    }
    async function refreshGoals() {
      if (!current() || refreshing) return;
      refreshing = true;
      clearTimeout(timer);
      void refreshTasks(); // Use the server schedule across focus, resume and local midnight.
      let delay = 60_000;
      try {
        const data = await playerCache.refresh(accountId, "goals", async () => (await api.get<GoalsResponse>(apiRoutes.goals, config)).data);
        if (current()) {
          setGoals(data);
          setQuestError(false);
          // The server schedules local midnight, including DST. A bounded refresh
          // also picks up timezone/building changes without using the device date.
          delay = Math.max(1000, Math.min(delay, data.refreshAfterMs ?? delay));
        }
      } catch (error) {
        if (current() && !(error instanceof SupersededCacheRead)) setQuestError(true);
      } finally {
        refreshing = false;
        await hydration;
        if (current()) {
          setLoading(false);
          if (AppState.currentState !== "background" && AppState.currentState !== "inactive") {
            timer = setTimeout(() => { void refreshGoals(); }, delay);
          }
        }
      }
    }
    async function loadDashboard() {
      if (!current() || loadingDashboard) return;
      loadingDashboard = true;
      try {
        setLoading(!playerCache.peek(accountId, "goals"));
        setAchievementsLoading(!playerCache.peek(accountId, "achievements"));
        const [profile, achievements] = await Promise.allSettled([
          refreshUser(),
          playerCache.refresh(accountId, "achievements", async () => (await api.get<AchievementsResponse>(apiRoutes.achievements, config)).data)
            .then(data => { if (current()) setAchievementData(data); return data; })
            .finally(() => { if (current()) setAchievementsLoading(false); }),
          refreshGoals(), refreshAvatar(),
        ]);
        if (!current()) return;
        if (profile.status === "rejected" || !profile.value) setProgressError("Could not refresh your profile. Refresh Home to try again.");
        else if (achievements.status === "rejected" && !(achievements.reason instanceof SupersededCacheRead)) throw achievements.reason;
        else setProgressError("");
      } catch (error) {
        const message = apiError(error, "Could not load your progress.").message;
        if (current()) { setProgressError(message); showGameNotice("Home", message, "error"); }
      } finally {
        loadingDashboard = false;
        await hydration;
        if (current()) { setLoading(false); setAchievementsLoading(false); }
      }
    }
    refreshHome.current = () => { void loadDashboard(); };
    void loadDashboard();
    const subscription = AppState.addEventListener("change", state => {
      if (state === "active") { void refreshGoals(); void refreshAvatar(); }
      else clearTimeout(timer);
    });
    return () => { active = false; refreshHome.current = () => {}; clearTimeout(timer); subscription.remove(); };
  }, [refreshUser, userId]));

  return <HomeContent user={user} goals={goals} achievements={achievementData} tasks={tasks} scene={scene}
    loading={loading} achievementsLoading={achievementsLoading} tasksLoading={tasksLoading} avatarLoading={avatarLoading} questError={questError}
    progressError={progressError} taskError={taskError} avatarError={avatarError}
    onRetry={() => refreshHome.current()}
    onProfile={() => router.navigate("/(tabs)/profile")}
    onTasks={() => router.navigate("/(tabs)/tasks")}
    ad={<BannerAdPlacement placement="HOME" />} />;
}
