import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { notificationMessage } from "../functions/notification-worker/messages.mjs";

const copy = (type, index, taskTitle = "Review project notes") => notificationMessage({
    type, taskTitle, deliveryId: index.toString(16).padStart(8, "0").padEnd(64, "0")
});

test("all task templates keep the real task name prominent", () => {
    const expected = [
        ["Don't forget", "Review project notes"],
        ["Time for your next task", "Review project notes"],
        ["Your next quest", "Review project notes"],
        ["Coming up", "Review project notes"],
        ["Keep moving forward", "Review project notes is ready"]
    ];
    expected.forEach(([title, body], index) => {
        assert.deepEqual(copy("TASK_DUE", index), { title, body });
    });
});

test("missing, empty and non-string task names use a complete safe fallback for every template", () => {
    for (const taskTitle of [undefined, null, "", " \n\t ", "\u0000\u007f", 123, {}]) {
        for (let index = 0; index < 5; index++) {
            // Pass undefined directly rather than using the fixture's default title.
            const message = notificationMessage({ type: "TASK_DUE", taskTitle,
                deliveryId: index.toString(16).padStart(8, "0").padEnd(64, "0") });
            assert.equal(message.body, "Your task is ready");
            assert.doesNotMatch(message.body, /undefined|null|is ready is ready/);
        }
    }
});

test("task names normalize whitespace and controls while preserving literal text and Unicode", () => {
    const message = copy("TASK_DUE", 0, "  Read\n \t日本語\u0000and save $& / $' / $` / {taskName}  ");
    assert.equal(message.body, "Read 日本語 and save $& / $' / $` / {taskName}");
});

test("long task names stay bounded without splitting a Unicode code point", () => {
    for (let index = 0; index < 5; index++) {
        const message = copy("TASK_DUE", index, "🌱".repeat(200));
        assert.equal(message.body, `${"🌱".repeat(119)}…${index === 4 ? " is ready" : ""}`);
        assert.equal(message.body.isWellFormed(), true);
        assert.ok(Buffer.byteLength(JSON.stringify(message), "utf8") < 700);
    }
    assert.equal(copy("TASK_DUE", 0, "a".repeat(120)).body, "a".repeat(120));
});

test("all daily quest templates use approved copy", () => {
    [
        ["Your daily quests are waiting", "A little progress today goes a long way."],
        ["Ready for today's quests?", "Complete a few tasks and keep your momentum going."],
        ["Your journey continues", "Check today's tasks and make some progress."]
    ].forEach(([title, body], index) => {
        assert.deepEqual(copy("DAILY_QUEST", index), { title, body });
    });
});

test("all streak templates use approved copy", () => {
    [
        ["Keep your streak alive", "A quick task today keeps your momentum going."],
        ["Don't lose your momentum", "Complete a task before the day ends."]
    ].forEach(([title, body], index) => {
        assert.deepEqual(copy("STREAK_AT_RISK", index), { title, body });
    });
});

test("daily task-count summaries keep their existing title and body", () => {
    assert.deepEqual(notificationMessage({ type: "DAILY_SUMMARY", summaryBody: "2 tasks await you in Evrenthia." }), {
        title: "Evrenthia", body: "2 tasks await you in Evrenthia."
    });
});

test("variation reads a stable delivery ID and varies across existing daily occurrences", () => {
    for (const type of ["TASK_DUE", "DAILY_QUEST", "STREAK_AT_RISK"]) {
        const titles = new Set();
        for (let day = 1; day <= 31; day++) {
            const identity = `${type === "TASK_DUE" ? "read" : type}#2026-10-${String(day).padStart(2, "0")}`;
            const input = { type, taskTitle: "Read", deliveryId: createHash("sha256").update(identity).digest("hex") };
            const original = structuredClone(input);
            const message = notificationMessage(input);
            assert.deepEqual(notificationMessage(input), message);
            assert.equal(notificationMessage({ ...input, taskTitle: "Read a chapter" }).title, message.title);
            assert.deepEqual(input, original);
            titles.add(message.title);
        }
        assert.equal(titles.size, type === "TASK_DUE" ? 5 : type === "DAILY_QUEST" ? 3 : 2);
    }
});
