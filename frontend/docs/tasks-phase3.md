# Phase 3 — Tasks review

Reviewed on October 13, 2026. Phase 3 is GO for review.

## Existing behavior and scope

The Tasks route is `app/(tabs)/tasks.tsx`. It originally rendered a flat,
non-virtualized ScrollView with Today, Upcoming, and All views. There is no
category field or category grouping in the current task model. No mockup
categories or new views were introduced.

The route's create, edit, complete, and archive handler bodies are byte-for-byte
unchanged from HEAD. Completion still waits for the server, retains the same-tick
submission guard, updates from the confirmed response, and dispatches the existing
reward/building feedback. Failed completion does not mark a task complete or
dispatch success feedback. Archive still uses the existing DELETE route and Alert
error treatment. TaskEditor validation, save, reminder retry ID, and repeat-change
logic remain unchanged.

`src/tasks/scheduling.ts`, `src/tasks/saveTask.ts`, and
`src/notifications/useTaskReminder.ts` are byte-for-byte unchanged. Today and
Upcoming still use server availability/date and the canonical date/time/title
order. All still includes inactive/completed tasks and excludes archived tasks.

## Presentation

TasksContent uses the existing shared parchment/forest theme and components.
It preserves descriptions, size/XP/coin metadata, dates, wall times, next
occurrences, per-task streaks, inactive/completed states, and labeled Complete,
Edit, and Archive actions. There is one flat section for the selected view.

Add Task expands the existing inline editor. The creation editor stays mounted
while collapsed so its draft and saved-task reminder retry ID survive. TaskEditor
opts into parchment styling only on Tasks; its default remains legacy for
onboarding. All existing repeat, weekday, due/start date, time, reminder, and
validation controls remain available. Reminder data is still loaded/edited by the
existing editor hook, without adding list-wide reminder reads.

The ScrollView architecture is retained. Large task counts may warrant a measured
virtualization follow-up; this phase does not introduce a list rewrite.

## Visual and accessibility review

The isolated `tasks-preview.tsx` entry renders the actual TasksContent and
TaskEditor with explicit local fixtures, shared tabs, and a reminder adapter that
blocks external requests. It is not an app route and does not use an account,
backend rewards, or ad network.

- 320px: normal/long task titles, filters, editor, repeat/weekday/reminder choices,
  and date/time inputs fit without horizontal overflow. Visible targets are at
  least 44px. A 30px body/60px heading web stress probe wraps and scrolls.
- 390px: Today/Upcoming/All, completed and inactive rows, streak/reward metadata,
  descriptions, create/edit/save/cancel/archive, empty/loading/error/retry, failed
  save draft retention, and failed completion reviewed.
- 768px: centered content column and task actions remain readable.
- 1024px: centered content column and expanded edit form remain contained.
- Bottom spacing: the last action ends at 731px while the tab bar starts at
  785px in the 320px review; content can scroll fully above navigation.
- Keyboard activation works for task actions, save, cancel, filters, and retry.
  Form focus progresses title → description → size, with visible focus outlines.
- Complete/Edit/Archive names include the task title. Selected filters and
  size/repeat/reminder controls expose pressed state. During final review, missing
  web weekday checkbox state was corrected with opt-in `aria-checked` and covered
  by a regression assertion. Errors expose alert semantics. Completed/inactive
  rows use text badges and readable text rather than opacity alone.

Archive failure is covered through the real controller in automated tests;
native Alert presentation is unchanged. Native keyboard/insets, Dynamic Type,
TalkBack/VoiceOver, and signed-in device review remain device-review follow-ups.
The web large-text check is not a native Dynamic Type test.

## Final validation

- `npm test`: 241 passed, 0 failed, 0 skipped.
- `npx tsc --noEmit`: passed.
- `npm run lint`: passed, no lint warnings.
- `git diff --check`: passed.

Existing Node module-type warnings remain. No dependencies/configuration,
backend, native, monetization, auth, avatar internals, or other screen redesigns
were changed in Phase 3. Earlier Phase 1/Home working-tree changes were retained.
No commit, push, deployment, or native build was performed.

## Phase 3 files

- `app/(tabs)/tasks.tsx`
- `src/components/TasksContent.tsx`
- `src/components/TaskEditor.tsx`
- `src/dev/TasksPreview.tsx`
- `tasks-preview.tsx`
- `tests/task-scheduling.test.mjs`
- `tests/completion-feedback.test.mjs` (Tasks presentation seam/icon assertions)
- `tests/notifications.test.mjs` (editor presentation imports)
- `docs/tasks-phase3.md`

Phase 4 recommendation: Shop, retaining existing catalog, purchase/entitlement
rules, reward flow, ad placement, and virtualization while applying the shared
visual system.
