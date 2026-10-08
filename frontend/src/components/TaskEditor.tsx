import { useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { apiError } from "../api/client";
import { colors, radius, spacing } from "../theme/theme";
import type { Task, TaskSize, TasksResponse } from "../types";
import { DAY_NAMES, TASK_SIZE_OPTIONS, WEEKDAYS, type TaskInput } from "../tasks/scheduling";
import LifeInput from "./LifeInput";
import { useTaskReminder } from "../notifications/useTaskReminder";
import { REMINDER_OPTIONS, reminderTiming } from "../notifications/model";

type RepeatChoice = Task["repeatType"] | "CUSTOM";
const REPEAT_OPTIONS: { value: RepeatChoice; label: string }[] = [
  { value: "NONE", label: "Never" }, { value: "DAILY", label: "Daily" },
  { value: "WEEKLY", label: "Weekly" }, { value: "MONTHLY", label: "Monthly" },
  { value: "CUSTOM", label: "Custom weekdays" },
];

export default function TaskEditor({ task, time, disabled, onSave, onCancel, onReminderNotice, suggestions, onBusyChange }: {
  task?: Task;
  time?: TasksResponse["time"];
  disabled: boolean;
  onSave: (input: TaskInput, savedTaskId?: string) => Promise<string | void>;
  onCancel?: () => void;
  onReminderNotice?: (message: string) => void;
  suggestions?: readonly string[];
  onBusyChange?: (busy: boolean) => void;
}) {
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
      || new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date)) return setError("Use a valid date in YYYY-MM-DD format.");
    if (clock && !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(clock)) return setError("Use a 24-hour time in HH:mm format.");
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
    <Text accessibilityRole="header" style={styles.heading}>{task ? "Edit task" : "Add a task"}</Text>
    {suggestions && <View style={styles.options}>{suggestions.map(suggestion => <Pressable key={suggestion}
      accessibilityRole="button" accessibilityLabel={`Use suggestion: ${suggestion}`} accessibilityState={{ disabled: locked }}
      disabled={locked} onPress={() => setTitle(suggestion)} style={styles.chip}>
      <Text style={styles.chipText}>{suggestion}</Text>
    </Pressable>)}</View>}
    <Text style={styles.label}>Task title</Text>
    <LifeInput accessibilityLabel="Task title" placeholder="What will you do?" maxLength={200} value={title} onChangeText={setTitle} editable={!locked} />
    <LifeInput accessibilityLabel="Description (optional)" placeholder="Description (optional)" maxLength={2000} value={description} onChangeText={setDescription} editable={!locked} />
    <Text style={styles.label}>Task size</Text>
    <View style={styles.options}>{TASK_SIZE_OPTIONS.map(option => <Pressable key={option.value} accessibilityRole="button"
      accessibilityLabel={`${option.label}, ${option.xp} XP`} accessibilityState={{ selected: taskSize === option.value, disabled: locked }}
      disabled={locked} onPress={() => setTaskSize(option.value)} style={[styles.sizeChip, taskSize === option.value && styles.selected]}>
      <Text style={[styles.chipText, taskSize === option.value && styles.selectedText]}>{option.label}</Text>
      <Text style={[styles.reward, taskSize === option.value && styles.selectedText]}>+{option.xp} XP</Text>
    </Pressable>)}</View>
    <Pressable accessibilityRole="button" accessibilityLabel="Schedule options" accessibilityState={{ expanded: scheduleOpen, disabled: locked }}
      disabled={locked} onPress={() => setScheduleOpen(value => !value)} style={styles.chip}>
      <Text style={styles.chipText}>Schedule · {REPEAT_OPTIONS.find(option => option.value === repeat)?.label}{dueTime ? ` · ${dueTime}` : ""} {scheduleOpen ? "−" : "+"}</Text>
    </Pressable>
    {scheduleOpen && <>
    <Text style={styles.label}>Repeat</Text>
    <View style={styles.options}>{REPEAT_OPTIONS.map(option => <Pressable key={option.value} accessibilityRole="button"
      accessibilityLabel={`Repeat: ${option.label}`} accessibilityState={{ selected: repeat === option.value, disabled: locked }} disabled={locked}
      onPress={() => selectRepeat(option.value)} style={[styles.chip, repeat === option.value && styles.selected]}>
      <Text style={[styles.chipText, repeat === option.value && styles.selectedText]}>{option.label}</Text>
    </Pressable>)}</View>
    {(repeat === "WEEKLY" || repeat === "CUSTOM") && <View style={styles.options}>{WEEKDAYS.map((day, index) => <Pressable key={day}
      accessibilityRole="checkbox" accessibilityLabel={DAY_NAMES[index]} accessibilityState={{ checked: days.includes(day), disabled: locked }} disabled={locked}
      onPress={() => setDays(current => repeat === "WEEKLY" ? [day] : current.includes(day) ? current.filter(value => value !== day) : [...current, day])}
      style={[styles.chip, days.includes(day) && styles.selected]}>
      <Text style={[styles.chipText, days.includes(day) && styles.selectedText]}>{DAY_NAMES[index].slice(0, 3)}</Text>
    </Pressable>)}</View>}
    <Text style={styles.label}>{repeat === "NONE" ? "Due date (optional)" : repeat === "MONTHLY" ? "Start date" : "Start date (optional)"}</Text>
    <LifeInput accessibilityLabel={repeat === "NONE" ? "Due date, YYYY-MM-DD, optional" : "Start date, YYYY-MM-DD"} placeholder={time?.date ?? "YYYY-MM-DD"}
      value={startDate} onChangeText={setStartDate} autoCapitalize="none" autoCorrect={false} maxLength={10} editable={!locked} />
    <Text style={styles.hint}>YYYY-MM-DD.{repeat === "MONTHLY" ? " Shorter months use their last day, then return to the original day." : repeat !== "NONE" ? " Leave blank to start today." : " Leave blank for an unscheduled task."}</Text>
    <Text style={styles.label}>Due time (optional) · HH:mm</Text>
    <LifeInput accessibilityLabel="Due time, 24-hour HH:mm, optional" placeholder="09:00" value={dueTime} onChangeText={setDueTime}
      autoCapitalize="none" autoCorrect={false} maxLength={5} editable={!locked} />
    <Text style={styles.hint}>Times use {time?.timeZone ?? "your profile timezone"}. Complete anytime on a scheduled day.</Text>
    <Text style={styles.label}>Reminder</Text>
    <View style={styles.options}>{REMINDER_OPTIONS.map(option => <Pressable key={option.value} accessibilityRole="button"
      accessibilityLabel={`Reminder: ${option.label}`} accessibilityState={{ selected: reminder.choice === option.value, disabled: locked || reminder.loading || !!reminder.error }}
      disabled={locked || reminder.loading || !!reminder.error} onPress={() => reminder.setChoice(option.value)} style={[styles.chip, reminder.choice === option.value && styles.selected]}>
      <Text style={[styles.chipText, reminder.choice === option.value && styles.selectedText]}>{option.label}</Text>
    </Pressable>)}</View>
    {reminder.choice === "CUSTOM" && <><Text style={styles.label}>Reminder time · HH:mm</Text>
      <LifeInput accessibilityLabel="Reminder time, 24-hour HH:mm" value={reminder.clock} onChangeText={reminder.setClock} placeholder="08:45" maxLength={5} editable={!locked} /></>}
    <Text style={styles.hint}>Offsets follow the due time and repeat schedule. Without a due time, choose an explicit time. Quiet hours suppress reminders; they are not delayed. Notifications also require enabled preferences and device permission.</Text>
    </>}
    {reminder.loading && <Text style={styles.hint}>Loading saved reminder…</Text>}
    {!!reminder.error && <><Text accessibilityRole="alert" style={styles.error}>{reminder.error}</Text>
      <Pressable accessibilityRole="button" onPress={reminder.retry} style={styles.chip}><Text style={styles.chipText}>Retry reminders</Text></Pressable></>}
    {!!reminder.notice && <Text accessibilityLiveRegion="polite" style={styles.hint}>{reminder.notice}</Text>}
    {task && <Text style={styles.hint}>Changing the schedule starts a new task streak. Past completions and your best streak stay saved.</Text>}
    {!!error && <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.error}>{error}</Text>}
    <Pressable accessibilityRole="button" accessibilityState={{ disabled: locked, busy: saving }} disabled={locked} onPress={() => void save()}
      style={[styles.save, locked && styles.disabled]}><Text style={styles.saveText}>{saving ? "Saving…" : task ? "Save changes" : "Add task"}</Text></Pressable>
    {onCancel && <Pressable accessibilityRole="button" accessibilityLabel="Cancel task editing" disabled={locked} onPress={onCancel} style={styles.chip}>
      <Text style={styles.chipText}>Cancel</Text>
    </Pressable>}
  </View>;
}

const styles = StyleSheet.create({
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
