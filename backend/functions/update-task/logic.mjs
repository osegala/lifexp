export { PROTECTED_TASK_FIELDS as BLOCKED_FIELDS } from "../../layers/api-shared/nodejs/task-input.mjs";

export function isArchivedTask(item) {
    return item?.archived?.BOOL === true;
}
