import { router, useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { Alert, AppState } from "react-native";
import { BannerAdPlacement } from "../../src/ads/Ads";
import { api, apiError } from "../../src/api/client";
import { apiRoutes } from "../../src/api/routes";
import { loadPreferredAppearance, type AvatarAppearance } from "../../src/avatar/appearance";
import { getLocalAppearance, setLocalAppearance } from "../../src/avatar/localAppearance";
import HomeContent from "../../src/components/HomeContent";
import { useAuth } from "../../src/context/AuthContext";
import { homeAvatarFromInventory, type HomeAvatar } from "../../src/home/avatar";
import type { AchievementsResponse, GoalsResponse, TasksResponse } from "../../src/types";
import type { InventoryResponse } from "../../src/types/avatar";

export default function DashboardScreen() {
  const { user, refreshUser } = useAuth();
  const userId = user?.id;
  const [goals, setGoals] = useState<GoalsResponse | null>(null);
  const [achievementData, setAchievementData] = useState<AchievementsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [questError, setQuestError] = useState(false);
  const [tasks, setTasks] = useState<TasksResponse | null>(null);
  const [scene, setScene] = useState<HomeAvatar | null>(null);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [avatarLoading, setAvatarLoading] = useState(true);
  const [taskError, setTaskError] = useState("");
  const [avatarError, setAvatarError] = useState("");
  const [progressError, setProgressError] = useState("");
  const refreshHome = useRef<() => void>(() => {});

  useFocusEffect(useCallback(() => {
    let active = true;
    let refreshing = false;
    let refreshingTasks = false;
    let refreshingAvatar = false;
    let loadingDashboard = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function refreshTasks() {
      if (!active || refreshingTasks) return;
      refreshingTasks = true;
      setTasksLoading(true);
      try {
        const response = await api.get<TasksResponse>(apiRoutes.tasks);
        if (active) { setTasks(response.data); setTaskError(""); }
      } catch (error) {
        if (active) setTaskError(apiError(error, "Could not refresh tasks. Any saved schedule shown below is the last confirmed one.").message);
      } finally {
        refreshingTasks = false;
        if (active) setTasksLoading(false);
      }
    }
    async function refreshAvatar() {
      if (!active || refreshingAvatar || userId == null) return;
      refreshingAvatar = true;
      setAvatarLoading(true);
      try {
        const [inventory, appearance] = await Promise.all([
          api.get<InventoryResponse>(apiRoutes.inventory),
          loadPreferredAppearance(
            async () => (await api.get<AvatarAppearance>(apiRoutes.me)).data,
            () => getLocalAppearance(userId),
            value => setLocalAppearance(userId, value),
          ),
        ]);
        if (active) { setScene(homeAvatarFromInventory(inventory.data, appearance)); setAvatarError(""); }
      } catch (error) {
        if (active) setAvatarError(apiError(error, "Could not refresh your character. Your equipment has not changed.").message);
      } finally {
        refreshingAvatar = false;
        if (active) setAvatarLoading(false);
      }
    }
    async function refreshGoals() {
      if (!active || refreshing) return;
      refreshing = true;
      clearTimeout(timer);
      void refreshTasks(); // Use the server schedule across focus, resume and local midnight.
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
      if (!active || loadingDashboard) return;
      loadingDashboard = true;
      try {
        setLoading(true);
        if (!await refreshUser()) {
          if (active) {
            setProgressError("Could not refresh your profile. Refresh Home to try again.");
            setTasksLoading(false);
            setAvatarLoading(false);
          }
          return;
        }
        if (!active) return;
        const [, achievementsResponse] = await Promise.all([
          refreshGoals(), api.get<AchievementsResponse>(apiRoutes.achievements), refreshAvatar(),
        ]);
        if (active) { setAchievementData(achievementsResponse.data); setProgressError(""); }
      } catch (error) {
        const message = apiError(error, "Could not load your progress.").message;
        if (active) { setProgressError(message); Alert.alert("Home", message); }
      } finally {
        loadingDashboard = false;
        if (active) setLoading(false);
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
    loading={loading} tasksLoading={tasksLoading} avatarLoading={avatarLoading} questError={questError}
    progressError={progressError} taskError={taskError} avatarError={avatarError}
    onRetry={() => refreshHome.current()}
    onProfile={() => router.navigate("/(tabs)/profile")}
    onTasks={() => router.navigate("/(tabs)/tasks")}
    ad={<BannerAdPlacement placement="HOME" />} />;
}
