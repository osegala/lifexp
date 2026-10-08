import { api } from "../api/client";
import { apiRoutes } from "../api/routes";
import type { TaskInput } from "./scheduling";

export async function saveTask(input: TaskInput, savedTaskId?: string, clientRequestId?: string) {
  const response = savedTaskId
    ? await api.patch<{ taskId: string }>(apiRoutes.task(savedTaskId), input, { timeout: 15_000 })
    : await api.post<{ taskId: string }>(apiRoutes.tasks, {
      ...input, active: true, ...(clientRequestId ? { clientRequestId } : {}),
    }, { timeout: 15_000 });
  return response.data.taskId;
}
