# Phase 6 — Base polish review

Reviewed October 13–14, 2026. GO for UI review; native device checks remain.

## Audit before editing

- Route: `app/(tabs)/base.tsx`, initially 1,855 lines with an inline MapViewport,
  building nodes, gestures, layouts, paths, decorations and action tray.
- The renderer uses the existing tiled ground, path/decorative assets and tier
  artwork. Camera uses clamped pan/pinch gestures and web pointer/wheel handlers.
  Buildings have separate drag/tap gestures, grid snapping, collision/buildable
  checks, depth ordering and local layout persistence (web storage/SecureStore).
- GET `/world` supplies buildings, stored levels/visual tiers, upgrade costs,
  eligibility and World Points. No Coins/XP display or data source exists here.
- Selecting a building toggles its action tray; map background tap dismisses it.
  The tray initially lived in scaled world coordinates, so its controls shrank
  with the camera. Info toggles an inline description, not a modal. Enter looks
  unavailable but intentionally remains callable to explain missing interiors.
  Unavailable/maxed Upgrade also explains status instead of sending a request.
- Manual upgrade uses the existing same-tick ref guard, POST upgrade route with
  `{}`, confirmed-upgrade queue, authoritative world reload and selected-building
  refresh. Task-triggered upgrade batches share the existing feedback queue.
- Celebration appears only while focused, not loading, and after corresponding
  confirmed tiers are present. Existing animation/reduced-motion behavior,
  announcement, 2.8-second dismissal and queue consumption remain.
- Initial loading uses a spinner. Load/upgrade errors originally used Alert only;
  a failed read already retained confirmed state. No help/tutorial, zoom/reset/
  center buttons, separate sheets, confirmation dialog or other controls existed.
- The branch renders the paths/decorations/buildings eagerly. There is no terrain
  windowing in this Base implementation. No performance architecture was added.

All functionality absent from the mockup remains, including drag placement/local
layout persistence, collision checks, unavailable-interior explanations, Info,
manual upgrades and queued task-driven celebrations.

## UI-only implementation

`BasePanels.tsx` contains display-only resource and building panels using the
existing shared theme, SurfaceCard, ResourcePill, UiPressable and UiText.

The compact warm resource overlay shows Base and real World Points only. It is
absolute-positioned with non-interactive backing, so it does not resize the map
viewport or capture map taps. Unknown data is an em dash, not an invented zero.
Loading/error states use warm surfaces; the existing loader supplies retry.

Only the old information/action tray moved out of the scaled world into a
screen-space panel. Building/world coordinates did not move. The panel sits
16px above the existing tab-owned boundary, caps at 480px width/56% height, keeps
actions reachable, and scrolls details when necessary. It shows the same name,
level/tier, description, cost and status, with forest primary actions and muted
unavailable actions. Close invokes the existing clear-selection function; Info
uses the same toggle. No modal or new confirmation step was introduced.

Upgrade and Enter remain callable in unavailable states to preserve their
existing explanatory Alert behavior. No new eligibility/purchase/progression
logic was added. Inline upgrade/load errors supplement, not replace, those
Alerts. The business branch, ref guard, POST payload, enqueue and refresh order
remain unchanged; only presentation-error state setters were added.

Building hitboxes retain their exact shape, dimensions, position and gesture
implementation. They now expose names, level/tier, selected state, accessibility
activation and keyboard focus. Web Enter/Space activation reuses the gesture
library's existing keyboard support, avoiding a second activation handler.

Visual review found the old bottom celebration covered the new building actions.
BuildingUpgradeFeedback now accepts optional parchment styling/overlay style;
Base opts into top placement below the resource overlay. Its default legacy
presentation remains available. All timing, artwork, confirmation and callback
code is unchanged. No new animation or particle system was introduced.

## Invariants and tests

Eight new regressions cover:

- Exact pre-phase fingerprints for world/map renderer helpers, all world and
  building constants/coordinates, layout storage, collision/placement functions.
- Exact pre-phase camera, pan/pinch/web handlers, building drag/tap implementation,
  depth sort, path and decoration generation.
- Same tiled world and tier artwork; no mockup replacement, image/cache change,
  asset resizing or new renderer/windowing architecture.
- Authoritative World Points including zero/unknown/large balances and retry.
- Upgrade/Enter/Info/close callbacks, requirements and selected/action labels.
- Same-tick upgrade guard, exact POST `{}`, world refresh and confirmed feedback.
- Unavailable/maxed actions, failed upgrades, initial/refresh failures and recovery.

The existing celebration tests still prove stored-tier artwork, reduced motion,
announcements, 2.8-second timing and cancellation on blur. Their import fixture
received one UiPressable mock; behavioral coverage was not removed.

Final validation:

- `npm test`: 265 passed, 0 failed, 0 skipped.
- `npx tsc --noEmit`: passed.
- `npm run lint`: passed, no lint warnings.
- `git diff --check`: passed.

## Local responsive/accessibility review

The standalone DEV-only `base-preview.tsx` entry renders the actual Base route,
world, gestures, shared tabs and feedback provider. Its own minimal Expo Router
context is required by the route's existing focus hook. A fixture transport
replaces GET/POST only in that standalone bundle and rejects unexpected requests;
there is no account/API/AWS/ad/billing traffic. It does not enter normal routing.

Reviewed 320, 390, 768, 1024 and 1440px. No document-width overflow. A ten-digit
World Points value fits at 320px. The longest building name wraps; expanded
details scroll within the panel and actions remain above tabs. Resources have
opaque backing over terrain. The world stays dominant with the panel closed,
and its viewport dimensions/camera calculation remain the original ones.

Reviewed loading, first-load failure and successful retry, insufficient points,
maximum tiers, Info/close, upgrade failure, confirmed tier/balance refresh and
celebration placement. Pointer selection and keyboard Enter selection work;
web pan and wheel zoom remain operational. Local regression tests additionally
verify stale-world retention on refresh failure and duplicate-submit safety.

Panel/retry/close targets measure at least 48px. Headings, resource labels,
building selected state, Info expanded state, unavailable labels, inline error
alerts and visible keyboard focus are present. Shared contrast tests pass.
The original zoom-dependent building hitboxes were not enlarged; at extreme
zoom their physical targets can be smaller than 44px. Changing map hitboxes is
outside this UI-only phase. No new modal focus trap is needed for the nonmodal
panel. Native TalkBack/VoiceOver, large text and safe-area checks remain manual.

No new runtime errors after correcting the preview-only Router setup. Existing
web shadow deprecation and Node typeless-package warnings remain untouched.

## Exact Phase 6 files

Modified:

- `app/(tabs)/base.tsx`
- `src/components/BuildingUpgradeFeedback.tsx` (opt-in presentation only)
- `tests/completion-feedback.test.mjs` (one import mock)

Created:

- `src/components/BasePanels.tsx`
- `src/dev/BasePreview.tsx`
- `base-preview.tsx`
- `tests/base-polish.test.mjs`
- `docs/base-phase6.md`

Prior Phase 1–5 working-tree changes were preserved. No Home, Tasks, Shop, Avatar,
backend, auth, ads, billing, native/config/dependency, registry or artwork changes
were made in Phase 6. No commit, push, deployment, AWS access or build occurred.

## Remaining issues and next recommendation

Android's known slow Base asset loading is unchanged and was not benchmarked or
optimized here. Native pinch/drag/collision, native safe areas/screen readers and
signed-in server behavior still need device review. Web fixtures/mock tests do
not prove native performance or live API persistence. No native rebuild is
required for these UI-only changes.

Recommend a final cross-app consistency pass across typography, spacing,
resource labels, selected/disabled/error treatments, focus/touch targets, safe
areas and tabs on all five screens. Keep gameplay, rendering and Android
performance investigations separate; do not turn that pass into a redesign.
