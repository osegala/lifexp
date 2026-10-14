# Home redesign: Phase 2 review

## Scope and audit

The existing Home route is `app/(tabs)/dashboard.tsx`. Before this phase it showed
profile XP/level, Daily and Weekly Quests, the activity streak, World Points,
three achievement previews (including cosmetic rewards), Profile navigation and
one final HOME banner. It did not contain an avatar or a task preview.

All of those existing features remain. The only added reads serve the requested
avatar and read-only Today preview. Tasks, Base, Avatar, Shop, auth, reward logic,
native code, renderer internals and monetization were not redesigned or changed.
The uncommitted Phase 1 foundation remains separate from this phase.

## Authoritative sources

- Profile/Coins: existing AuthContext user and `refreshUser()`. XP uses the
  server's level, xpIntoLevel, xpForNextLevel and progressPercent, not a new formula.
- World Points/quests/streak: existing GET /goals. Focus, foreground, bounded
  60-second/server-midnight refresh, and last-confirmed-state retention remain.
- Achievements: existing GET /achievements and original first-three ordering.
- Avatar: GET /inventory plus the same `loadPreferredAppearance`,
  `avatarFromInventory`, account-local appearance fallback/cache and
  `catalogCosmeticReference` helpers used by the existing avatar system.
  Inventory equipment slots select the owned asset references; Home never loads
  Shop's catalog, saves equipment, or chooses a separate background.
- Background: `getEquippedSceneSource(..., equippedBackgroundId, "BACKGROUND")`,
  the same resolver used by Avatar. A cover image preserves aspect ratio (with
  cropping, not stretching), behind exactly one unchanged AvatarRenderer.
  A missing/failed background falls back to the neutral stage, retaining the
  character. Focus/foreground refresh picks up newly equipped scenes.
- Today: GET /tasks and `tasksForView(tasks, "Today", serverDate)`; active,
  non-archived, server-eligible tasks, ordered by dueTime then title. The first
  three are shown. Completed recurring occurrences leave Today exactly as they
  do on Tasks; the server's completed count remains visible. Every preview row
  and View all tasks navigates to Tasks. Home does not complete tasks or grant
  rewards.
- Ads: the exact `BannerAdPlacement placement="HOME"` instance stays last,
  below secondary content. Existing provider, consent, Premium, loading and
  feedback suppression remain untouched. The preview uses an inert position
  marker, never an ad request.

## Validation and cleanup

Eight new Home tests cover equipment/background mapping and changes, one avatar,
stable props on refresh, failed/missing scene fallback, canonical task ordering,
navigation-only actions, actual balances/XP/rewards, loading/empty/error states,
retry, stale snapshots and ignored late responses after blur.

Existing quest-refresh, backend-value and ad-placement tests were adapted to
the extracted HomeContent presentation component; none were removed.

Validation found and corrected an unnecessary retry-hook dependency with a
focus-scoped refresh callback, and quest bars now announce Daily/Weekly Quest
progress instead of incorrectly calling it Experience progress.

- `npm test`: 235 passed, 0 failed, 0 skipped.
- `npx tsc --noEmit`: passed.
- `npm run lint`: passed without warnings.
- `git diff --check`: passed.
- Existing Node module-type warnings remain; dependencies/config were not changed.

## Local visual review

`home-preview.tsx` is a DEV-only standalone entry, not an application route or
auth bypass. `src/dev/HomePreview.tsx` renders the actual HomeContent and stock
tab navigator with clearly labeled fixtures and no API/auth/ad network calls.
The package entry remains expo-router/entry. It can be served by the same local
Metro preview approach as Phase 1 using the home-preview bundle entry.

Reviewed at 320, 390, 768 and 1024px: headers/resources stay contained, avatar
remains singular and bounded, task text wraps, quest cards stack or form two
columns, achievements remain readable, and the final banner position scrolls
fully above the tab bar. Long names, ten-digit balances and long task titles
were checked at 320px. A web-only stress probe uses 32px text and a 60px title:
content wraps and stays scrollable, with no horizontal overflow.

Keyboard Profile/task/retry activation, 48pt-or-larger action targets, visible
2px focus rings, accessible resource/task labels, progress labels and the
foundation contrast tests were checked. Loading, empty, error, changed-scene
and missing-scene states were reviewed.

The temporary preview asset proxy crashed during review, was repaired outside
the repository, and the image checks were rerun successfully.

GO for Phase 2 review. This was an isolated web review, not signed-in/native
Android or iOS testing. Device safe areas, native text scaling/screen readers,
and the separate Android avatar rendering investigation still require device
review; this phase makes no claim to fix that renderer. No native rebuild is
required by these JS/style changes.

Phase 3 should migrate Tasks visually using these same primitives while retaining
its scheduling helpers, editor validation, completion transaction and feedback.
