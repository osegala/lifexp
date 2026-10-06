import type { Task, TaskSize } from "../types";

export const WEEKDAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
export const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
export const TASK_SIZE_OPTIONS: { value: TaskSize; label: string; xp: number }[] = [
  { value: "QUICK", label: "Quick", xp: 10 },
  { value: "SMALL", label: "Small", xp: 20 },
  { value: "NORMAL", label: "Normal", xp: 35 },
  { value: "CHALLENGING", label: "Challenging", xp: 50 },
  { value: "BIG", label: "Big", xp: 75 },
];
export type TaskView = "Today" | "Upcoming" | "All";
export type TaskInput = Pick<Task, "title" | "description" | "taskSize" | "repeatType" | "repeatDays" | "startDate" | "dueTime">;

export function recurrenceLabel(task: Pick<Task, "repeatType" | "repeatDays" | "startDate">) {
  if (task.repeatType === "NONE") return "Does not repeat";
  if (task.repeatType === "DAILY") return "Daily";
  if (task.repeatType === "MONTHLY") return `Monthly · day ${Number(task.startDate?.slice(8))}`;
  const days = WEEKDAYS.filter(day => task.repeatDays.includes(day));
  return days.length === 1 ? `Every ${DAY_NAMES[WEEKDAYS.indexOf(days[0])]}`
    : days.map(day => day[0] + day.slice(1).toLowerCase()).join(", ");
}

export function tasksForView(tasks: Task[], view: TaskView, serverDate: string) {
  return tasks.filter(task => !task.archived && (view === "All"
    || (view === "Today" ? task.active && task.isDueToday
      : task.active && !!task.nextScheduledDate && task.nextScheduledDate > serverDate)))
    .sort((a, b) => (view === "Upcoming" ? (a.nextScheduledDate ?? "").localeCompare(b.nextScheduledDate ?? "") : 0)
      || (a.dueTime ?? "24:00").localeCompare(b.dueTime ?? "24:00")
      || a.title.localeCompare(b.title));
}
