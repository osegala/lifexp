import { useEffect, useRef, useState } from "react";
import { api } from "../api/client";
import { apiRoutes } from "../api/routes";
import { enableDeviceNotifications, permissionMessage } from "./device";
import { reminderTiming, type ReminderChoice, type TaskReminder } from "./model";

export function useTaskReminder(taskId?: string) {
  const [choice, setChoice] = useState<ReminderChoice>("NONE");
  const [clock, setClock] = useState("");
  const [loading, setLoading] = useState(!!taskId);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reload, setReload] = useState(0);
  const records = useRef<TaskReminder[]>([]);
  useEffect(() => {
    if (!taskId) return;
    let active = true;
    setLoading(true);
    api.get<{ reminders: TaskReminder[] }>(apiRoutes.reminders).then(response => {
      if (!active) return;
      records.current = response.data.reminders.filter(item => item.taskId === taskId);
      const reminder = records.current.find(item => item.enabled) ?? records.current[0];
      setChoice(!reminder?.enabled ? "NONE" : reminder.offsetMinutes != null ? String(reminder.offsetMinutes) as ReminderChoice : "CUSTOM");
      setClock(reminder?.localTime ?? "");
      setError("");
    }).catch(() => { if (active) setError("Could not load reminders. Retry before changing this task."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [taskId, reload]);

  async function save(id: string, dueTime: string) {
    if (error || loading) throw new Error("Load the saved reminder before editing it.");
    const timing = reminderTiming(choice, clock, dueTime);
    let message = "";
    if (timing.enabled) {
      const state = await enableDeviceNotifications();
      message = permissionMessage[state];
      setNotice(message);
    }
    let current = records.current.find(item => item.enabled) ?? records.current[0];
    if (!current && timing.enabled) {
      const response = await api.post<{ reminder: TaskReminder }>(apiRoutes.reminders,
        { type: "TASK_DUE", taskId: id, clientRequestId: `task-reminder-${id}`, ...timing });
      current = response.data.reminder;
      records.current = [current]; // Retain the ID if a later request fails.
    }
    if (current) {
      if (timing.enabled) await api.patch(apiRoutes.reminder(current.reminderId), timing);
      else await api.delete(apiRoutes.reminder(current.reminderId));
      // Collapse any old multiple-reminder records to the editor's single choice.
      for (const extra of records.current.filter(item => item.reminderId !== current.reminderId && item.enabled)) await api.delete(apiRoutes.reminder(extra.reminderId));
    }
    return message;
  }
  return { choice, setChoice, clock, setClock, loading, error, notice, save,
    retry: () => setReload(value => value + 1),
    reset: () => { setChoice("NONE"); setClock(""); records.current = []; } };
}
