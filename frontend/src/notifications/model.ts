export type NotificationPreferences = {
  notificationsEnabled: boolean;
  taskRemindersEnabled: boolean;
  dailyReminderEnabled: boolean;
  dailyReminderTime: string | null;
  dailyQuestReminderEnabled: boolean;
  dailyQuestReminderTime: string;
  streakReminderEnabled: boolean;
  streakReminderTime: string;
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
};
export type TaskReminder = {
  reminderId: string;
  taskId: string;
  enabled: boolean;
  localTime: string | null;
  offsetMinutes: number | null;
  effectiveNotificationsEnabled?: boolean;
};
export type ReminderChoice = "NONE" | "CUSTOM" | "0" | "5" | "15" | "30" | "60";
export const REMINDER_OPTIONS: { value: ReminderChoice; label: string }[] = [
  { value: "NONE", label: "No reminder" }, { value: "0", label: "At due time" },
  { value: "5", label: "5 min before" }, { value: "15", label: "15 min before" },
  { value: "30", label: "30 min before" }, { value: "60", label: "1 hour before" },
  { value: "CUSTOM", label: "Explicit time" },
];
export const validClock = (value: string) => /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
export function reminderTiming(choice: ReminderChoice, clock: string, dueTime: string) {
  if (choice === "NONE") return { enabled: false, localTime: null, offsetMinutes: null };
  if (choice === "CUSTOM") {
    if (!validClock(clock)) throw new Error("Enter a reminder time in 24-hour HH:mm format.");
    return { enabled: true, localTime: clock, offsetMinutes: null };
  }
  if (!validClock(dueTime)) throw new Error("Set a due time or choose an explicit reminder time.");
  return { enabled: true, localTime: null, offsetMinutes: Number(choice) };
}
