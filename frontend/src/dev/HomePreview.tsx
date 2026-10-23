import { useState } from "react";
import { Platform, View, useWindowDimensions } from "react-native";
import { NavigationContainer } from "expo-router/react-navigation";
import { createBottomTabNavigator } from "expo-router/js-tabs";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import HomeContent from "../components/HomeContent";
import { FilterChip, ScreenShell, UiText } from "../components/ui/Primitives";
import { DEFAULT_APPEARANCE } from "../avatar/appearance";
import { homeAvatarFromInventory } from "../home/avatar";
import { tabAppearance, TabIcon, tabIcons } from "../navigation/tabAppearance";
import { uiTheme as ui } from "../theme/theme";
import type { AchievementsResponse, GoalsResponse, TasksResponse, User } from "../types";

// Explicit review fixtures only. No API, session, real ad or account data is used.
const user: User = { id: "preview", username: "Rowan", email: "", timeZone: "America/New_York", onboardingCompleted: true,
  totalXp: 1740, level: 6, xpIntoLevel: 140, xpForNextLevel: 360, xpToNextLevel: 220, progressPercent: 38.9,
  currentStreak: 7, longestStreak: 9, coins: 284, premiumActive: false };
const goal = (current: number, target: number, worldPoints: number) => ({
  current, target, remaining: target - current, progressPercent: current / target * 100, completed: false,
  reward: { worldPoints, granted: false, grantedAt: null },
});
const goals: GoalsResponse = { timeZone: user.timeZone, date: "2026-10-12", week: "2026-W42", player: { worldPoints: 112 },
  daily: { tasks: goal(2, 3, 30) }, weekly: { tasks: goal(8, 15, 100) },
  streak: { currentDays: 7, longestDays: 9, completedToday: true } };
const tasks: TasksResponse = { time: { timeZone: user.timeZone, date: goals.date, weekday: "Monday" },
  summary: { total: 5, active: 5, scheduledToday: 5, dueToday: 3, completedToday: 2 },
  tasks: ["Read a chapter", "Take an afternoon walk", "Plan tomorrow"].map((title, index) => ({
    taskId: String(index), title, description: null, taskSize: "NORMAL", repeatType: "DAILY", repeatDays: [],
    active: true, archived: false, completed: false, completedToday: false, isScheduledToday: true, isDueToday: true,
    currentStreak: 2, bestStreak: 4, xpReward: 35, coinReward: 4, dueTime: ["12:00", "16:00", "20:00"][index],
  })) };
const achievements: AchievementsResponse = { summary: { earned: 2, locked: 6, total: 8, completionPercent: 25, byType: {} },
  achievements: [{ achievementId: "steps", name: "First Steps", description: "Complete your first task.", type: "TASK",
    requiredValue: 1, currentValue: 1, progressPercent: 100, earned: true, earnedAt: "2026-10-01", rewards: [] },
  { achievementId: "steady", name: "Steady Progress", description: "Complete 25 tasks.", type: "TASK",
    requiredValue: 25, currentValue: 18, progressPercent: 72, earned: false, earnedAt: null,
    rewards: [{ itemId: "sample", name: "Forest Tunic", category: "tunic" }] }] };
function scene(background: string | null) {
  return homeAvatarFromInventory({
    equipped: { tunic: "top", pants: "pants", boots: "boots", hat: null, hair: null, pet: null, aura: null, background: background ? "scene" : null },
    items: [{ itemId: "top", category: "tunic", name: "Forest Ranger", assetKey: "avatar-v2/tops/forest-ranger",
      equipped: true, purchasedAt: null, purchasePrice: 0 },
    { itemId: "pants", category: "pants", name: "Forest Ranger Trousers", assetKey: "avatar-v2/bottoms/forest-ranger-trousers",
      equipped: true, purchasedAt: null, purchasePrice: 0 },
    { itemId: "boots", category: "boots", name: "Forest Ranger Boots", assetKey: "avatar-v2/boots/forest-ranger-boots",
      equipped: true, purchasedAt: null, purchasePrice: 0 },
    ...(background ? [{ itemId: "scene", category: "background", name: "Equipped scene", assetKey: background,
      equipped: true, purchasedAt: null, purchasePrice: 0 }] : [])],
  }, DEFAULT_APPEARANCE);
}
const scenes = { normal: scene("avatar-v2/backgrounds/castle-garden"),
  changed: scene("avatar-v2/backgrounds/grand-library"), missing: scene("unavailable-asset"), none: scene(null) };
const Tabs = createBottomTabNavigator();
const titles = { dashboard: "Home", tasks: "Tasks", base: "Base", avatar: "Avatar", shop: "Shop" };
function PreviewHome({ navigation }: { navigation: { navigate: (name: string) => void } }) {
  const [state, setState] = useState("Normal");
  const [notice, setNotice] = useState("");
  const [showControls, setShowControls] = useState(true);
  const isLoading = state === "Loading", isError = state === "Error", isEmpty = state === "Empty";
  return <View style={{ flex: 1, backgroundColor: ui.colors.background }}>
    <View testID="home-review-controls" style={{ padding: ui.spacing.sm, gap: ui.spacing.sm, borderBottomWidth: 1, borderBottomColor: ui.colors.border }}>
      <UiText variant="caption">DEV Home review · fixture values, no account or ad network</UiText>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: ui.spacing.xs }}>
        {showControls && ["Normal", "Quest complete", "Empty", "Loading", "Error", "Changed scene", "Missing scene", "No scene", "Long text", "Large text"].map(label =>
          <FilterChip key={label} label={label} selected={state === label} onPress={() => setState(label)} />)}
        <FilterChip label={showControls ? "Hide review controls" : "Show review controls"} onPress={() => setShowControls(value => !value)} />
      </View>
      {!!notice && <UiText variant="caption" accessibilityLiveRegion="polite">{notice}</UiText>}
    </View>
    {Platform.OS === "web" && state === "Large text" && <style>{`
      [data-testid="home-review"] [dir="auto"] { font-size: 32px !important; line-height: 1.5 !important; }
      [data-testid="home-review"] [aria-level="1"] { font-size: 60px !important; }
      [data-testid="home-review"] [aria-level="2"] { font-size: 42px !important; }
    `}</style>}
    <View testID="home-review" style={{ flex: 1 }}><HomeContent user={isLoading ? null : state === "Long text" ? { ...user, username: "A very long adventurer name that must wrap", coins: 1234567890 } : user}
      goals={isLoading ? null : state === "Quest complete" ? { ...goals,
        daily: { tasks: { ...goals.daily.tasks, current: 8, remaining: 0, progressPercent: 100, completed: true,
          reward: { ...goals.daily.tasks.reward, worldPoints: 25, earnedWorldPoints: 25, granted: true } } },
        weekly: { tasks: goal(9, 15, 100) }, streak: { currentDays: 2, longestDays: 2, completedToday: true },
      } : goals} achievements={isLoading ? null : achievements}
      tasks={isLoading ? null : isEmpty ? { ...tasks, tasks: [], summary: { ...tasks.summary, dueToday: 0 } }
        : state === "Long text" ? { ...tasks, tasks: tasks.tasks.map(task => ({ ...task, title: task.title + " with a longer description of today's intentions and plans" })) } : tasks}
      scene={isLoading ? null : state === "Changed scene" ? scenes.changed : state === "Missing scene" ? scenes.missing : state === "No scene" ? scenes.none : scenes.normal}
      loading={isLoading} tasksLoading={isLoading} avatarLoading={isLoading} questError={isError}
      progressError={isError ? "Could not refresh your profile. Refresh Home to try again." : ""}
      taskError={isError ? "Could not refresh tasks. Showing the last confirmed schedule." : ""}
      avatarError={isError ? "Could not refresh your character. Your equipment has not changed." : ""}
      onRetry={() => { setState("Normal"); setNotice("Preview refresh succeeded."); }}
      onTasks={() => navigation.navigate("tasks")} onProfile={() => setNotice("Profile navigation invoked in preview.")}
      ad={<UiText variant="caption" style={{ padding: ui.spacing.md, textAlign: "center", backgroundColor: ui.colors.stone }}>
        Home banner position · preview only · no ad request
      </UiText>} /></View>
  </View>;
}
function OtherTab() { return <ScreenShell><UiText>This screen is unchanged. Select Home to resume its preview.</UiText></ScreenShell>; }
function PreviewTabs() {
  const { bottom } = useSafeAreaInsets(), { fontScale } = useWindowDimensions();
  return <Tabs.Navigator screenOptions={{ headerShown: false, ...tabAppearance(bottom, fontScale) }}>
    {(Object.keys(titles) as (keyof typeof tabIcons)[]).map(name => <Tabs.Screen key={name} name={name}
      component={name === "dashboard" ? PreviewHome : OtherTab}
      options={{ title: titles[name], tabBarIcon: props => <TabIcon tab={name} {...props} /> }} />)}
  </Tabs.Navigator>;
}
export default function HomePreview() {
  return __DEV__ ? <SafeAreaProvider><NavigationContainer><PreviewTabs /></NavigationContainer></SafeAreaProvider> : null;
}
