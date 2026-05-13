export type TaskCategory =
  | "School"
  | "Fitness"
  | "Cleaning"
  | "Work"
  | "Health"
  | "Personal Growth";

export const TASK_CATEGORIES: Record<TaskCategory, number> = {
  School: 50,
  Fitness: 40,
  Cleaning: 25,
  Work: 60,
  Health: 35,
  "Personal Growth": 45,
};

export const PREMADE_TASKS = [
  { title: "Study for 30 minutes", category: "School" },
  { title: "Complete homework", category: "School" },
  { title: "Workout", category: "Fitness" },
  { title: "Go for a walk", category: "Fitness" },
  { title: "Clean your room", category: "Cleaning" },
  { title: "Do laundry", category: "Cleaning" },
  { title: "Finish work task", category: "Work" },
  { title: "Drink water", category: "Health" },
  { title: "Read 10 pages", category: "Personal Growth" },
] as const;

export function guessCategory(title: string): TaskCategory {
  const lower = title.toLowerCase();

  if (
    lower.includes("homework") ||
    lower.includes("study") ||
    lower.includes("exam") ||
    lower.includes("class") ||
    lower.includes("project")
  ) {
    return "School";
  }

  if (
    lower.includes("gym") ||
    lower.includes("run") ||
    lower.includes("walk") ||
    lower.includes("workout") ||
    lower.includes("exercise")
  ) {
    return "Fitness";
  }

  if (
    lower.includes("clean") ||
    lower.includes("laundry") ||
    lower.includes("dishes") ||
    lower.includes("trash")
  ) {
    return "Cleaning";
  }

  if (
    lower.includes("meeting") ||
    lower.includes("email") ||
    lower.includes("job") ||
    lower.includes("work")
  ) {
    return "Work";
  }

  if (
    lower.includes("water") ||
    lower.includes("sleep") ||
    lower.includes("doctor") ||
    lower.includes("medicine")
  ) {
    return "Health";
  }

  return "Personal Growth";
}

export function getXPForCategory(category: TaskCategory): number {
  return TASK_CATEGORIES[category];
}