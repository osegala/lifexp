# Notifications & Reminders — local implementation review

Reviewed 2026-10-06. No AWS calls, deployment, seeding, commit, push or live push delivery. Existing reward, recurrence, quest, activity-streak and avatar logic is unchanged.

## Existing infrastructure reused

- Authenticated `/preferences`, `/devices`, `/devices/{deviceId}`, `/reminders`, `/reminders/{reminderId}`, `/tasks/{taskId}` and `/me` contracts.
- Existing user partition: `PREFERENCES`, `REMINDER#<id>`, `DEVICE#<id>`, `PROFILE`, `TASK#<id>`, `STATS#DAY#<date>` and `NOTIFICATION_DELIVERY#…`.
- Existing sparse `NotificationDueIndex` (`GSI1PK=NOTIFICATION_DUE`, time-ordered `GSI1SK`), every-minute EventBridge worker, bounded batch (default 25), Expo provider and `PushDeliveryMode` parameter.
- Existing API/notification shared layers, profile IANA timezone, canonical `task-schedule.mjs` helpers and `activity-streak.mjs`.
- No new service/table/index/route/schedule. Local SAM changes add the API shared layer and daily target to the worker, transaction `ConditionCheckItem` permission, and reminder-query permission to task/profile updates. Both existing SAM environment configurations remain `DRY_RUN`.

## Exact behavior

| Type | Source of truth and eligibility |
| --- | --- |
| `TASK_DUE` | Active, non-archived owned task, enabled reminder, master/task preferences and enabled device. Canonical `scheduledOn`, `completedOn`, `scheduleFromItem`, `isRecurring` determine occurrence eligibility. Completed/deleted/inactive/archived tasks do not notify. Legacy `TASK` configurations remain readable. |
| `DAILY_SUMMARY` | Reuses `dailyReminderEnabled`/`dailyReminderTime`. Counts eligible, unfinished tasks due on the server's current profile-local date. Zero remaining tasks means no summary. |
| `DAILY_QUEST` | New `dailyQuestReminderEnabled` (default false), `dailyQuestReminderTime` (18:00). Uses current daily stats and the same configured daily target (3); skip if target reached or daily reward confirmed. No quest mutation. |
| `STREAK_AT_RISK` | New `streakReminderEnabled` (default false), `streakReminderTime` (20:00). Uses the canonical global Daily Activity Streak from server stats; notify only for an active streak not counted today. No streak mutation. |

No Weekly Quest notification was added. Existing sound preference is respected; other existing preferences are retained.

### Task timing and recurrence

- Editor choices: none, due time, 5/15/30/60 minutes before, or explicit local `HH:mm` time. Offset reminders require task `dueTime`; no implicit due time is invented.
- Recurring reminders follow the task's dates, including daily, custom weekly weekdays and monthly `min(original anchor day, month last day)`. The original monthly anchor survives a February clamp. There is no second recurrence calculator.
- Offset arithmetic subtracts elapsed minutes from the timezone-resolved due instant; a midnight offset can belong to tomorrow's task occurrence while delivering today.
- Undated, non-recurring explicit-time reminders use the next selected wall-clock time after configuration creation and have one `ONCE` occurrence. Dated one-offs use the task date. No backlog copies are created.
- Missing DST wall times are skipped. Repeated fall-back wall times use the first instant only. Device-local date/time is not authoritative.
- Task schedule/active-state or profile timezone edits wake existing configurations atomically. The worker recalculates from current records. Removing `dueTime` pauses an offset reminder until it is valid again. Configuration edits do not replay elapsed occurrences.
- Existing five-minute lateness window is retained. Older occurrences are skipped, not replayed; next valid occurrences are scheduled.

### Quiet hours — suppression, never delay

New `quietHoursEnabled=false`, `quietHoursStart=22:00`, `quietHoursEnd=07:00`. Start is inclusive, end exclusive. Overnight ranges use `time >= start OR time < end`; equal start/end is rejected.

An event is suppressed if either its scheduled instant **or the worker processing instant** is inside quiet hours in the profile timezone. A 06:59 event processed at 07:01 remains suppressed; a 21:59 event processed at 22:01 is also suppressed. It is never queued for the quiet-hours end. Future regular occurrences continue normally.

## Deduplication and failure semantics

Reservation key, scoped by `PK=USER#<sub>`:

```text
SK = NOTIFICATION_DELIVERY#<occurrence>#<sha256(identity)>
task identity = <reminderId>#<occurrence>
daily identity = <type>#<localDate>
recurring occurrence = task-local YYYY-MM-DD
one-off occurrence = ONCE
```

- Conditional transaction reserves the key before calling the provider, guarded by current profile timezone, configuration version/claim, task/preferences or daily-stat snapshot.
- Once reserved, the same reminder occurrence or daily type/date cannot send again, even after time edits, duplicate worker invocations, expired claims, lost reservation responses or ambiguous provider timeouts. Device tokens are deduplicated within the user's target list.
- Before the external boundary, re-read profile/preferences/configuration/device/task or daily stats to suppress logout, account deletion, opt-out, edits and completion changes. Missing/failing authoritative reads do not fabricate a delivery.
- Provider calls have a five-second timeout. Failures are isolated per configuration; processing continues for unrelated entries.
- This is **at-most-once attempt**, not guaranteed delivery. A crash after reservation or ambiguous response may lose a notification, including delivery to remaining devices. Automatic retry must not clear/delete reservations.
- History retains prepared message, scheduled/attempted timestamps, mode, local date, type, task/reminder IDs and sanitized status (`PREPARED`, `SENT`, `FAILED`, `SKIPPED`). No token is recorded or logged. `PREPARED` is not device-delivery confirmation.
- No completion/reward/progression state is written by the notification worker.

## Frontend and device flow

- Profile uses the existing visual components for master/task toggles, daily summary/quest/streak toggles and times, quiet hours and explicit device enable action. TaskEditor adds reminder choices inside its existing Schedule section.
- Permission is never prompted on launch/resume. Explicit enable or reminder creation explains the feature, requests OS permission and then registers through existing `/devices` after grant. Denial is remembered and not repeatedly prompted; returning from system settings can detect a later grant.
- Stable SecureStore device ID is reused for registration/token rotation. Tokens are neither logged nor stored in UI/local preferences. Resume/token-change refresh is opt-in only. Web shows a native-only notice and can still save server preferences/reminders.
- Saving reminders after task creation uses a deterministic request ID. If the reminder save fails after the task saved, retry patches that task ID instead of creating another task. Failed drafts stay visible. Permission status remains visible after an edit closes.
- Logout waits for pending registration, disables the current server device, then clears local opt-in and signs out. Failure to disable requires reconnect/retry rather than silently leaving an active device. Account deletion disables this device before the existing deletion flow; existing backend deletion removes every user record. Missing profiles block subsequent worker attempts. Notifications already handed to a provider cannot be recalled.

## Local review and validation

Real Profile and Tasks components were rendered in a localhost-only mock harness, with no remote API/OS permission calls. Reviewed 320px, 390px and 1024px layouts: no horizontal overflow, readable labels/help, wrapping controls and working Save actions. Created a daily task with a 15-minute reminder; edited/reopened explicit 08:30; removed the reminder; archived the task. Reviewed all daily/quiet controls, permission-denied messaging, master-off state and disabled device-enable action.

| Local scenario | Evidence/result |
| --- | --- |
| Due time and 15-minute offset | Real planner tests cover all supported offsets and cross-midnight timing; editor create/save reviewed. PASS |
| Daily / Mon-Wed-Fri / monthly | Canonical schedule tests, February/leap-year clamp and March anchor recovery. PASS |
| Daily summary | Correct remaining-task count; zero-task suppression. PASS |
| Daily quest | Incomplete progress message; completed/rewarded suppression. PASS |
| Streak at risk / already counted | Server daily activity buckets; no device date dependency. PASS |
| Quiet hours | Same-day/overnight boundaries and late worker crossing quiet-hours start/end. PASS |
| Denied permission / web | Native module mocks, first denial memory, no launch/repeat prompts; real UI messaging. PASS |
| Notifications/devices disabled | Real worker against in-memory SDK boundary; zero provider attempts. PASS |
| Duplicate worker / ambiguous timeout | Real handler reserves once; lost DB/provider response never causes resend. PASS |
| Edit/remove reminder | Real hook/component tests and local UI save/reopen/remove. PASS |
| Archive/delete/completed task | Canonical eligibility and actual worker tests; last-boundary changes suppressed. PASS |
| Logout / deleted account / token rotation | Mock registration-disable sequence and worker missing-profile/device checks. Existing account-deletion suite passes. PASS |

Final checks:

- Backend `node --test`: **227 passed, 0 failed**.
- Frontend `node --test`: **148 passed, 0 failed**.
- `npx tsc --noEmit`: PASS.
- `npm run lint`: PASS, no lint warnings.
- `npm run validate:avatar-assets`: PASS, **143** registered sprites.
- `npm run audit:assets`: PASS, **271** inventoried images.
- `git diff --check`: PASS.

Focused notification checks can be rerun with `node --test tests/notifications-feature.test.mjs` in backend and `node --test tests/notifications.test.mjs` in frontend. All dependencies are mocked at the boundary; these tests must not contact AWS or Expo.

## Caveats / DEV review gate

- **GO for controlled DEV review with DRY_RUN retained. Not a live-push sign-off.** No deployed endpoint, native OS prompt, native push receipt or real account deletion was exercised.
- `expo-notifications` dependency/config plugin is added; an appropriately provisioned native development binary will be needed for subsequent device review. No EAS/build/signing/deployment action was taken here.
- Existing worker batch default remains 25 per minute and five-minute delivery freshness; capacity should be reviewed before any future production rollout. Timezone/task re-indexing is bounded to 98 enabled reminder rows per atomic edit (DynamoDB transaction limit); larger accounts fail the edit instead of partially rescheduling.
- Already-delivered/accepted external notifications cannot be recalled. At-most-once safety deliberately trades guaranteed delivery for no automatic duplicates.
- Existing pre-feature history has timestamp/random-ID keys. It is retained, not migrated; the new permanent occurrence reservations govern attempts made by this version.
- Frontend tests emit existing Node module-type warnings. Dependency installation reported 35 audit findings (12 moderate, 22 high, 1 critical); no broad dependency-security upgrade was attempted in this targeted feature pass.

## Exact repository files changed

Backend:

```text
backend/README.md
backend/functions/notification-worker/index.mjs
backend/functions/notification-worker/logic.mjs
backend/functions/notification-worker/push-provider.mjs
backend/functions/preferences/update.mjs
backend/functions/reminders/create.mjs
backend/functions/reminders/get.mjs
backend/functions/reminders/logic.mjs
backend/functions/reminders/update.mjs
backend/functions/update-me/index.mjs
backend/functions/update-task/index.mjs
backend/layers/api-shared/nodejs/notification-wakeup.mjs (new)
backend/layers/notification-shared/nodejs/planning.mjs (new)
backend/layers/notification-shared/nodejs/preferences.mjs
backend/layers/notification-shared/nodejs/scheduling.mjs
backend/template.yaml
backend/tests/calendar-scheduling.test.mjs
backend/tests/infrastructure.test.mjs
backend/tests/notification-scheduling-worker.test.mjs
backend/tests/notifications-feature.test.mjs (new)
```

Frontend and report:

```text
frontend/README.md
frontend/app.json
frontend/app/(tabs)/profile.tsx
frontend/app/(tabs)/tasks.tsx
frontend/package.json
frontend/package-lock.json
frontend/src/api/routes.ts
frontend/src/components/LifeButton.tsx
frontend/src/components/NotificationSettings.tsx (new)
frontend/src/components/TaskEditor.tsx
frontend/src/context/AuthContext.tsx
frontend/src/notifications/device.ts (new)
frontend/src/notifications/model.ts (new)
frontend/src/notifications/useTaskReminder.ts (new)
frontend/tests/frontend-api-contract.test.mjs
frontend/tests/task-scheduling.test.mjs
frontend/tests/notifications.test.mjs (new)
NOTIFICATIONS_REMINDERS.md (new)
```

Temporary mock preview files remain outside the repository under `/private/tmp/evrenthia-calendar-preview.Ox6DQK/`; they are not runtime dependencies. No avatar PNG or avatar rendering file changed.
