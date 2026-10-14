# Final cross-app UI consistency review

Reviewed October 14, 2026 on `ui/evrenthia-redesign`.

**GO for UI branch review and commit preparation.** Native device acceptance
and the separate Android rendering/performance investigation remain outstanding.
No commit, push, deployment, native build or AWS access was performed.

## Scope and audit

Continued the existing Phase 1–6 working tree. Reviewed Home, Tasks, Base,
Avatar and Shop against the shared `uiTheme` and presentation components.
No screen was reimplemented and no business handler was changed in this pass.

Typography already shares 30/38 display, 21/28 section, 16/24 body, 15/22 action
labels and 13/19 captions. Metadata and helper text use the shared secondary
text token. System serif/sans fonts are unchanged. Resource values use the
same label style and tabular numerals. ResourcePill already supplies consistent
icons, semantic labels, exact caller-provided values and gold/green treatments;
there is no separate balance calculation or new number formatter.

Tasks, Shop and Avatar already use the same 48-point FilterChip, selected
forest treatment, control border and focus ring. Category order and filtering
were preserved. Cards retain shared surfaces, borders and radii, with intentional
density differences. Error text and announcements, contextual recovery actions,
loading labels and selected/locked badges were audited without replacing their
existing recovery behavior.

## Changes made in this final pass

- Avatar bottom padding changed from 120 to the shared 32-point inset. Its
  horizontal bounds, character preview bounds and wardrobe sizing are unchanged.
- Avatar and Shop title/subtitle spacing now uses the shared 4-point gap.
- Home Profile uses the shared interactive control-border color.
- Task Edit/Archive labels use the 15-point action hierarchy. Archive uses the
  danger color with its existing text/icon; busy actions use neutral disabled
  surfaces and readable text. All completion/edit/archive callbacks are unchanged.
- Appearance Discard uses the existing danger button variant. Its existing
  confirmation flow and callbacks are unchanged.
- Parchment task-save controls use neutral disabled surfaces and readable labels
  instead of the inherited opacity treatment. Legacy/onboarding styling is
  unchanged. The appearance-save spinner uses the disabled-text color on its
  disabled surface, preserving contrast while saving.
- Base Retry uses the same disabled surface/text treatment while loading.
- The existing tab auth-loading branch uses parchment/forest colors and an
  accessible loading label. Auth decisions/providers/routes are unchanged.
- Large-text review exposed the appearance header's intrinsic minimum width
  pushing Close outside the narrow sheet. A flexible title with `minWidth: 0`
  lets the title wrap and keeps Close inside the sheet.
- Large-text review exposed Base's fixed heading consuming the bounded panel,
  hiding details and letting action labels overflow. The heading now shares the
  existing details ScrollView; the action row remains outside it. Action text
  stays within its button and has slightly smaller horizontal padding so normal
  Upgrade text also fits at 320px. No map/camera/gesture code changed.
- Added two test IDs to the standalone Base preview for scoped large-text checks.
  They do not enter normal routing or change the preview's layout/transport.

## Intentional differences retained

- Home keeps its single character hero, profile action and read-only task preview.
- Tasks keeps its denser flat rows, inline form and ScrollView architecture.
- Shop keeps its virtualized cosmetic grid, 16-point shell padding and 720-point
  readable column. Cached cosmetic previews, batches and window size are intact.
- Avatar keeps its virtualized wardrobe, 24-point horizontal shell padding,
  1160-point maximum width and existing appearance sheet. These bounds support
  the established character/card geometry and were not normalized to Home.
- Base keeps the full world viewport, compact 21-point title, 16-point overlay
  insets and non-modal building panel. Enter and unavailable Upgrade remain
  callable to explain their status. They are not converted into disabled actions.
- Dense cosmetic cards retain 8-point padding; normal information cards retain
  16-point padding. Scene/artwork geometry and existing dark ad/reward UI are
  outside this consistency pass.
- Existing state-specific loading/refresh copy and retry labels remain contextual.

## Responsive and accessibility review

Local fixture previews render the real presentation components; Base also uses
the real route/world renderer with an isolated fixture API. No live account,
purchase, push, billing or ad-provider requests were made.

| Screen | 320 | 390 | 768 | 1024 | 1440 |
| --- | --- | --- | --- | --- | --- |
| Home | Pass | Pass | Pass | Pass | Pass |
| Tasks | Pass | Pass | Pass | Pass | Pass |
| Base | Pass | Pass | Pass | Pass | Pass |
| Avatar | Pass | Pass | Pass | Pass | Pass |
| Shop | Pass | Pass | Pass | Pass | Pass |

No page-width overflow or clipped normal-size titles. Ten-digit resource values
fit narrow layouts. Task controls/forms wrap; category rows remain horizontally
scrollable. Cosmetic/wardrobe grids remain intact. Final content clears the
stock tab bar, and Avatar no longer has the previous 120-point trailing gap.
The tab order remains Home, Tasks, Base, Avatar, Shop.

Enlarged-text stress review at 320px used scoped web styles (30-point ordinary
text, 42-point section headings, 60-point display headings). All five content
areas remain readable and scrollable after the two fixes above. Long words may
wrap over multiple lines at this extreme size. This is a web reflow check, not
a claim that native Dynamic Type/TalkBack has been tested. Native font-scale and
safe-area behavior still needs device review; existing tab inset/font-scale
regressions pass.

Labels, selected/pressed/checked/expanded states, disabled/busy semantics,
heading hierarchy, inline error announcements and keyboard focus were checked.
Keyboard Enter works for retries and existing Base selection. Appearance modal
focus stays in the dialog and wraps from Save to Close. UI panel/form/card
actions retain at least 48-point targets; stock phone tab targets exceed 44.
Shared semantic text/control contrast tests pass. Selection/lock/completion
states retain text/icons/semantic state, not color alone.

Base's original zoom-dependent map hitboxes can be smaller than 44 points at
extreme zoom. Their geometry is deliberately unchanged. Screen-reader behavior
on native devices remains a manual acceptance check.

## Final validation

- `npm test`: **265 passed, 0 failed, 0 skipped**.
- `npx tsc --noEmit`: passed.
- `npm run lint`: passed with no lint warnings.
- `npm run validate:avatar-assets`: passed; all **143** registered sprites match.
- `git diff --check`: passed.

No tests were removed or security coverage reduced. Existing regression tests
cover resource authority, route/provider behavior, task/reward semantics,
appearance persistence, shop/equipment behavior, virtualization, Base renderer
and geometry fingerprints, gestures and upgrade confirmation. These small UI
fixes were verified by that suite and the local layout/keyboard review.

No browser runtime errors were observed in the final local review. Existing
Node typeless-package and web shadow deprecation warnings remain unchanged.

## Exact files changed in this final pass

Modified:

- `app/(tabs)/_layout.tsx`
- `src/components/HomeContent.tsx`
- `src/components/TasksContent.tsx`
- `src/components/TaskEditor.tsx`
- `src/components/ShopContent.tsx`
- `src/components/AvatarContent.tsx`
- `src/components/AppearanceEditor.tsx`
- `src/components/BasePanels.tsx`
- `src/dev/BasePreview.tsx`

Created:

- `docs/final-ui-consistency.md`

Prior Phase 1–6 changes are still present and are not attributed to this final
pass. Preview harnesses, regression tests and previous phase documents were
retained. Temporary browser/server files and screenshot evidence are outside
the repository.

## Remaining work and commit grouping

Android's known Base loading delay and separate avatar rendering investigation
remain unchanged; no performance claims are made. Renderer internals, Skia,
react-native-svg, native code, dependencies, assets, backend, monetization and
auth logic were untouched. The separate investigation stash was not modified.
No native rebuild is needed for these JS/UI changes.

The UI branch is ready for code review/commit preparation. Before release,
perform the previously identified signed-in Android/iOS device review for
native rendering, gestures, safe areas, large text and screen readers.

Recommended reviewable commits: Phase 1 shared foundation/navigation; Phase 2
Home; Phase 3 Tasks; Phase 4 Shop; Phase 5 Avatar shell; Phase 6 Base polish;
then this final consistency pass. Keep each phase's tests, required mock updates,
preview and documentation with its owning change. Shared files have overlapping
phase edits, so separating these commits requires careful hunk staging; do not
stage the entire dirty tree blindly. No staging or commits were performed here.
