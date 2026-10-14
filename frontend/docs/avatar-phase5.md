# Phase 5 — Avatar shell review

Reviewed October 13, 2026. GO for UI-shell review. This is not certification of
the separately parked Android raster/SVG rendering issue.

## Audit and preserved functionality

The route is `app/(tabs)/avatar.tsx`. It still loads GET `/shop`, GET `/inventory`
and the existing preferred-appearance helper together. Appearance uses GET `/me`
and the same user-scoped local fallback/cache. Equipment comes from
`avatarFromInventory`; wardrobe ownership/catalog merging comes from
`wardrobeCosmetics`. Neither helper was changed.

Features beyond the mockup remain available:

- Eight sections, in the original order: Hair, Hats, Tops & Dresses, Bottoms,
  Boots, Scenes, Pets, Auras. Hair remains the default.
- Both Boy/Girl bodies, 20 hairstyles, 16 skin tones, 20 hair colors, 12 eye
  colors; all existing IDs/values and appearance properties remain unchanged.
- Owned/equipped/locked items, original requirement text including achievement
  requirements, equip/unequip actions, pending state, and Premium display labels.
  Premium labels are display-only catalog metadata, not a new equipment gate.
- Pets/auras, dresses covering saved bottoms, equipped item summaries, hero level,
  and the existing DEV-only unsaved cosmetic preview mode.
- Hair choices in the wardrobe update the existing draft, not equipment APIs.
  The shell now explains that they save through Edit Appearance.
- Dirty-close confirmation with Keep Editing/Discard Changes, existing save
  errors including unsupported hairstyles, and account-local appearance caching.

Equipment still sends exactly `{ itemId: String(cosmetic.id) }` to the existing
equip/unequip routes and reloads authoritative data afterward. Locked items are
still rejected before mutation. DEV preview still changes only local preview
state and reloads authoritative data when exited. Failed reads keep the last
confirmed look; failures now also have accessible inline messages/retry while
the original Alert behavior remains.

## Presentation, renderer and background boundaries

The screen uses shared parchment surfaces, forest controls, restrained gold,
typography, spacing, chips, badges and keyboard focus treatment. `AvatarContent`
holds presentation; `WardrobeCard` is a memoized display/action component.
AppearanceEditor has opt-in parchment styling. Its default legacy styling is
preserved for onboarding and other callers.

No changes were made to AvatarRenderer, CharacterSpriteLayers, registry/frame
metadata, body geometry, masks/clips, occlusion, layer order, hair/dress/boot
alignment, tint calculations, source PNGs, dimensions, native code or caching.
The existing renderer receives the exact same appearance/equipment props, with
`showBackground={false}`, no additional transform/size/style/key, and its existing
regular preview behavior.

Original layout bounds remain: content max width 1160 with 24px padding; hero
padding 24 and gap 32; stage 330x440 with maxWidth 100%, centered and clipped;
stacked stage width 100% capped at 330 below 760px. The appearance preview remains
350px high, centered and clipped. No compact/full renderer mode was changed.

The existing `getEquippedSceneSource(cosmetics, equippedBackgroundId, "BACKGROUND")`
still resolves the stage background. The same React Native Image stretch scaling
is preserved. There is no independent background selection state. Owned scene
equip/unequip still changes inventory state through the existing API, so Home
continues reading the same authoritative slot/helper. Regression coverage checks
that propagation; visual fixture review checks garden -> library -> no scene ->
garden. This phase made no Home changes.

The original shell mounted the hero plus another character inside the appearance
modal. This was reported before restructuring. The hero character is now omitted
while the editor is open; the editor mounts the same renderer/props. There is one
composition at a time (zero during the discard confirmation), not two. The modal
is outside the list and renders its content only when open.

## Wardrobe performance

The current checkout started with an eager ScrollView, despite the brief's
windowing expectation. Saved WIP snapshot `5ea8e64f` contained the relevant prior
Avatar list settings. Those settings were recovered: FlatList with two initial
rows, batches of two rows, windowSize 3, stable cosmetic-ID keys and memoized
cards/callbacks. Multi-column FlatList counts rows, not individual previews.
`removeClippedSubviews` remains false so the SVG header is not detached by native
clipped-subview removal. The header is an element, not an inline component type.
No fixed-height assumptions or catalog preloading were added.

Card-width breakpoints/aspect ratio/source/crop behavior remain the same.
CosmeticImage retains its existing default React Native Image path in the
wardrobe; no expo-image caching/recycling or native cache changes were made.
Shop's separate Phase 4 windowing/cache improvements were not touched.

## Validation and review

- `npm test`: 257 passed, 0 failed, 0 skipped.
- `npx tsc --noEmit`: passed.
- `npm run lint`: passed, no lint warnings.
- `npm run validate:avatar-assets`: passed, all 143 sprites.
- `git diff --check`: passed.
- Eight new shell regressions cover category order/filtering, exact renderer
  props/bounds/scene behavior, single composition, recovered windowing/keys,
  equipped/locked/pending states, palettes and accessibility, authoritative
  background mutations/propagation, ownership/DEV isolation, failures and retry.
- Existing appearance-save/close tests still cover all five fields, every skin
  preset and hairstyle, persistence, save failures and draft retention. Assertions
  tied to former inline JSX were updated to the new presentation seam without
  removing their behavioral checks.
- Read-only diff checks confirmed no backend, native/config/dependency,
  avatar-internal, auth, billing or ad changes. Save/close/discard controller
  function bodies were compared against HEAD and remain unchanged.

Local browser review rendered actual AvatarContent, wardrobe cards, shared tabs,
AppearanceEditor and unchanged renderer/assets using explicitly labelled fixture
inventory. The DEV-only `avatar-preview.tsx` entry does not enter normal routing
or make account/API/ad/billing requests.

Reviewed 320, 390, 768 and 1024px. Phone heroes stack; tablet/web heroes retain
the original side-by-side layout. No document-width overflow; backgrounds and
characters remain contained; names wrap, category strips scroll, colors/styles
wrap, modal headers remain reachable, and the wardrobe's bottom padding clears
navigation. Reviewed loading, empty, locked, Premium-owned, pending, equipment
failure, refresh failure/retry, dirty-close/keep/discard, save success/failure,
long username, both body choices, scenes, pet and aura presentation.

Visible controls and swatches measure 48px or more. Selected/locked/busy states
and individual color names are exposed accessibly. Dynamic errors use alert
semantics; shared token contrast tests pass. Keyboard Tab navigation shows a
visible ring; Escape closes a clean editor and returns DOM focus to Edit
Appearance. A dirty close keeps the existing confirmation workflow.

Browser console: no errors; existing React Native Web shadow-prop deprecation
warning only. Node tests still print existing typeless-package ESM warnings.
No dependency/config changes were made just to silence those warnings.

## Exact Phase 5 files

Modified:

- `app/(tabs)/avatar.tsx`
- `src/components/AppearanceEditor.tsx`
- `tests/appearance-editor.test.mjs`
- `tests/avatar-appearance.test.mjs`
- `tests/avatar-wardrobe.test.mjs` (two Avatar presentation assertions; prior Shop
  changes retained)

Created:

- `src/components/AvatarContent.tsx`
- `src/components/WardrobeCard.tsx`
- `src/dev/AvatarPreview.tsx`
- `avatar-preview.tsx`
- `tests/avatar-shell.test.mjs`
- `docs/avatar-phase5.md`

Earlier Phase 1–4 working-tree changes were retained. No commit, push, deployment,
AWS access, native build, dependency installation or asset regeneration occurred.

## Remaining device review and Phase 6

Signed-in Android/iOS equipment persistence, native safe areas, TalkBack/VoiceOver
and large native text still need device review. Web fixture checks and mocked API
tests do not prove native bitmap stability or production network persistence.
The known Android partial-render investigation remains unchanged and separate;
no native rebuild is required by these shell-only changes.

Recommend Phase 6: Base polish using the shared visual system around the existing
world/building behavior, without changing terrain/windowing or gameplay logic.
