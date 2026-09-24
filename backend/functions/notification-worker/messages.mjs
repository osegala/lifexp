export function notificationMessage(notificationType, taskTitle) {
    if (notificationType === "DAILY") {
        return {
            title: "Evrenthia",
            body: "Your daily adventure is waiting."
        };
    }
    const title = typeof taskTitle === "string" && taskTitle.trim()
        ? taskTitle.trim().replace(/\s+/g, " ").slice(0, 120)
        : "Task";
    return {
        title: "Evrenthia",
        body: `Reminder: ${title}`
    };
}
