import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useState, type ReactNode } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import type { Task, TasksResponse } from "../types";
import { recurrenceLabel, TASK_SIZE_OPTIONS, tasksForView, type TaskView } from "../tasks/scheduling";
import { uiTheme as ui } from "../theme/theme";
import { BadgePill } from "./ui/Indicators";
import { EmptyState, FilterChip, ScreenShell, SectionHeader, SurfaceCard, UiPressable, UiText } from "./ui/Primitives";
import LifeButton from "./LifeButton";

type Props = {
  data: TasksResponse | null;
  view: TaskView;
  editing: string | null;
  loading: boolean;
  busy: string | null;
  loadError: string;
  completionError: string;
  reminderNotice: string;
  onView: (view: TaskView) => void;
  onRetry: () => void;
  onComplete: (task: Task) => void;
  onEdit: (task: Task) => void;
  onArchive: (task: Task) => void;
  createEditor: ReactNode;
  renderEditor: (task: Task) => ReactNode;
};

// Presentation only. Preserve the canonical flat ordering; tasks have no category field.
export default function TasksContent(props: Props) {
  const [creating, setCreating] = useState(false);
  const tasks = tasksForView(props.data?.tasks ?? [], props.view, props.data?.time.date ?? "");
  return <ScreenShell keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
    <View style={styles.titleBlock}>
      <View style={styles.header}>
      <View style={styles.heading}>
        <UiText variant="display" accessibilityRole="header" aria-level={1}>Tasks</UiText>
      </View>
      <UiPressable accessibilityRole="button" accessibilityLabel={creating ? "Hide new task form" : "Add task"}
        accessibilityState={{ expanded: creating }} onPress={() => setCreating(value => !value)} style={styles.add}>
        <MaterialCommunityIcons name={creating ? "minus" : "plus"} size={ui.size.icon} color={ui.colors.onPrimary} accessible={false} aria-hidden />
        <UiText variant="label" style={styles.onPrimary}>{creating ? "Hide form" : "Add task"}</UiText>
      </UiPressable>
      </View>
      <UiText variant="caption" style={styles.secondary}>Turn small steps into a stronger you.</UiText>
    </View>
    {!!props.reminderNotice && <UiText accessibilityLiveRegion="polite" style={styles.secondary}>{props.reminderNotice}</UiText>}
    {!!props.completionError && <UiText accessibilityRole="alert" style={styles.error}>{props.completionError}</UiText>}
    {!!props.loadError && <SurfaceCard style={styles.notice}>
      <UiText accessibilityRole="alert" style={styles.error}>{props.loadError}</UiText>
      <LifeButton tone="parchment" variant="secondary" title="Refresh tasks" onPress={props.onRetry} disabled={props.loading} />
    </SurfaceCard>}
    {/* Keep the editor mounted: collapsing the form must never discard a draft/reminder retry ID. */}
    <View style={!creating && styles.hidden}>
      <SurfaceCard>{props.createEditor}</SurfaceCard>
    </View>
    <View style={styles.schedule}>
      <View style={styles.filters}>{(["Today", "Upcoming", "All"] as TaskView[]).map(view =>
        <FilterChip key={view} label={view} selected={props.view === view} onPress={() => props.onView(view)} />)}</View>
      {props.data && <View style={styles.summary}>
        <UiText variant="label">{props.data.time.weekday} · {props.data.time.date}</UiText>
        <UiText variant="caption" style={styles.secondary}>{props.data.summary.dueToday} due · {props.data.summary.completedToday} completed</UiText>
        <UiText variant="caption" style={styles.secondary}>{props.data.time.timeZone}</UiText>
      </View>}
    </View>
    {props.loading && <View accessibilityLiveRegion="polite" style={styles.loading}>
      <ActivityIndicator color={ui.colors.primary} accessibilityLabel="Loading tasks" />
      <UiText variant="caption" style={styles.secondary}>{props.data ? "Refreshing your schedule…" : "Loading your schedule…"}</UiText>
    </View>}
    {props.data && <View style={styles.list}>
      <SectionHeader title={props.view === "Today" ? "Today's tasks" : props.view === "Upcoming" ? "Upcoming tasks" : "All tasks"}
        subtitle={props.view === "Upcoming" ? "Next available occurrence of each task." : undefined}
        trailing={<UiText variant="caption" style={styles.secondary}>{tasks.length} task{tasks.length === 1 ? "" : "s"}</UiText>} />
      {tasks.map(task => {
        const completed = task.completedToday || (task.repeatType === "NONE" && task.completed);
        const disabled = props.view === "Upcoming" || !task.isDueToday || props.busy !== null;
        return <SurfaceCard key={task.taskId} style={[styles.task, completed && styles.completed]}>
          {props.editing === task.taskId ? props.renderEditor(task) : <>
            <View style={styles.row}>
              <UiPressable accessibilityRole="button" accessibilityLabel={`Complete ${task.title}`}
                accessibilityHint={completed ? "Already completed" : props.view === "Upcoming" ? "Available on its scheduled day" : "Confirm task completion"}
                accessibilityState={{ disabled, busy: props.busy === task.taskId }} disabled={disabled}
                onPress={() => props.onComplete(task)} style={[styles.complete, completed && styles.completeDone, disabled && !completed && styles.disabled]}>
                <MaterialCommunityIcons name={completed ? "check-circle" : "checkbox-blank-outline"} size={ui.size.icon}
                  color={completed ? ui.colors.onPrimary : disabled ? ui.colors.disabledText : ui.colors.primary} accessible={false} aria-hidden />
              </UiPressable>
              <View style={styles.copy}>
                <UiText variant="label" style={styles.taskTitle}>{task.title}</UiText>
                {!!task.description && <UiText variant="caption" style={styles.secondary}>{task.description}</UiText>}
                <UiText variant="caption" style={styles.secondary}>{recurrenceLabel(task)}{task.dueTime ? ` · ${task.dueTime}` : ""}</UiText>
                {task.repeatType === "NONE" && !!task.startDate && <UiText variant="caption" style={styles.secondary}>Due: {task.startDate}</UiText>}
                {!!task.nextScheduledDate && <UiText variant="caption" style={styles.secondary}>Next: {task.nextScheduledDate}</UiText>}
                <UiText variant="caption" style={styles.secondary}>
                  {TASK_SIZE_OPTIONS.find(option => option.value === task.taskSize)?.label ?? "Normal"}
                  {` · +${task.xpReward} XP · +${task.coinReward} coin${task.coinReward === 1 ? "" : "s"}`}
                </UiText>
                {task.repeatType !== "NONE" && <UiText variant="caption" style={styles.secondary}>Streak {task.currentStreak} · best {task.bestStreak}</UiText>}
                <View style={styles.badges}>
                  {completed && <BadgePill label={task.completedToday ? "Completed today" : "Completed"} tone="success" />}
                  {!task.active && <BadgePill label="Inactive" />}
                  {props.busy === task.taskId && <UiText variant="caption" accessibilityLiveRegion="polite">Updating task…</UiText>}
                </View>
              </View>
            </View>
            <View style={styles.actions}>
              <UiPressable accessibilityRole="button" accessibilityLabel={`Edit ${task.title}`} accessibilityState={{ disabled: props.busy !== null }}
                disabled={props.busy !== null} onPress={() => props.onEdit(task)} style={[styles.action, props.busy !== null && styles.disabled]}>
                <MaterialCommunityIcons name="pencil-outline" color={props.busy !== null ? ui.colors.disabledText : ui.colors.secondaryText} size={ui.size.smallIcon} accessible={false} aria-hidden />
                <UiText variant="label" style={props.busy !== null ? styles.disabledText : styles.secondary}>Edit</UiText>
              </UiPressable>
              <UiPressable accessibilityRole="button" accessibilityLabel={`Archive ${task.title}`} accessibilityState={{ disabled: props.busy !== null }}
                disabled={props.busy !== null} onPress={() => props.onArchive(task)} style={[styles.action, props.busy !== null && styles.disabled]}>
                <MaterialCommunityIcons name="archive-outline" color={props.busy !== null ? ui.colors.disabledText : ui.colors.danger} size={ui.size.smallIcon} accessible={false} aria-hidden />
                <UiText variant="label" style={props.busy !== null ? styles.disabledText : styles.error}>Archive</UiText>
              </UiPressable>
            </View>
          </>}
        </SurfaceCard>;
      })}
      {!props.loading && tasks.length === 0 && <EmptyState
        title={props.view === "Today" ? "Nothing scheduled for today." : props.view === "Upcoming" ? "No upcoming tasks." : "No tasks yet."}
        description={props.view === "All" ? "Add a task to take your next step." : "Check All for your other tasks, or add something new."}
        action={<LifeButton tone="parchment" title="Add a task" onPress={() => setCreating(true)} />} />}
    </View>}
  </ScreenShell>;
}

const styles = StyleSheet.create({
  titleBlock: { gap: ui.spacing.xs },
  header: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: ui.spacing.md },
  heading: { flexGrow: 1, flexShrink: 1, gap: ui.spacing.xs },
  add: { flexDirection: "row", alignItems: "center", gap: ui.spacing.sm, backgroundColor: ui.colors.primary, paddingHorizontal: ui.spacing.md, paddingVertical: ui.spacing.sm, borderRadius: ui.radius.md },
  onPrimary: { color: ui.colors.onPrimary },
  secondary: { color: ui.colors.secondaryText },
  error: { color: ui.colors.danger },
  hidden: { display: "none" },
  notice: { gap: ui.spacing.md },
  filters: { flexDirection: "row", flexWrap: "wrap", gap: ui.spacing.sm },
  schedule: { gap: ui.spacing.md },
  summary: { gap: ui.spacing.xs },
  loading: { flexDirection: "row", alignItems: "center", gap: ui.spacing.sm },
  list: { gap: ui.spacing.sm },
  task: { gap: ui.spacing.sm },
  completed: { borderColor: ui.colors.success },
  row: { flexDirection: "row", alignItems: "flex-start", gap: ui.spacing.sm },
  copy: { flex: 1, minWidth: 0, gap: ui.spacing.xs },
  taskTitle: { color: ui.colors.text },
  complete: { alignItems: "center", borderWidth: 1, borderColor: ui.colors.controlBorder, borderRadius: ui.radius.md },
  completeDone: { backgroundColor: ui.colors.primary, borderColor: ui.colors.primary },
  disabled: { backgroundColor: ui.colors.disabled, borderColor: ui.colors.disabled },
  disabledText: { color: ui.colors.disabledText },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: ui.spacing.xs },
  actions: { flexDirection: "row", justifyContent: "flex-end", flexWrap: "wrap", gap: ui.spacing.sm, borderTopWidth: 1, borderTopColor: ui.colors.divider },
  action: { flexDirection: "row", alignItems: "center", gap: ui.spacing.xs, paddingHorizontal: ui.spacing.sm, borderRadius: ui.radius.md },
});
