# Evrenthia UI foundation: Phase 1

The presentation board informs the palette and typography, not a wholesale screen
replacement. Only bottom navigation adopts the new visual treatment immediately.
Existing screen structures, routes, providers, APIs and data flows are unchanged.

## Design and adoption

- `uiTheme` extends the existing theme module with parchment/ivory surfaces,
  forest primary controls, muted blue, warm gold, stone, charcoal, semantic state
  and resource colors. It includes spacing, radii, typography, target/icon/pill/tab
  sizes and a restrained elevation preset. Decorative gold is not body text.
- Native headings use Georgia on iOS and system serif on Android. Body text uses
  the system sans-serif. No fonts, textures, native modules or dependencies added.
- The original `colors`, spacing, radius and shadow exports remain unchanged.
  Existing `LifeButton`, `LifeCard` and `XPBar` callers retain their appearance.
  Pass `tone="parchment"` when migrating a screen as a unit. Do not globally swap
  the old colors: existing overlays and hardcoded dark surfaces rely on them.
- `LifeButton` already supports primary/secondary/danger variants; no duplicate
  button implementation was added. Parchment buttons have visible focus, disabled
  states and static press feedback. Business callbacks remain supplied by callers.
- `XPBar` adds a semantic progress label/value and bounds only the displayed width.
  It does not calculate XP or modify server state.

## Reusable primitives

`src/components/ui/Primitives.tsx` contains:

- `UiText`: display, section, body, label, caption and tab hierarchy.
- `ScreenShell`: a parchment ScrollView with a 720px maximum readable column.
  The root navigator owns the top safe area; the stock tab bar owns the bottom.
  Do not wrap FlatList or other virtualized lists in this shell.
- `SectionHeader`: title, optional supporting text and optional trailing content.
- `SurfaceCard`: the existing LifeCard with the parchment treatment.
- `UiPressable`: 48-point targets with shared press and keyboard-focus feedback.
- `FilterChip`: caller-controlled selection, disabled state and accessible toggle.
- `ListRowCard`: optional leading/trailing content; static or pressable row.
- `EmptyState`: concise heading, explanation and optional supplied action.

`src/components/ui/Indicators.tsx` contains `ResourcePill`, `ResourceCluster` and
`BadgePill`. Values are display-only and must come from the existing authoritative
data. Coin/gem/World Point treatments do not introduce currencies or balances.

Example adoption:

```tsx
<ScreenShell>
  <UiText variant="display" accessibilityRole="header">Home</UiText>
  <SurfaceCard>
    <SectionHeader title="Your progress" />
    <XPBar tone="parchment" progress={progressPercent / 100} />
  </SurfaceCard>
  <LifeButton tone="parchment" title="Add task" onPress={openExistingTaskEditor} />
</ScreenShell>
```

## Navigation

The existing Expo Router `Tabs` and stock tab bar are retained. Order remains
**Home, Tasks, Base, Avatar, Shop**, with routes `dashboard`, `tasks`, `base`,
`avatar`, `shop`. Social and Profile remain hidden via `href: null`. Auth loading,
login redirect, CompletionFeedbackProvider and AdProvider are unchanged.

`tabAppearance` provides a dark green/charcoal bar, green selected surface, warm
gold active icon/label and muted neutral inactive states. It reserves 64 points
plus the bottom inset and additional line-height for larger system text. Labels
remain below the icons on every width. Stock links, tab events, accessibility,
focus, back behavior and long-press handling are not replaced.

## Review and validation

`ui-preview.tsx` is an isolated DEV entry, not an app route or auth bypass. Its
`src/dev/UiPreview.tsx` sample uses the real components and the same Expo Router
tab implementation/options, with labeled sample values and local-only controls.
Package `main` is unchanged. No task, ad, auth, avatar or backend module is imported.
It can be bundled as `/ui-preview.bundle?platform=web&dev=true&minify=false` by a
local Expo server; native development clients can open the same standalone entry
using their platform's bundle URL. Do not use the preview as a production route.

Local web review completed at **320, 390, 768, 1024 and 1440px**. Verified all five
tab selections, wrapping at narrow width, visible keyboard focus, Enter activation,
disabled controls skipped by Tab, progress semantics and readable empty/state UI.
At 320px each tab target measured approximately **58 x 55px**. The initial label
clipping caused by double-padding the stock item was corrected during review.

Seven new regression tests cover legacy defaults, button/chip interactions and
disabled states, display-only resources, bounded XP presentation, tab order and
hidden routes, auth/provider preservation, insets/font scaling and contrast.
Semantic text pairs pass 4.5:1; interactive borders/focus pass 3:1.

Final checks: **227 frontend tests passed**, TypeScript passed, lint passed,
`git diff --check` passed. Existing Node module-type warnings remain; no package
configuration was changed to suppress them. No new lint warnings.

This is a web component/navigation preview review, not an end-to-end signed-in
Android/iOS screen review. Native safe-area, Dynamic Type and screen-reader review
should accompany the next device review. No native rebuild is required for these
JS/style changes. No native or avatar-investigation files were touched.

## Phase 2

Migrate Home's existing shell and sections to these components, retaining its
current server data, quest/reward feedback and ad placement. Convert the whole
Home surface and text together so dark legacy styles are not mixed into light
cards. Leave avatar rendering and Base/world presentation for their own scopes.
