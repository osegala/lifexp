import "react-native-get-random-values";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useRef, useState } from "react";
import { AccessibilityInfo, ActivityIndicator, findNodeHandle, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { api, apiError } from "../src/api/client";
import { apiRoutes } from "../src/api/routes";
import { useAuth } from "../src/context/AuthContext";
import { normalizeAppearance, type AvatarAppearance } from "../src/avatar/appearance";
import { setLocalAppearance } from "../src/avatar/localAppearance";
import AppearanceEditor from "../src/components/AppearanceEditor";
import AvatarRenderer from "../src/components/AvatarRenderer";
import TaskEditor from "../src/components/TaskEditor";
import NotificationSettings from "../src/components/NotificationSettings";
import { saveTask } from "../src/tasks/saveTask";
import type { TaskInput } from "../src/tasks/scheduling";
import type { TasksResponse } from "../src/types";
import { emptyProgress, finishOnboarding, progressKey, readProgress, saveStarterTask, STARTER_SUGGESTIONS, STEPS, type SetupProgress } from "../src/onboarding/progress";
import { uiTheme as ui } from "../src/theme/theme";
import LifeButton from "../src/components/LifeButton";
import { ScreenShell } from "../src/components/ui/Primitives";

export default function OnboardingRoute() {
  const { user } = useAuth();
  return user ? <Onboarding key={user.id} userId={user.id} /> : null;
}

function Action({ title, onPress, disabled, secondary = false }: {
  title: string; onPress: () => void; disabled?: boolean; secondary?: boolean;
}) {
  return <LifeButton tone="parchment" title={title} onPress={onPress} disabled={disabled}
    variant={secondary ? "secondary" : "primary"} />;
}

export function Onboarding({ userId }: { userId: string | number }) {
  const { user, refreshUser, logout } = useAuth();
  const [progress, setProgress] = useState<SetupProgress>(emptyProgress);
  const progressRef = useRef(progress);
  const [appearance, setAppearance] = useState<AvatarAppearance | null>(null);
  const savedAppearance = useRef<AvatarAppearance | null>(null);
  const [tasks, setTasks] = useState<TasksResponse | null>(null);
  const [taskLoadError, setTaskLoadError] = useState("");
  const [resumeTask, setResumeTask] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const [taskBusy, setTaskBusy] = useState(false);
  const [error, setError] = useState("");
  const scroll = useRef<ScrollView>(null);
  const heading = useRef<Text>(null);
  const version = useRef(0);
  const locked = busy || taskBusy;
  const persist = useCallback(async (next: SetupProgress) => {
    await AsyncStorage.setItem(progressKey(userId), JSON.stringify(next));
    progressRef.current = next;
    setProgress(next);
  }, [userId]);

  const load = useCallback(async () => {
    const request = ++version.current;
    setError(""); setBusy(true);
    try {
      const [profile, raw] = await Promise.all([api.get<AvatarAppearance>(apiRoutes.me, { timeout: 15_000 }), AsyncStorage.getItem(progressKey(userId))]);
      if (version.current !== request) return;
      const saved = readProgress(raw);
      progressRef.current = saved; setProgress(saved); setResumeTask(!!saved.pendingTask);
      savedAppearance.current = normalizeAppearance(profile.data);
      setAppearance(savedAppearance.current); setLoaded(true);
    } catch { if (version.current === request) setError("Could not load your saved setup. Nothing has been reset. Please retry."); }
    finally { if (version.current === request) setBusy(false); }
  }, [userId]);
  const cancelLoad = useCallback(() => { version.current++; }, []);
  useEffect(() => { void load(); return cancelLoad; }, [load, cancelLoad]);

  const loadTasks = useCallback(async () => {
    try { const response = await api.get<TasksResponse>(apiRoutes.tasks, { timeout: 15_000 }); setTasks(response.data); setTaskLoadError(""); }
    catch { setTaskLoadError("Could not load your saved schedule. Retry, or skip tasks for now."); }
  }, []);
  useEffect(() => {
    if (loaded && progress.step === 2) { setResumeTask(!!progressRef.current.pendingTask); void loadTasks(); }
  }, [loaded, progress.step, loadTasks]);
  useEffect(() => {
    if (!loaded) return;
    scroll.current?.scrollTo({ y: 0, animated: false });
    if (Platform.OS === "web") (heading.current as unknown as { focus?: () => void })?.focus?.();
    else { const node = findNodeHandle(heading.current); if (node) AccessibilityInfo.setAccessibilityFocus(node); }
  }, [loaded, progress.step]);

  async function run(action: () => Promise<void>) {
    if (pending.current || taskBusy) return;
    pending.current = true; setBusy(true); setError("");
    try { await action(); }
    catch (failure) { setError(apiError(failure, failure instanceof Error ? failure.message : "Could not save. Please retry.").message); }
    finally { pending.current = false; setBusy(false); }
  }
  const go = (step: number) => run(() => persist({ ...progressRef.current, step }));
  async function saveAvatar() {
    if (!appearance) return;
    await run(async () => {
      const result = await api.patch<AvatarAppearance>(apiRoutes.me, appearance, { timeout: 15_000 });
      const saved = normalizeAppearance(result.data);
      savedAppearance.current = saved;
      setAppearance(saved); await setLocalAppearance(userId, saved);
      await persist({ ...progressRef.current, step: 2 });
    });
  }
  const createTask = (input: TaskInput, savedTaskId?: string) => saveStarterTask(
    progressRef.current, input, savedTaskId, saveTask, persist,
    () => `setup-${Array.from(crypto.getRandomValues(new Uint8Array(16)), value => value.toString(16).padStart(2, "0")).join("")}`,
  );
  const count = progress.taskIds.length;

  return <ScreenShell scrollRef={scroll} keyboardSafe contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <View style={styles.panel}>
      <Text style={styles.brand}>EVRENTHIA · FIRST STEPS</Text>
      {loaded && <Text style={styles.hint}>Step {progress.step + 1} of {STEPS.length}</Text>}
      <Text ref={heading} tabIndex={-1} accessibilityRole="header" style={styles.title}>{loaded ? STEPS[progress.step] : "Getting your setup ready"}</Text>
      {!loaded && (busy ? <ActivityIndicator accessibilityLabel="Loading setup" color={ui.colors.primary} /> : <Action title="Retry setup" onPress={() => void load()} />)}

      {loaded && progress.step === 0 && <>
        <Text style={styles.body}>Turn everyday progress into an adventure.</Text>
        <Text style={styles.hint}>Complete real-life tasks, grow your character, and build your world. Make it yours in a few short steps.</Text>
        <Action title="Get Started" disabled={locked} onPress={() => void go(1)} />
      </>}
      {loaded && progress.step === 1 && appearance && <>
        <Text style={styles.hint}>Choose your look. You can change it later from Avatar.</Text>
        <View style={styles.preview}><AvatarRenderer {...appearance} /></View>
        <AppearanceEditor tone="parchment" appearance={appearance} dirty={JSON.stringify(appearance) !== JSON.stringify(savedAppearance.current)} saving={locked} showSaveButton={false}
          onChange={patch => { if (!locked) setAppearance(current => current ? { ...current, ...patch } : current); }} onSave={() => void saveAvatar()} />
        <Action title={busy ? "Saving appearance…" : "Save appearance & continue"} disabled={locked} onPress={() => void saveAvatar()} />
        <Action title="Keep saved look / skip" secondary disabled={locked} onPress={() => { setAppearance(savedAppearance.current); void go(2); }} />
      </>}
      {loaded && progress.step === 2 && <>
        <Text style={styles.hint}>Try adding two or three tasks that matter to you. Suggestions only fill the title; nothing is created until you tap Add task.</Text>
        <Text accessibilityLiveRegion="polite" style={styles.body}>{count} {count === 1 ? "task" : "tasks"} saved during setup</Text>
        {!!taskLoadError && <><Text accessibilityRole="alert" style={styles.error}>{taskLoadError}</Text><Action title="Retry schedule" onPress={() => void loadTasks()} /></>}
        {resumeTask && progress.pendingTask ? <>
          <Text style={styles.hint}>A save was interrupted: “{progress.pendingTask.input.title}”. Retry safely to confirm it, then add any task reminders from Tasks.</Text>
          <Action title="Retry interrupted task" disabled={locked} onPress={() => void run(async () => {
            await createTask(progress.pendingTask!.input); setResumeTask(false);
          })} />
        </> : tasks ? <TaskEditor tone="parchment" time={tasks.time} disabled={busy} suggestions={STARTER_SUGGESTIONS}
          onBusyChange={setTaskBusy} onSave={createTask} /> : !taskLoadError && <ActivityIndicator accessibilityLabel="Loading task schedule" color={ui.colors.primary} />}
        <Text style={styles.hint}>Only saved tasks are kept. You can always add more in Tasks.</Text>
        <Action title={count ? "Continue to reminders" : "Skip tasks for now"} disabled={locked} onPress={() => void go(3)} />
      </>}
      {loaded && progress.step === 3 && <>
        <Text style={styles.body}>A nudge when you need it.</Text>
        <Text style={styles.hint}>Evrenthia can remind you when tasks are due and when your streak is at risk. Save any changes below, or skip for now.</Text>
        {Platform.OS === "web" && <Text style={styles.hint}>Push notifications are available in the iOS/Android app. You can save preferences here and continue without enabling push.</Text>}
        <NotificationSettings tone="parchment" timeZone={user?.timeZone ?? "UTC"} />
        <Action title="Continue / skip reminders" disabled={locked} onPress={() => void go(4)} />
      </>}
      {loaded && progress.step === 4 && <>
        {[
          ["1 · Do something that matters", "Complete your real-life tasks to earn XP and coins."],
          ["2 · Grow your character", "XP builds your level. Spend coins on available cosmetics in the Shop."],
          ["3 · Build a rhythm", "Complete Daily and Weekly Quests to earn World Points."],
          ["4 · Grow your world", "Spend World Points to upgrade buildings in your base."],
        ].map(([title, detail]) => <View key={title} style={styles.card}><Text accessibilityRole="header" style={styles.body}>{title}</Text><Text style={styles.hint}>{detail}</Text></View>)}
        <Action title="Continue to finish" disabled={locked} onPress={() => void go(5)} />
      </>}
      {loaded && progress.step === 5 && <>
        <Text style={styles.body}>Your adventure starts with one small win.</Text>
        <Text style={styles.hint}>{count ? `${count} tasks saved during setup.` : "Add your first task whenever you’re ready."} Your saved look and reminder preferences are ready. You can change them later.</Text>
        <Action title={busy ? "Finishing setup…" : "Enter Evrenthia"} disabled={locked} onPress={() => void run(() => finishOnboarding(
          async () => (await api.patch<{ onboardingCompleted: boolean }>(apiRoutes.me, { onboardingCompleted: true }, { timeout: 15_000 })).data,
          refreshUser,
        ))} />
      </>}
      {!!error && <Text accessibilityRole="alert" accessibilityLiveRegion="assertive" style={styles.error}>{error}</Text>}
      {loaded && progress.step > 0 && <Action title="Back" secondary disabled={locked} onPress={() => void go(progress.step - 1)} />}
      <Action title="Sign out" secondary disabled={locked} onPress={() => void run(logout)} />
    </View>
  </ScreenShell>;
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, maxWidth: 680 },
  panel: { width: "100%", gap: ui.spacing.md },
  brand: { color: ui.colors.primary, fontSize: 12, fontWeight: "700", letterSpacing: 1 },
  title: { ...ui.type.display, color: ui.colors.text, fontFamily: Platform.select(ui.font.display),
    // Keep the browser focus indication on the step heading in the app palette.
    ...(Platform.OS === "web" ? { outlineColor: ui.colors.focus, outlineWidth: 1, outlineOffset: 3 } : {}) },
  body: { ...ui.type.section, color: ui.colors.text, fontFamily: Platform.select(ui.font.display) },
  hint: { ...ui.type.caption, color: ui.colors.secondaryText },
  error: { ...ui.type.caption, color: ui.colors.danger },
  card: { backgroundColor: ui.colors.surface, borderWidth: 1, borderColor: ui.colors.border, padding: ui.spacing.md, borderRadius: ui.radius.md, gap: ui.spacing.sm },
  preview: { width: 240, maxWidth: "100%", alignSelf: "center", borderRadius: ui.radius.lg, overflow: "hidden", backgroundColor: ui.colors.sky },
});
