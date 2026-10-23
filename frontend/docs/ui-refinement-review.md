# Evrenthia UI refinement review

October 20, 2026. Reference: the supplied Evrenthia fantasy presentation board.

## 1. GO / NO-GO

**GO for local visual and code review. NO-GO for release until native device acceptance.** The requested visual pass is implemented, including the substantial Avatar and Home layout changes. Onboarding remains six steps: consolidation is paused at the dependency review requested in the brief. It has been restyled without changing its saved progress or required completion action.

## 2. Files changed

The exact inventory appears at the end of this report. Changes are confined to frontend presentation, local fixture review tools, documentation and focused tests. Existing edits in `backend/README.md`, `backend/functions/billing/revenuecat.mjs`, `backend/template.yaml`, their billing/infrastructure tests, `frontend/eas.json` and `frontend/tests/environment.test.mjs` were already present and were left untouched.

## 3. Shared components

Created `PageBackground`, `AuthFrame` and `ExpandableTray`. Extended `ScreenShell`, `FilterChip`, `ResourcePill`, `LifeCard`, `LifeButton` and `LifeInput`. Existing `UiText`, `SectionHeader`, `SurfaceCard` and `UiPressable` remain the common typography, section and interaction primitives. Notification settings accept an explicit parchment tone. Session recovery now uses the same visual palette.

The tray owns only presentation state. Screen routes continue to own fetching, persistence, rewards, purchases and equipment operations.

## 4. Design tokens

Added sky `#DDE8E9`, ivory `#F8F1E3`, lower parchment `#EBD8B9`, inset paper `#F5E8D0`, a dark translucent HUD surface and a modal scrim. Refined the shared surface to `#FBF3E3`. Kept forest green, gold, deep blue, charcoal, borders and semantic status colors centralized. XP now uses sky blue `#83BCD6` over a dark green track `#35423C`. Display/body line heights were tightened. Paper surfaces use the existing subtle shared shadow.

System serif headings and native sans-serif body fonts are retained. No font, animation or bottom-sheet dependency was added. No artwork was generated or replaced. Legacy scene/renderer tokens remain separate so this pass does not recolor sprites, world art or ad internals.

## 5. Safe area and top band

The old root `SafeAreaView` painted the top inset with the legacy dark green background. The root now owns a continuous background; each screen applies its inset to content. `ScreenShell` pads its scrolling content, Shop pads its virtualized list, Avatar pads its compact header, and Base offsets its floating HUD. World and character artwork can extend behind the status bar.

The root status bar uses dark icons on paper/character screens and light icons on Base. Bottom tabs still own their native bottom inset. Form and non-tab screen content also receives a bottom safe inset. Appearance modal content retains bottom inset padding.

## 6. Auth redesign

Sign In, Sign Up and email confirmation share the same illustrated Evrenthia wordmark, parchment form card, serif title, labeled light inputs, forest CTA and restrained gold borders. LifeXP branding was removed from these screens. Confirmation retains the entered registration state and presents the code field rather than repeating the account form.

Existing validation, trimming, Cognito callbacks, error translation and destination remain intact. There is no password-reset route in the current app to migrate; none was invented.

## 7. Exact keyboard fix

`AuthFrame` uses `ScreenShell keyboardSafe`. Its `KeyboardAvoidingView` uses `padding` on iOS and `height` on Android. The root has no navigation header, so `keyboardVerticalOffset` is zero. Inside it, a scrolling form uses `keyboardShouldPersistTaps="handled"`, interactive dismissal on iOS, drag dismissal elsewhere and safe bottom padding. The form content can grow and scroll when the keyboard reduces the viewport. Profile, onboarding and task forms use the same arrangement.

Automated tests verify these platform branches and inset values. Browser short-phone checks verify scrolling/reachability. Actual iOS/Android keyboard occlusion and autofill still require device review; a desktop browser cannot establish that result.

## 8. Home structure

The equipped avatar and selected background remain live. Resources float over the scene as compact dark HUD pills. Profile is a single circular icon control. A joined dark progression strip combines a gold-edged level badge, player name, current/required XP and a sky-blue progress bar. The smaller scene brings Today into the initial viewport. Today is one paper panel containing compact rows and the existing task navigation.

Quest rewards, achievements, stale/error states, server balances and the final ad placement remain in their original data flow. Home task rows still navigate to Tasks; they do not invent a new completion action.

## 9. Tasks

Compact serif header, square Add button, full-width segmented filters and paper task rows. Primary rows show completion, title, schedule and authoritative reward metadata. The chevron discloses description, date/streak details and the existing Edit/Archive actions. Expanded state is local presentation state only; create/edit forms, request semantics and reminder retry state are preserved.

There is no category field on the active task contract. The canonical task order and Today / Upcoming / All filters remain intact, without fabricated Morning/Health groups.

## 10. Base HUD

Removed the full-width resource card in favor of a small title and an independent dark World Points pill. The overlay remains transparent to map input outside its controls. Existing retry/loading treatments remain accessible.

The world response supplies World Points, not a coin balance. No balance was invented and no extra fetch was added. The Base route, geometry, sprites, camera, gesture/collision code, building placement and upgrade handlers are unchanged. Existing world fingerprints pass.

## 11. Avatar structure

The equipped scene fills the page. A compact header offers Appearance; a small identity caption accompanies the character. The character is outside the wardrobe `FlatList` and remains visible while categories or items scroll. Its containing bounds adapt to available scene space; the renderer's body, layer order, occlusion, sprite alignment, pets and auras are unchanged.

All eight existing categories remain: Hair, Hats, Tops & Dresses, Bottoms, Boots, Scenes, Pets, Auras. Tiles use existing cropped thumbnails, compact names, owned/locked/requirement text, an equipped check and selected/disabled semantics. Entire tiles invoke the existing equip callback. Hair still follows the existing appearance-save flow.

## 12. Avatar sheet behavior

The tray supports collapsed, medium and expanded positions derived from the actual available height. Medium is the initial state. Dragging the handle resizes it; release snaps to a bounded stop. Tapping the handle cycles positions. Native adjustable accessibility actions expand/collapse it; Enter works on web. The handle owns dragging, the horizontal category row owns horizontal scrolling, and the virtualized list owns item scrolling.

Native uses `PanResponder`; web uses captured pointer events, with a guard against duplicate click activation. Resizing changes only the stage container and tray height. The character stays mounted once, except while the existing appearance modal owns that same composition. The tray sits inside tab content and never overlays navigation. Existing two-row batches, window size three and clipping behavior are preserved.

## 13. Shop

Shared atmospheric background, compact resource HUD, integrated gold-accent Premium banner, tighter category spacing, denser paper cards and serif item names. Existing asset mapping/caching, prices, status flags, level and achievement requirements, Premium locks, purchase callbacks, ad order and virtualization limits remain unchanged.

## 14. Profile

Compact account identity, progression, account/preferences, Premium, notifications and account-actions sections. Display name, time zone, all existing reminder preferences, Premium navigation, sign-out and confirmed account deletion remain available. Logout is visually neutral; deletion retains restrained destructive styling and the original confirmation/handler.

## 15. Onboarding dependency map

Profile creation occurs **before onboarding**, in the Cognito PostConfirmation trigger. `profilePutRequest` requires the Cognito `sub`, writes the display name and UTC time zone, initializes progression and `onboardingCompleted: false`, and writes the five default appearance values. Its conditional write handles duplicate trigger delivery. The onboarding screens do not create a second profile. Inventory/equipment remain separate server-owned records; missing equipment slots read as null.

| Existing step | Fields / state | Calls / writes | Required behavior and possible combination |
| --- | --- | --- | --- |
| Welcome (0) | Local `step` | Per-user AsyncStorage progress | No required server field. Could share a compact introduction with essential setup. |
| Avatar (1) | `bodyType`, `hairId`, `skinColorId`, `hairColorId`, `eyeColorId` | Initial `GET /me`; explicit save `PATCH /me`; per-user appearance cache | Defaults already exist and Keep saved look/skip is supported. If a look changes, its validated save must survive. Could live in one essential-setup step. |
| Starter tasks (2) | Task title, optional description, task size, repeat rule/days, optional dates/time; returned IDs and optional pending request | `GET /tasks`; explicit task create/update and optional reminder save | Optional. A pending create key is persisted before the request to avoid duplicates after interruption. Could be deferred to Tasks, but a migration must retain pending requests and saved IDs. |
| Reminders (3) | Existing notification toggles, clocks and quiet hours | `GET /preferences`; explicit `PATCH /preferences`; device registration only after the relevant user action | Optional. Skip remains valid. Could be deferred to Profile; unsaved choices must not silently become saved. |
| How progress works (4) | Static explanatory copy | Local progress only | No backend dependency. Could be folded into Welcome or final confirmation. |
| You're ready (5) | `onboardingCompleted` | `PATCH /me { onboardingCompleted: true }`, confirmed result, then `refreshUser()` / `GET /me` | Mandatory completion gate. It could share another step's final CTA only if the same confirmation and refresh sequence is retained. |

Local progress uses the existing per-user `.v1` key and numeric step indices. Back navigation, task retry IDs and defaults are preserved. Validation is server-defined for appearance IDs, display name and time zone; no frontend API/type relaxation was introduced.

## 16. Consolidation status

**Not consolidated.** All six steps, their persisted indices and their optional skip paths remain. They now share the new background, typography, controls, task editor tone and keyboard-safe shell.

## 17. Exact pause dependency

The non-optional dependency is the final **confirmed `PATCH /me` setting `onboardingCompleted: true`, followed by successful profile refresh**. `authDestination` uses that server state to unlock Home and the other main routes. Avatar changes also depend on their explicit validated profile save; task setup carries an idempotent pending-create record. Removing/combining numeric steps needs to preserve those actions and account for existing `.v1` progress records.

This report is the pause requested before consolidation. It does not claim that six separate screens are backend-required: tasks/reminders are optional, appearance can keep defaults, and the tutorial has no network dependency. A future 2–3-step change can combine Welcome/tutorial, retain essential appearance choices, move optional task/reminder setup later and keep the confirmed completion action on the final CTA, with an explicit progress-record migration.

## 18. Premium

Paper background/cards, serif hierarchy and matching buttons. Subscribe still uses localized provider options; disabled predicates, server entitlement confirmation, Manage Subscription, Restore Purchases, verification retry and plan refresh are unchanged. No billing client/provider or entitlement model was edited.

## 19. Navigation

The stock React Navigation tab bar remains in charge of routes, focus, long press, links and safe areas. Exact order: **Home, Tasks, Base, Avatar, Shop**. Inactive stone icons sit on charcoal; the active icon gets a small forest surface, muted gold border/bloom and restrained shadow. The full flat green selected-tab rectangle is gone. Labels and inset/font-scale accommodation remain.

## 20. Validation

- Frontend `npm test`: **270 passed**, zero failures/skips (baseline 265).
- Root `npm test`: **311 backend tests passed**, zero failures/skips, including the existing unrelated working-tree changes.
- Frontend `npx tsc --noEmit`: passed.
- Frontend `npm run lint`: passed without warnings.
- `npm run validate:avatar-assets`: all **143** character sprites passed.
- `git diff --check`: passed.
- No changes in auth/API/billing/ads/entitlement/context implementations, avatar renderer/layering files, or the main Home/Tasks/Base/Avatar/Shop route controllers.

All existing tests remain. Component mocks and assertions were adapted where the requested layout changed (for example, a persistent scene instead of a fixed 440-point scrolling header). Existing ownership, authoritative values, request payloads, route guards, pending saves, purchases/restore, ads and world fingerprints remain covered. Added checks cover keyboard platform/inset behavior, snap bounds, native drag handlers, web pointer/keyboard activation and auth/confirmation payload retention.

The real presentation components were reviewed through local fixtures at 320, 390, 430, 768, 1024 and 1440 widths for the five main screens. Account screens were checked at 320, 390, 430, 768 and 1440. All had no page-width overflow or console errors. Additional 320×568 and enlarged-text browser checks passed horizontal bounds; the Avatar tray cleared navigation with its scene visible. Enlarged text here is a CSS stress test, not native Dynamic Type certification.

Browser interaction review covered Avatar tap/drag/Enter resizing, category selection and locked tiles; task details/secondary actions; Base building selection; registration-to-code layout using fixture values; and onboarding optional appearance/task skip paths. The fixture previews make no real account, purchase, billing or ad requests.

Measurements: `ui-refinement-review/responsive-checks.json`. Screenshots in the same directory show Home, Tasks, Base, Avatar, Shop, auth, Profile, Premium and onboarding.

## 21. Physical-device acceptance still required

On a small iPhone and a notched iPhone, verify email/password/display-name/code focus, keyboard autofill and dismissal, scroll-to-input behavior and submit reachability. Verify status-bar contrast over actual equipped backgrounds, top/bottom insets and large native text. On iOS and Android, check tray dragging, independent horizontal/vertical scrolling, live equipment, appearance save/discard and SVG performance. Review VoiceOver/TalkBack focus and adjustable tray actions.

Using the existing development build and approved test account, exercise sign-in/confirmation, required onboarding save/finish, task create/edit/archive/complete, Base gestures/upgrades, equipment/ownership, Shop locks/purchases, Premium subscribe/manage/restore, notification preferences, sign-out and the existing deletion confirmation flow. No real purchase, account deletion or provider-side action was performed during this visual review.

## 22. Exact local review instructions

From `/Users/owensegala/Productivity/productivity/frontend`, start Metro in one terminal:

```sh
EXPO_OFFLINE=1 npm start -- --web --localhost --port 8081
```

In a second terminal from the same directory:

```sh
node scripts/review-ui.cjs
```

Open the framed review (it keeps the inner viewport at the chosen phone width even in a wide desktop window):

- Avatar: <http://localhost:8082/review?screen=avatar&width=390>
- Home: <http://localhost:8082/review?screen=home&width=390>
- Tasks: <http://localhost:8082/review?screen=tasks&width=390>
- Base: <http://localhost:8082/review?screen=base&width=390>
- Shop: <http://localhost:8082/review?screen=shop&width=390>
- Account screens: <http://localhost:8082/review?screen=account&view=login&width=390> (change `view` to `register`, `profile`, `premium` or `onboarding`).

Add `controls=1` for the existing loading/error/empty/long-value fixture controls, `height=568` for the short phone, or `text=large` for the CSS text stress check. Direct `/?screen=...` URLs are useful when the browser's responsive viewport already matches `width`. Reload after changes. Account preview writes are local fixtures; unsupported actions, including deletion, reject. It is a separate development-only web entry, outside normal app routing. The app's main package entry remains `expo-router/entry`.

For native acceptance, use the already-installed development build with the existing DEV environment and Metro; no new native build is required by these JS/UI changes. Do not interpret browser fixture checks as native provider or keyboard validation.

## 23. Backend and behavior preservation

No backend file was edited by this pass. Cognito/session handling, RevenueCat, entitlement authority, restore behavior, AdMob, API routes/types, DynamoDB schemas, task CRUD/rewards/scheduling, world mechanics and ownership/equipment/purchase rules remain in their existing implementations. Account/auth handler bodies were retained. The main gameplay route controllers and renderer files have no diff. Unrelated billing/environment edits from the initial working tree are preserved.

## 24. Delivery boundary

No AWS deployment, RevenueCat/App Store/AdMob dashboard change, EAS/native/production build, commit, push or publishing occurred. Expo generated local development preview bundles only. No real account or store transaction was used. No dependency or package entry change was made.

## Evidence

![Avatar at 390px](/Users/owensegala/Productivity/productivity/frontend/docs/ui-refinement-review/avatar-390.jpg)

![Home at 390px](/Users/owensegala/Productivity/productivity/frontend/docs/ui-refinement-review/home-390.jpg)

## Exact file inventory

- [account-preview.tsx](/Users/owensegala/Productivity/productivity/frontend/account-preview.tsx)
- [app/(tabs)/profile.tsx](/Users/owensegala/Productivity/productivity/frontend/app/(tabs)/profile.tsx)
- [app/_layout.tsx](/Users/owensegala/Productivity/productivity/frontend/app/_layout.tsx)
- [app/login.tsx](/Users/owensegala/Productivity/productivity/frontend/app/login.tsx)
- [app/onboarding.tsx](/Users/owensegala/Productivity/productivity/frontend/app/onboarding.tsx)
- [app/premium.tsx](/Users/owensegala/Productivity/productivity/frontend/app/premium.tsx)
- [app/register.tsx](/Users/owensegala/Productivity/productivity/frontend/app/register.tsx)
- [scripts/review-ui.cjs](/Users/owensegala/Productivity/productivity/frontend/scripts/review-ui.cjs)
- [src/avatar/tray.ts](/Users/owensegala/Productivity/productivity/frontend/src/avatar/tray.ts)
- [src/components/AvatarContent.tsx](/Users/owensegala/Productivity/productivity/frontend/src/components/AvatarContent.tsx)
- [src/components/BasePanels.tsx](/Users/owensegala/Productivity/productivity/frontend/src/components/BasePanels.tsx)
- [src/components/HomeContent.tsx](/Users/owensegala/Productivity/productivity/frontend/src/components/HomeContent.tsx)
- [src/components/LifeButton.tsx](/Users/owensegala/Productivity/productivity/frontend/src/components/LifeButton.tsx)
- [src/components/LifeCard.tsx](/Users/owensegala/Productivity/productivity/frontend/src/components/LifeCard.tsx)
- [src/components/LifeInput.tsx](/Users/owensegala/Productivity/productivity/frontend/src/components/LifeInput.tsx)
- [src/components/NotificationSettings.tsx](/Users/owensegala/Productivity/productivity/frontend/src/components/NotificationSettings.tsx)
- [src/components/SessionRecovery.tsx](/Users/owensegala/Productivity/productivity/frontend/src/components/SessionRecovery.tsx)
- [src/components/ShopContent.tsx](/Users/owensegala/Productivity/productivity/frontend/src/components/ShopContent.tsx)
- [src/components/ShopItemCard.tsx](/Users/owensegala/Productivity/productivity/frontend/src/components/ShopItemCard.tsx)
- [src/components/TasksContent.tsx](/Users/owensegala/Productivity/productivity/frontend/src/components/TasksContent.tsx)
- [src/components/WardrobeCard.tsx](/Users/owensegala/Productivity/productivity/frontend/src/components/WardrobeCard.tsx)
- [src/components/ui/AuthFrame.tsx](/Users/owensegala/Productivity/productivity/frontend/src/components/ui/AuthFrame.tsx)
- [src/components/ui/ExpandableTray.tsx](/Users/owensegala/Productivity/productivity/frontend/src/components/ui/ExpandableTray.tsx)
- [src/components/ui/Indicators.tsx](/Users/owensegala/Productivity/productivity/frontend/src/components/ui/Indicators.tsx)
- [src/components/ui/PageBackground.tsx](/Users/owensegala/Productivity/productivity/frontend/src/components/ui/PageBackground.tsx)
- [src/components/ui/Primitives.tsx](/Users/owensegala/Productivity/productivity/frontend/src/components/ui/Primitives.tsx)
- [src/dev/AccountPreview.tsx](/Users/owensegala/Productivity/productivity/frontend/src/dev/AccountPreview.tsx)
- [src/dev/AvatarPreview.tsx](/Users/owensegala/Productivity/productivity/frontend/src/dev/AvatarPreview.tsx)
- [src/dev/HomePreview.tsx](/Users/owensegala/Productivity/productivity/frontend/src/dev/HomePreview.tsx)
- [src/dev/ShopPreview.tsx](/Users/owensegala/Productivity/productivity/frontend/src/dev/ShopPreview.tsx)
- [src/dev/TasksPreview.tsx](/Users/owensegala/Productivity/productivity/frontend/src/dev/TasksPreview.tsx)
- [src/navigation/tabAppearance.tsx](/Users/owensegala/Productivity/productivity/frontend/src/navigation/tabAppearance.tsx)
- [src/theme/theme.ts](/Users/owensegala/Productivity/productivity/frontend/src/theme/theme.ts)
- [tests/appearance-editor.test.mjs](/Users/owensegala/Productivity/productivity/frontend/tests/appearance-editor.test.mjs)
- [tests/avatar-appearance.test.mjs](/Users/owensegala/Productivity/productivity/frontend/tests/avatar-appearance.test.mjs)
- [tests/avatar-shell.test.mjs](/Users/owensegala/Productivity/productivity/frontend/tests/avatar-shell.test.mjs)
- [tests/base-polish.test.mjs](/Users/owensegala/Productivity/productivity/frontend/tests/base-polish.test.mjs)
- [tests/entitlements-ads.test.mjs](/Users/owensegala/Productivity/productivity/frontend/tests/entitlements-ads.test.mjs)
- [tests/frontend-api-contract.test.mjs](/Users/owensegala/Productivity/productivity/frontend/tests/frontend-api-contract.test.mjs)
- [tests/home-redesign.test.mjs](/Users/owensegala/Productivity/productivity/frontend/tests/home-redesign.test.mjs)
- [tests/native-monetization.test.mjs](/Users/owensegala/Productivity/productivity/frontend/tests/native-monetization.test.mjs)
- [tests/onboarding.test.mjs](/Users/owensegala/Productivity/productivity/frontend/tests/onboarding.test.mjs)
- [tests/shop-redesign.test.mjs](/Users/owensegala/Productivity/productivity/frontend/tests/shop-redesign.test.mjs)
- [tests/task-scheduling.test.mjs](/Users/owensegala/Productivity/productivity/frontend/tests/task-scheduling.test.mjs)
- [tests/ui-foundation.test.mjs](/Users/owensegala/Productivity/productivity/frontend/tests/ui-foundation.test.mjs)
- [tests/ui-refinement.test.mjs](/Users/owensegala/Productivity/productivity/frontend/tests/ui-refinement.test.mjs)

Also created this report and the screenshots/measurements under `frontend/docs/ui-refinement-review/`. These are local review artifacts.
