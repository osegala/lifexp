import GameNotice from "./ui/GameNotice";
import { useRef, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { apiError } from "../api/client";
import { colors, radius, spacing, uiTheme as ui } from "../theme/theme";
import type { Task, TaskSize, TasksResponse } from "../types";
import { DAY_NAMES, TASK_SIZE_OPTIONS, WEEKDAYS, type TaskInput } from "../tasks/scheduling";
import ButtonSurface, { buttonHitArea } from "./ui/ButtonSurface";
import LifeInput from "./LifeInput";
import ScheduleInput from "./ScheduleInput";
import { formatDate, formatTime } from "../utils/dateFormat";
import { UiPressable } from "./ui/Primitives";
import { useTaskReminder } from "../notifications/useTaskReminder";
import { REMINDER_OPTIONS, reminderTiming } from "../notifications/model";

type RepeatChoice = Task["repeatType"] | "CUSTOM";
const REPEAT_OPTIONS: { value: RepeatChoice; label: string }[] = [
  { value: "NONE", label: "Never" }, { value: "DAILY", label: "Daily" },
  { value: "WEEKLY", label: "Weekly" }, { value: "MONTHLY", label: "Monthly" },
  { value: "CUSTOM", label: "Custom weekdays" },
];

export default function TaskEditor({ task, time, disabled, onSave, onCancel, onReminderNotice, suggestions, onBusyChange, tone = "legacy" }: {
  tone?: "legacy" | "parchment";
  task?: Task;
  time?: TasksResponse["time"];
  disabled: boolean;
  onSave: (input: TaskInput, savedTaskId?: string) => Promise<string | void>;
  onCancel?: () => void;
  onReminderNotice?: (message: string) => void;
  suggestions?: readonly string[];
  onBusyChange?: (busy: boolean) => void;
}) {
  const styles = tone === "parchment" ? parchmentStyles : legacyStyles;
  const Action = tone === "parchment" ? UiPressable : Pressable;
  const inputAppearance = tone === "parchment" ? { tone: "parchment" as const, style: parchmentStyles.input, placeholderTextColor: ui.colors.subduedText } : {};
  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [taskSize, setTaskSize] = useState<TaskSize>(task?.taskSize ?? "NORMAL");
  const [repeat, setRepeat] = useState<RepeatChoice>(task?.repeatType === "WEEKLY" && task.repeatDays.length > 1 ? "CUSTOM" : task?.repeatType ?? "NONE");
  const [days, setDays] = useState(task?.repeatDays ?? []);
  const [startDate, setStartDate] = useState(task?.startDate ?? "");
  const [dueTime, setDueTime] = useState(task?.dueTime ?? "");
  const [scheduleOpen, setScheduleOpen] = useState(!!task);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const savedTaskId = useRef<string | undefined>(task?.taskId);
  const reminder = useTaskReminder(task?.taskId);
  const locked = disabled || saving;

  function selectRepeat(value: RepeatChoice) {
    setRepeat(value);
    if (value === "WEEKLY") setDays([days[0] ?? time?.weekday ?? "MON"]);
    else if (value !== "CUSTOM") setDays([]);
    if (value === "MONTHLY" && !startDate) setStartDate(time?.date ?? "");
  }

  async function save() {
    if (locked || savingRef.current) return;
    const date = startDate.trim();
    const clock = dueTime.trim();
    if (!title.trim()) return setError("Enter a task title.");
    if ((repeat === "WEEKLY" || repeat === "CUSTOM") && !days.length) return setError("Choose at least one weekday.");
    if (repeat === "MONTHLY" && !date) return setError("Choose a start date for the monthly task.");
    if (date && (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < "1900-01-01" || date > "9998-12-31"
      || !Number.isFinite(Date.parse(`${date}T00:00:00Z`))
      || new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date)) return setError("Enter a valid date, such as Oct 20, 2026.");
    if (clock && !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(clock)) return setError("Enter a valid time, such as 9:00 AM.");
    if (reminder.loading || reminder.error) return setError("Load the saved reminder before saving. Use Retry reminders below.");
    try { reminderTiming(reminder.choice, reminder.clock, clock); } catch (failure) { return setError((failure as Error).message); }
    savingRef.current = true;
    setSaving(true);
    onBusyChange?.(true);
    setError("");
    let taskSaved = false;
    try {
      const id = await onSave({ title: title.trim(), description: description.trim() || null, taskSize,
        repeatType: repeat === "CUSTOM" ? "WEEKLY" : repeat,
        repeatDays: repeat === "WEEKLY" || repeat === "CUSTOM" ? WEEKDAYS.filter(day => days.includes(day)) : [],
        startDate: date || null, dueTime: clock || null }, savedTaskId.current);
      savedTaskId.current = id || savedTaskId.current;
      taskSaved = true;
      if (savedTaskId.current) {
        const message = await reminder.save(savedTaskId.current, clock);
        // Keep permission status visible when the edit form closes after saving.
        if (task && message) onReminderNotice?.(message);
      }
      if (task) onCancel?.();
      if (!task) {
        setTitle(""); setDescription(""); setTaskSize("NORMAL"); setRepeat("NONE");
        setDays([]); setStartDate(""); setDueTime(""); setScheduleOpen(false);
        savedTaskId.current = undefined; reminder.reset();
      }
    } catch (failure) {
      setError(taskSaved ? "The task was saved, but its reminder could not be saved. Retry; this will not create another task." : apiError(failure, "Could not save the task. Your changes are still here.").message);
    } finally {
      savingRef.current = false;
      setSaving(false);
      onBusyChange?.(false);
    }
  }

  return <View style={styles.form}>
    <Text accessibilityRole="header" aria-level={2} style={styles.heading}>{task ? "Edit task" : "Add a task"}</Text>
    {suggestions && <View style={styles.options}>{suggestions.map(suggestion => <Action key={suggestion}
      accessibilityRole="button" accessibilityLabel={`Use suggestion: ${suggestion}`} accessibilityState={{ disabled: locked }}
      disabled={locked} onPress={() => setTitle(suggestion)} style={styles.chip}>
      <Text style={styles.chipText}>{suggestion}</Text>
    </Action>)}</View>}
    <Text style={styles.label}>Task title</Text>
    <LifeInput {...inputAppearance} accessibilityLabel="Task title" placeholder="What will you do?" maxLength={200} value={title} onChangeText={setTitle} editable={!locked} />
    {tone === "parchment" && <Text style={styles.label}>Description (optional)</Text>}
    <LifeInput {...inputAppearance} accessibilityLabel="Description (optional)" placeholder="Description (optional)" maxLength={2000} value={description} onChangeText={setDescription} editable={!locked} />
    <Text style={styles.label}>Task size</Text>
    <View style={styles.options}>{TASK_SIZE_OPTIONS.map(option => <Action key={option.value} accessibilityRole="button"
      accessibilityLabel={`${option.label}, ${option.xp} XP`} accessibilityState={{ selected: taskSize === option.value, disabled: locked }}
      aria-pressed={tone === "parchment" ? taskSize === option.value : undefined}
      disabled={locked} onPress={() => setTaskSize(option.value)} style={[styles.sizeChip, taskSize === option.value && styles.selected]}>
      <Text style={[styles.chipText, taskSize === option.value && styles.selectedText]}>{option.label}</Text>
      <Text style={[styles.reward, taskSize === option.value && styles.selectedText]}>+{option.xp} XP</Text>
    </Action>)}</View>
    <Action accessibilityRole="button" accessibilityLabel="Schedule options" accessibilityState={{ expanded: scheduleOpen, disabled: locked }}
      disabled={locked} onPress={() => setScheduleOpen(value => !value)} style={styles.chip}>
      <Text style={styles.chipText}>Schedule · {REPEAT_OPTIONS.find(option => option.value === repeat)?.label}{dueTime ? ` · ${formatTime(dueTime)}` : ""} {scheduleOpen ? "−" : "+"}</Text>
    </Action>
    {scheduleOpen && <>
    <Text style={styles.label}>Repeat</Text>
    <View style={styles.options}>{REPEAT_OPTIONS.map(option => <Action key={option.value} accessibilityRole="button"
      accessibilityLabel={`Repeat: ${option.label}`} accessibilityState={{ selected: repeat === option.value, disabled: locked }} disabled={locked}
      aria-pressed={tone === "parchment" ? repeat === option.value : undefined}
      onPress={() => selectRepeat(option.value)} style={[styles.chip, repeat === option.value && styles.selected]}>
      <Text style={[styles.chipText, repeat === option.value && styles.selectedText]}>{option.label}</Text>
    </Action>)}</View>
    {(repeat === "WEEKLY" || repeat === "CUSTOM") && <View style={styles.options}>{WEEKDAYS.map((day, index) => <Action key={day}
      accessibilityRole="checkbox" accessibilityLabel={DAY_NAMES[index]} accessibilityState={{ checked: days.includes(day), disabled: locked }} disabled={locked}
      aria-checked={tone === "parchment" ? days.includes(day) : undefined}
      onPress={() => setDays(current => repeat === "WEEKLY" ? [day] : current.includes(day) ? current.filter(value => value !== day) : [...current, day])}
      style={[styles.chip, days.includes(day) && styles.selected]}>
      <Text style={[styles.chipText, days.includes(day) && styles.selectedText]}>{DAY_NAMES[index].slice(0, 3)}</Text>
    </Action>)}</View>}
    <Text style={styles.label}>{repeat === "NONE" ? "Due date (optional)" : repeat === "MONTHLY" ? "Start date" : "Start date (optional)"}</Text>
    <ScheduleInput kind="date" {...inputAppearance} accessibilityLabel={repeat === "NONE" ? "Due date, optional" : "Start date"} placeholder={time?.date ? formatDate(time.date, { year: true }) : "Oct 20, 2026"}
      value={startDate} onChangeText={setStartDate} autoCapitalize="none" autoCorrect={false} editable={!locked} />
    <Text style={styles.hint}>{repeat === "MONTHLY" ? " Shorter months use their last day, then return to the original day." : repeat !== "NONE" ? " Leave blank to start today." : " Leave blank for an unscheduled task."}</Text>
    <Text style={styles.label}>Due time (optional)</Text>
    <ScheduleInput kind="time" {...inputAppearance} accessibilityLabel="Due time, optional" placeholder="9:00 AM" value={dueTime} onChangeText={setDueTime}
      autoCapitalize="none" autoCorrect={false} editable={!locked} />
    <Text style={styles.hint}>Times use {time?.timeZone ?? "your profile timezone"}. Complete anytime on a scheduled day.</Text>
    <Text style={styles.label}>Reminder</Text>
    <View style={styles.options}>{REMINDER_OPTIONS.map(option => <Action key={option.value} accessibilityRole="button"
      accessibilityLabel={`Reminder: ${option.label}`} accessibilityState={{ selected: reminder.choice === option.value, disabled: locked || reminder.loading || !!reminder.error }}
      aria-pressed={tone === "parchment" ? reminder.choice === option.value : undefined}
      disabled={locked || reminder.loading || !!reminder.error} onPress={() => reminder.setChoice(option.value)} style={[styles.chip, reminder.choice === option.value && styles.selected]}>
      <Text style={[styles.chipText, reminder.choice === option.value && styles.selectedText]}>{option.label}</Text>
    </Action>)}</View>
    {reminder.choice === "CUSTOM" && <><Text style={styles.label}>Reminder time</Text>
      <ScheduleInput kind="time" {...inputAppearance} accessibilityLabel="Reminder time" value={reminder.clock} onChangeText={reminder.setClock} placeholder="8:45 AM" editable={!locked} /></>}
    <Text style={styles.hint}>Offsets follow the due time and repeat schedule. Without a due time, choose an explicit time. Quiet hours suppress reminders; they are not delayed. Notifications also require enabled preferences and device permission.</Text>
    </>}
    {reminder.loading && <Text style={styles.hint}>Loading saved reminder…</Text>}
    {!!reminder.error && <><GameNotice title="Reminder unavailable" message={reminder.error} variant="error" />
      <Action accessibilityRole="button" onPress={reminder.retry} style={styles.chip}><Text style={styles.chipText}>Retry reminders</Text></Action></>}
    {!!reminder.notice && <GameNotice title="Reminder status" message={reminder.notice} variant="info" />}
    {task && <Text style={styles.hint}>Changing the schedule starts a new task streak. Past completions and your best streak stay saved.</Text>}
    {!!error && <GameNotice title="Task not saved" message={error} variant="error" />}
    <Action accessibilityRole="button" accessibilityState={{ disabled: locked, busy: saving }} disabled={locked} onPress={() => void save()}
      style={[styles.save, locked && styles.disabled, tone === "parchment" && buttonHitArea]}>
      {tone === "parchment" && <ButtonSurface disabled={locked} />}<Text style={[styles.saveText, tone === "parchment" && locked && parchmentStyles.disabledText]}>{saving ? "Saving…" : task ? "Save changes" : "Add task"}</Text></Action>
    {onCancel && <Action accessibilityRole="button" accessibilityLabel="Cancel task editing" disabled={locked} onPress={onCancel} style={styles.chip}>
      <Text style={styles.chipText}>Cancel</Text>
    </Action>}
  </View>;
}

const legacyStyles = StyleSheet.create({
  form: { gap: spacing.sm },
  heading: { color: colors.text, fontSize: 18, fontWeight: "700" },
  label: { color: colors.text, fontWeight: "700" },
  options: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: { minHeight: 44, minWidth: 44, justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  sizeChip: { minWidth: "30%", minHeight: 48, flexGrow: 1, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.sm },
  selected: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.mutedText, fontWeight: "700" },
  reward: { color: colors.accent, fontSize: 12 },
  selectedText: { color: colors.background },
  hint: { color: colors.mutedText, fontSize: 13, lineHeight: 19 },
  error: { color: colors.danger },
  save: { minHeight: 48, padding: spacing.sm, borderRadius: radius.md, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  saveText: { color: colors.background, fontSize: 16, fontWeight: "700" },
  disabled: { opacity: 0.6 },
});

const parchmentStyles = StyleSheet.create({
  ...legacyStyles,
  form: { gap: ui.spacing.sm },
  heading: { ...ui.type.section, color: ui.colors.text, fontFamily: Platform.select(ui.font.display), marginBottom: ui.spacing.sm },
  label: { ...ui.type.label, color: ui.colors.text, marginTop: ui.spacing.sm },
  options: { flexDirection: "row", flexWrap: "wrap", gap: ui.spacing.sm },
  chip: { minHeight: ui.size.target, minWidth: ui.size.target, justifyContent: "center", alignItems: "center", borderWidth: 1,
    borderColor: ui.colors.controlBorder, backgroundColor: ui.colors.surface, borderRadius: ui.radius.md,
    paddingHorizontal: ui.spacing.sm, paddingVertical: ui.spacing.sm },
  sizeChip: { minWidth: "30%", minHeight: ui.size.target, flexGrow: 1, alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: ui.colors.controlBorder, borderRadius: ui.radius.md, padding: ui.spacing.sm },
  selected: { backgroundColor: ui.colors.primary, borderColor: ui.colors.primary },
  chipText: { ...ui.type.label, color: ui.colors.secondaryText, textAlign: "center", flexShrink: 1 },
  reward: { ...ui.type.caption, color: ui.colors.secondaryText },
  selectedText: { color: ui.colors.onPrimary },
  hint: { ...ui.type.caption, color: ui.colors.secondaryText },
  error: { ...ui.type.body, color: ui.colors.danger },
  save: { minHeight: 52, padding: 12, borderRadius: ui.radius.md, backgroundColor: "transparent",
    alignItems: "center", justifyContent: "center", marginTop: ui.spacing.sm },
  saveText: { ...ui.type.label, color: ui.colors.onPrimary, textAlign: "center" },
  disabled: { opacity: 1, backgroundColor: ui.colors.disabled },
  disabledText: { color: ui.colors.text },
  input: { minHeight: ui.size.target, backgroundColor: ui.colors.elevated, color: ui.colors.text,
    borderWidth: 1, borderColor: ui.colors.controlBorder, borderRadius: ui.radius.md, padding: ui.spacing.md,
    ...ui.type.body, fontFamily: Platform.select(ui.font.body) },
});
