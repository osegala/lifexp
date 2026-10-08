import type { TaskInput } from "../tasks/scheduling";

export const STEPS = ["Welcome", "Avatar", "Starter tasks", "Reminders", "How progress works", "You’re ready"] as const;
export const STARTER_SUGGESTIONS = ["Make my bed", "Exercise", "Drink water", "Study / work session", "Clean up", "Read", "Plan tomorrow"] as const;
export type SetupProgress = {
  step: number;
  taskIds: string[];
  pendingTask?: { requestId: string; input: TaskInput };
};
export const emptyProgress = (): SetupProgress => ({ step: 0, taskIds: [] });
export const progressKey = (userId: string | number) => `evrenthia.onboarding.${encodeURIComponent(String(userId))}.v1`;

export function readProgress(raw: string | null): SetupProgress {
  if (!raw) return emptyProgress();
  const value = JSON.parse(raw) as SetupProgress;
  if (!Number.isInteger(value.step) || value.step < 0 || value.step >= STEPS.length
    || !Array.isArray(value.taskIds) || value.taskIds.some(id => typeof id !== "string")
    || (value.pendingTask && (typeof value.pendingTask.requestId !== "string" || !value.pendingTask.input?.title))) {
    throw new Error("Saved setup progress could not be read. Retry before adding tasks.");
  }
  return value;
}

/** Persist the retry key BEFORE sending. A lost response reuses the same server task. */
export async function saveStarterTask(
  progress: SetupProgress,
  input: TaskInput,
  savedTaskId: string | undefined,
  save: (input: TaskInput, savedTaskId?: string, requestId?: string) => Promise<string>,
  persist: (progress: SetupProgress) => Promise<void>,
  requestId: () => string,
) {
  if (savedTaskId) return save(input, savedTaskId);
  const pending = progress.pendingTask ?? { requestId: requestId(), input };
  await persist({ ...progress, pendingTask: pending });
  const id = await save(pending.input, undefined, pending.requestId);
  // A retry may include subsequent user edits; never reuse a create key for another payload.
  if (JSON.stringify(input) !== JSON.stringify(pending.input)) await save(input, id);
  await persist({ step: progress.step, taskIds: [...new Set([...progress.taskIds, id])] });
  return id;
}

export async function finishOnboarding(
  patch: () => Promise<{ onboardingCompleted: boolean }>,
  refresh: () => Promise<boolean>,
) {
  const result = await patch();
  if (result.onboardingCompleted !== true) throw new Error("Setup completion was not confirmed. Please retry.");
  if (!await refresh()) throw new Error("Setup was saved, but your profile could not refresh. Please retry.");
  // Navigation follows the freshly loaded server profile, not local step state.
}
