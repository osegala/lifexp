const TEMPLATES = {
    TASK_DUE: [
        ["Don't forget", "{taskName}"],
        ["Time for your next task", "{taskName}"],
        ["Your next quest", "{taskName}"],
        ["Coming up", "{taskName}"],
        ["Keep moving forward", "{taskName} is ready"]
    ],
    DAILY_QUEST: [
        ["Your daily quests are waiting", "A little progress today goes a long way."],
        ["Ready for today's quests?", "Complete a few tasks and keep your momentum going."],
        ["Your journey continues", "Check today's tasks and make some progress."]
    ],
    STREAK_AT_RISK: [
        ["Keep your streak alive", "A quick task today keeps your momentum going."],
        ["Don't lose your momentum", "Complete a task before the day ends."]
    ]
};

export function notificationMessage({ type, taskTitle, deliveryId, summaryBody }) {
    if (type === "DAILY_SUMMARY") return { title: "Evrenthia", body: summaryBody };

    const templates = TEMPLATES[type] ?? TEMPLATES.TASK_DUE;
    // Read the existing SHA-256 delivery ID; copy never creates or changes it.
    // The same occurrence keeps its copy across retries, devices and title edits.
    const [title, body] = templates[Number.parseInt(deliveryId.slice(0, 8), 16) % templates.length];
    if (type === "DAILY_QUEST" || type === "STREAK_AT_RISK") return { title, body };

    const name = typeof taskTitle === "string"
        ? taskTitle.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim()
        : "";
    const characters = Array.from(name);
    const taskName = characters.length > 120 ? `${characters.slice(0, 119).join("")}…` : name;
    return { title, body: taskName ? body.replace("{taskName}", () => taskName) : "Your task is ready" };
}
