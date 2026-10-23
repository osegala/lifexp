import { useState } from "react";
import { Platform, View, useWindowDimensions } from "react-native";
import { NavigationContainer } from "expo-router/react-navigation";
import { createBottomTabNavigator } from "expo-router/js-tabs";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "../api/client";
import { apiRoutes } from "../api/routes";
import TaskEditor from "../components/TaskEditor";
import TasksContent from "../components/TasksContent";
import { FilterChip, ScreenShell, UiText } from "../components/ui/Primitives";
import { tabAppearance, TabIcon, tabIcons } from "../navigation/tabAppearance";
import { uiTheme as ui } from "../theme/theme";
import type { Task, TasksResponse } from "../types";
import type { TaskInput, TaskView } from "../tasks/scheduling";

// No authenticated session, backend, device registration, or ad requests in this entry.
// The real editor's reminder hook receives fixtures through a local-only adapter.
if (__DEV__) api.defaults.adapter = async config => {
  if (config.url !== apiRoutes.reminders && !config.url?.startsWith(`${apiRoutes.reminders}/`)) throw new Error("Preview blocks external requests");
  return { config, status: 200, statusText: "OK", headers: {}, data: config.method === "get" ? { reminders: [] }
    : { reminder: { reminderId: "preview-reminder", taskId: "preview", enabled: true } } };
};

const time = { date: "2026-10-13", weekday: "TUE", timeZone: "America/New_York" };
const task = (taskId: string, title: string, fields: Partial<Task> = {}): Task => ({
  taskId, title, description: null, taskSize: "NORMAL", repeatType: "NONE", repeatDays: [],
  active: true, archived: false, completed: false, completedToday: false, isScheduledToday: true, isDueToday: true,
  currentStreak: 0, bestStreak: 0, xpReward: 35, coinReward: 4, ...fields,
});
const fixtures = [
  task("read", "Read a chapter", { description: "Make a little room for a good book.", repeatType: "DAILY", dueTime: "09:00", currentStreak: 3, bestStreak: 8 }),
  task("walk", "Take an afternoon walk", { dueTime: "16:00", startDate: time.date }),
  task("plan", "Plan tomorrow", { dueTime: "20:00", taskSize: "QUICK", xpReward: 10, coinReward: 1 }),
  task("weekly", "Practice drawing", { repeatType: "WEEKLY", repeatDays: ["MON", "WED", "FRI"], dueTime: "10:00", nextScheduledDate: "2026-10-14", isDueToday: false }),
  task("monthly", "Review this month's progress", { repeatType: "MONTHLY", startDate: "2026-01-31", nextScheduledDate: "2026-10-31", isDueToday: false }),
  task("done", "Make breakfast", { completed: true, completedToday: true, isDueToday: false }),
  task("inactive", "Organize the studio", { active: false, isDueToday: false }),
];
function PreviewTasks() {
  const [state, setState] = useState("Normal"), [controls, setControls] = useState(true);
  const [rows, setRows] = useState(fixtures), [view, setView] = useState<TaskView>("Today");
  const [editing, setEditing] = useState<string | null>(null), [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState(""), [failure, setFailure] = useState("");
  const shown = state === "Empty" ? [] : state === "Long text" ? rows.map(row => ({ ...row,
    title: row.title + " and write down everything I learned along the way so I can return to it later", description: "A longer supporting description that should remain readable without truncation or pushing actions off the screen." })) : rows;
  const data: TasksResponse = { time, tasks: shown, summary: { total: shown.length, active: shown.filter(row => row.active).length,
    dueToday: shown.filter(row => row.isDueToday).length, completedToday: shown.filter(row => row.completedToday).length, scheduledToday: 4 } };
  async function save(input: TaskInput, id?: string) {
    if (state === "Save failure") throw new Error("Preview save failed. Your changes are still here.");
    const taskId = id ?? `local-${rows.length}`;
    setRows(current => id ? current.map(row => row.taskId === id ? { ...row, ...input } : row) : [...current, task(taskId, input.title, input)]);
    setNotice("Preview task saved locally. No backend request or reward.");
    return taskId;
  }
  function complete(row: Task) {
    if (busy) return;
    if (state === "Completion failure") { setFailure("Preview completion failed. No reward was confirmed."); return; }
    setBusy(row.taskId);
    // Deliberate fixture delay to inspect pending visuals, not production completion logic.
    setTimeout(() => {
      setRows(current => current.map(item => item.taskId === row.taskId ? { ...item, completedToday: true, isDueToday: false,
        completed: item.repeatType === "NONE", nextScheduledDate: item.repeatType === "NONE" ? null : "2026-10-14" } : item));
      setBusy(null); setNotice("Simulated server confirmation. This preview grants no rewards.");
    }, 800);
  }
  return <View style={{ flex: 1, backgroundColor: ui.colors.background }}>
    <View testID="tasks-review-controls" style={{ padding: ui.spacing.sm, gap: ui.spacing.sm, borderBottomWidth: 1, borderBottomColor: ui.colors.border }}>
      <UiText variant="caption">DEV Tasks review · fixtures only · no account or network</UiText>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: ui.spacing.xs }}>
        {controls && ["Normal", "Empty", "Loading", "Error", "Long text", "Large text", "Save failure", "Completion failure"].map(label =>
          <FilterChip key={label} label={label} selected={state === label} onPress={() => { setState(label); setFailure(""); }} />)}
        <FilterChip label={controls ? "Hide review controls" : "Show review controls"} onPress={() => setControls(value => !value)} />
      </View>
    </View>
    {Platform.OS === "web" && state === "Large text" && <style>{`
      [data-testid="tasks-review"] [dir="auto"], [data-testid="tasks-review"] input { font-size: 30px !important; line-height: 1.5 !important; }
      [data-testid="tasks-review"] [aria-level="1"] { font-size: 60px !important; }
    `}</style>}
    <View testID="tasks-review" style={{ flex: 1 }}><TasksContent data={state === "Loading" ? null : data} view={view} editing={editing}
      loading={state === "Loading"} busy={busy} loadError={state === "Error" ? "Could not refresh tasks. Showing the last saved schedule." : ""}
      completionError={failure} reminderNotice={notice} onRetry={() => setState("Normal")}
      onView={value => { setView(value); setEditing(null); }} onComplete={complete} onEdit={row => setEditing(row.taskId)}
      onArchive={row => { setRows(current => current.filter(item => item.taskId !== row.taskId)); setNotice("Preview task archived locally."); }}
      createEditor={<TaskEditor tone="parchment" time={time} disabled={busy !== null || state === "Loading"} onSave={save} />}
      renderEditor={row => <TaskEditor tone="parchment" task={row} time={time} disabled={busy !== null}
        onSave={input => save(input, row.taskId)} onCancel={() => setEditing(null)} onReminderNotice={setNotice} />} />
    </View>
  </View>;
}
const Tabs = createBottomTabNavigator();
const titles = { dashboard: "Home", tasks: "Tasks", base: "Base", avatar: "Avatar", shop: "Shop" };
function OtherTab() { return <ScreenShell><UiText>This screen is unchanged. Return to Tasks to review.</UiText></ScreenShell>; }
function PreviewTabs() {
  const { bottom } = useSafeAreaInsets(), { fontScale } = useWindowDimensions();
  return <Tabs.Navigator initialRouteName="tasks" screenOptions={{ headerShown: false, ...tabAppearance(bottom, fontScale) }}>
    {(Object.keys(titles) as (keyof typeof tabIcons)[]).map(name => <Tabs.Screen key={name} name={name}
      component={name === "tasks" ? PreviewTasks : OtherTab}
      options={{ title: titles[name], tabBarIcon: props => <TabIcon tab={name} {...props} /> }} />)}
  </Tabs.Navigator>;
}
export default function TasksPreview() {
  return __DEV__ ? <SafeAreaProvider><NavigationContainer><PreviewTabs /></NavigationContainer></SafeAreaProvider> : null;
}
