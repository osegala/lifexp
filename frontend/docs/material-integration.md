# Evrenthia material / art-direction integration

Implemented a shared illustrated material system from all eight supplied assets. Home now has an edge-to-edge equipped scene and parchment Today journal; Avatar keeps its full-screen character scene and overlaid inventory tray; the five-tab navigation uses a physical forest/gold shell. This pass builds on the two existing visual passes in the worktree.

## 1. Attached asset mapping

All eight originals were inspected visually, including their transparent regions, before mapping roles. The presentation board remained the design authority. [Inspected source contact sheet](/Users/owensegala/Productivity/productivity/frontend/docs/material-integration/assets-inspected.jpg).

| Supplied file, identified visually | Semantic role | Local optimized file | Original → runtime dimensions | Runtime bytes |
|---|---|---|---|---:|
| ChatGPT Image Oct 20, 2026, 08_37_07 PM-1.png | Atmospheric screen paper | [screen-parchment.png](/Users/owensegala/Productivity/productivity/frontend/assets/ui/fantasy/screen-parchment.png) | 941×1672 → 768×1365 | 1,379,502 |
| ChatGPT Image Oct 20, 2026, 08_37_09 PM-2.png | Ornate major content panel | [parchment-panel.png](/Users/owensegala/Productivity/productivity/frontend/assets/ui/fantasy/parchment-panel.png) | 1448×1086 → 800×464 | 512,332 |
| ChatGPT Image Oct 20, 2026, 08_37_11 PM-3.png | Forest navigation shell | [bottom-nav-shell.png](/Users/owensegala/Productivity/productivity/frontend/assets/ui/fantasy/bottom-nav-shell.png) | 2172×724 → 1086×120 | 182,111 |
| ChatGPT Image Oct 20, 2026, 08_37_13 PM-4.png | Primary action surface | [primary-button.png](/Users/owensegala/Productivity/productivity/frontend/assets/ui/fantasy/primary-button.png) | 2172×724 → 800×186 | 218,641 |
| ChatGPT Image Oct 20, 2026, 08_37_16 PM-5.png | Selected navigation tile | [selected-tab.png](/Users/owensegala/Productivity/productivity/frontend/assets/ui/fantasy/selected-tab.png) | 1942×809 → 600×157 | 129,186 |
| ChatGPT Image Oct 20, 2026, 08_37_17 PM-6.png | Compact resource HUD | [resource-pill.png](/Users/owensegala/Productivity/productivity/frontend/assets/ui/fantasy/resource-pill.png) | 1983×793 → 500×131 | 92,659 |
| ChatGPT Image Oct 20, 2026, 08_37_19 PM-7.png | Parchment input field | [input-field.png](/Users/owensegala/Productivity/productivity/frontend/assets/ui/fantasy/input-field.png) | 2172×724 → 800×146 | 136,450 |
| ChatGPT Image Oct 20, 2026, 08_37_22 PM-8.png | Subtle paper-edge vignette | [parchment-vignette.png](/Users/owensegala/Productivity/productivity/frontend/assets/ui/fantasy/parchment-vignette.png) | 941×1672 → 640×1137 | 721,479 |

## 2. Asset storage

Runtime materials live in [assets/ui/fantasy](/Users/owensegala/Productivity/productivity/frontend/assets/ui/fantasy/manifest.json). The manifest records original names, source dimensions/bytes, exact crops, output dimensions/bytes, density and corner insets. Static requires are centralized in [fantasyMaterials.ts](/Users/owensegala/Productivity/productivity/frontend/src/theme/fantasyMaterials.ts). Original Downloads files remain intact.

Two local derivatives support restrained usage: `paper-inset.png` (256×256 center paper without an ornate rim) and `primary-button-disabled.png` (800×186 muted primary surface). They are derived from the supplied art rather than a separate visual style.

## 3. Optimization and border preservation

All eight were reduced to practical runtime dimensions. Transparent canvas margins were cropped around actual painted content, with padding for corners/shadows. Navigation's large empty top and raised side horns were removed to retain the mock's straight upper rim. The selected tile's strong blue halo was attenuated and warmed.

Six bordered materials use nine-slice geometry: fixed corner regions and stretchable edge/center strips. `FantasyMaterial` renders clipped SVG viewports using the already installed `react-native-svg`; no dependency was added. This avoids nonuniformly stretching an entire ornamental bitmap and applies the same geometry on web, iOS and Android. Screen paper and vignette use proportional cover scaling. [Repeatable preparation script](/Users/owensegala/Productivity/productivity/frontend/scripts/prepare-fantasy-ui.py).

## 4. Reusable components

- `FantasyMaterial`, `fantasyMaterials`, `nineSliceRegions`: centralized art loading, metadata, corner-preserving rendering and layout calculation. Decorative layers ignore pointer input and are hidden from accessibility.
- `PageBackground`: supplied atmospheric paper over ivory; paper opacity 0.72, edge vignette 0.035. `illustrated=false` avoids loading paper behind Avatar's equipped scene.
- `PaperTexture`: restrained center paper shared by unframed cards, inventory cells and the tray.
- `LifeCard` / `SurfaceCard`: opt-in `framed` major groups; simple inner paper surfaces remain available.
- `LifeButton`: illustrated primary/disabled variants; real Pressable, native text, dynamic labels, accessible disabled state and warm keyboard focus retained. Primary press opacity is 0.85. Secondary actions remain compact with hit slop.
- `LifeInput`: real TextInput over sliced paper, with secure entry, autofill, validation callbacks, pointer behavior and keyboard focus retained. Explicit input stacking keeps placeholders and typing above the decoration.
- `ResourcePill` and `tabAppearance`: shared HUD, navigation shell and whole-item selected surface.

## 5. Home

The actual equipped avatar/environment now fills the hero width rather than sitting inside a rounded picture card. Existing coin/world-point values, level, name and XP remain authoritative. The Today journal uses one illustrated parchment frame around compact rows and a restrained secondary action. Padding and row density were tightened after screenshot review so the three-task journal and View all tasks fit above navigation at 390px. Existing quests, achievements, feedback and ad placements remain.

## 6. Tasks

One framed journal group holds compact task rows with thin separators. Rows themselves have no ornamental frames. Today / Upcoming / All remain small. The editor uses the shared parchment inputs and illustrated Add/Save action, including a legible disabled state. Existing task ordering, schedules, repeat values, completion handlers, rewards, validation and save payloads remain unchanged.

## 7. Base

Base retains the actual full-screen world renderer. This pass adds only the shared illustrated resource pills and navigation treatment. No parchment background or oversized header was added. The root backing surface is plain ivory, avoiding a decoded paper image behind opaque world art. The Base route and world controls are byte-identical to the start of this pass; selection, Info expansion and close were exercised in the local fixture.

## 8. Avatar

The equipped scene remains the dominant full-screen layer. A paper inventory tray overlays it with a stronger upper edge and upward shadow; it has no full ornate gold frame. Categories remain compact inventory controls. Normal 390/430px layouts now use four item columns; larger-text layouts retain wider cells. Item cells use restrained paper, with owned/equipped/locked states and real labels preserved.

Collapsed, medium and expanded states were captured at both widths. A real drag expanded the tray; scrolling reached the final hair row (scrollTop 412 + viewport 380 = content 792) above the navigation. Two-row initial/batch rendering remains bounded. Character layers, equipment, appearance saves and ownership logic were not changed.

## 9. Shop

The screen uses the atmospheric paper, compact resource HUD, illustrated navigation and a restrained framed Premium banner. Individual inventory items remain simple paper cards with dominant artwork and compact price/state areas. All seven categories and all 85 catalog entries were checked, including the final two Outfits rows. Data, IDs, price calculations, purchase gating and ownership behavior remain unchanged.

## 10. Bottom navigation

The bar now uses the supplied forest/charcoal shell with a fine gold upper rim and inner shading. The selected art covers both icon and label, with gold text/icon and subdued glow; inactive items use warm stone. Selected artwork opacity is 0.68 after review. The stock navigator and PlatformPressable preserve route links, press/long-press, accessibility and focus behavior. Existing safe-area and font-scale height handling remain. Order is exactly Home, Tasks, Base, Avatar, Shop.

## 11. Profile / Premium / Auth / Onboarding

Profile uses framed major sections with simpler internal rows. Premium uses restrained framed benefits and the shared primary/disabled treatment; Restore Purchases and billing callbacks remain intact. Login/Signup use atmospheric paper, a framed form and real parchment inputs for display name, email, password and confirmation code. Keyboard password entry, warm focus and confirmation flow were exercised in a transport-isolated fixture.

Onboarding changes are visual only: content materials and shared primary actions. Its six steps, required values, backend save dependencies and transitions remain. **Onboarding consolidation remains paused.**

## 12. Intentionally excluded material

All eight supplied assets are used. Excess transparent margins, the navigation horns and most of the generated blue selection halo were intentionally excluded because the reference is more restrained. The full ornate panel is excluded from individual task rows, small filters, inventory cells, the Avatar sheet perimeter and Base's world. The earlier procedural grain was replaced and archived under review evidence; it is no longer bundled as unused runtime art.

## 13. Comparison with the approved mock

[390px reference comparison](/Users/owensegala/Productivity/productivity/frontend/docs/material-integration/comparison-390.jpg) · [430px reference comparison](/Users/owensegala/Productivity/productivity/frontend/docs/material-integration/comparison-430.jpg)

| Review criterion | Final finding |
|---|---|
| Generic React Native appearance | Illustrated paper, bevels, tactile primary surfaces and a physical nav shell replace the most prominent flat rectangles. |
| Navigation belongs to scene | Full-width dark shell and shared upper gold rim integrate the bar on all five screens. |
| Physical buttons and HUD | Painted edges sit beneath real labels/values; disabled primaries remain readable. |
| Enough illustrated material | Main paper foundation, journal groups, auth fields, HUD and shell carry the material consistently. |
| Gold/glow restraint | Gold is limited to major groups, primary actions, HUD and selected navigation. Strong blue glow was removed. |
| Paper restraint | Base remains world-only; Avatar uses equipped art plus a restrained tray. Edge vignette is barely visible. |
| Panel size and density | Today padding and rows were tightened; task rows share one frame; wardrobe uses four phone columns. |
| Avatar scene dominance | Full scene is visible in collapsed state, with the character/background retained above the medium tray. Expanded state intentionally prioritizes inventory. |
| Home environment dominance | Full-width equipped scene and integrated XP/HUD produce an RPG dashboard composition. |
| Base obstruction | Title/HUD/navigation remain minimal; world occupies all remaining space. |
| RPG Shop | Compact paper inventory cards, existing art and small state/price areas carry the presentation. |
| Handcrafted controls | Shared sliced materials preserve painted edge details as content and widths change. |

This is closer to the reference in material and composition, with remaining visible differences: Base uses the existing isometric game world rather than the board's painted village; actual equipped character/outfit art is retained; task metadata, product locks and real state labels require more copy than the stylized mock. Those protected systems were preserved.

## 14. Visual iterations

A second visual iteration was required and completed after the first screenshots. The initial Today group and actions were too tall, navigation selection was too heavy, and web input placeholders were hidden beneath positioned art. The follow-up made Home's scene full bleed, reduced Today padding/gaps and row height, compacted secondary buttons while retaining hit targets, lowered selected-art opacity, softened paper/vignette and fixed TextInput stacking.

The final side-by-side review prompted a further Avatar density iteration: four columns and paper item cells at normal phone text sizes, with wide-cell accessibility layouts preserved. Final Base screenshots were also refreshed after its world and new shared shell finished loading. [First-iteration screenshots](/Users/owensegala/Productivity/productivity/frontend/docs/material-integration/iteration-1/home-390.jpg) remain available for comparison.

## 15. Performance

The supplied eight images total **12,253,302 bytes**. Optimized copies total **3,372,360 bytes**; all ten runtime materials including derivatives total **3,566,746 bytes** (about 71% smaller than the originals). PNG preserves transparency and edge quality. There is no remote loading and no new package dependency.

Materials use stable static sources shared through one registry; rendering is memoized and measurements update only when dimensions change. Full-screen art is not decoded at its supplied maximum size, and redundant paper behind Base/opaque Avatar scenes is avoided. Ornate slices are reserved for major groups and controls rather than every inventory cell. The unique RGBA pixel budget is about 11.7MB; this is a dimension-based estimate, **not a measured native memory profile**. [Performance details](/Users/owensegala/Productivity/productivity/frontend/docs/material-integration/asset-performance.json).

## 16. Validation

| Required check | Result |
|---|---|
| `npm test` | 278 passed, 0 failed |
| `npx tsc --noEmit` | Passed |
| `npm run lint` | Passed, 0 warnings |
| `git diff --check` | Passed |
| `npm run validate:avatar-assets` | All 143 sprite canvases passed |
| `npm run audit:assets` | All 281 images inventoried; all runtime assets resolve statically |

New checks cover corner/edge geometry, tiny containers, manifest/static registry consistency, PNG dimensions/size reduction and real input prop/callback preservation. Browser review found no horizontal document overflow or broken images in the required phone views. Additional 320px auth/Profile and 768/1024/1440px Home widths were checked. Home's final footer clears navigation; Avatar's final row remains reachable; all Shop entries remain available. Keyboard input/focus and Base selection/Info/close were exercised.

Review ran on **Expo Web in isolated local DEV fixtures**. No real account, store transaction, ad reward or server update was performed. The framed review page emitted one non-blocking MutationObserver error while displaying correctly; its origin was not established, and app/review source contains no MutationObserver usage. [Console diagnostic](/Users/owensegala/Productivity/productivity/frontend/docs/material-integration/review-console.json). Actual iOS/Android visual runtime review remains pending; no native build was run. Nine-slice geometry is tested and uses the existing cross-platform SVG implementation, but these screenshots are web captures. [Validation record](/Users/owensegala/Productivity/productivity/frontend/docs/material-integration/validation.json) · [Responsive measurements](/Users/owensegala/Productivity/productivity/frontend/docs/material-integration/responsive-review.json) · [Interaction evidence](/Users/owensegala/Productivity/productivity/frontend/docs/material-integration/interaction-review.json).

## 17. Screenshots and local review

[Five screens at 390px](/Users/owensegala/Productivity/productivity/frontend/docs/material-integration/board-390.jpg) · [Five screens at 430px](/Users/owensegala/Productivity/productivity/frontend/docs/material-integration/board-430.jpg)

| Screen/state | 390×844 | 430×932 | Local review |
|---|---|---|---|
| Home | [Home 390](/Users/owensegala/Productivity/productivity/frontend/docs/material-integration/final/home-390.jpg) | [Home 430](/Users/owensegala/Productivity/productivity/frontend/docs/material-integration/final/home-430.jpg) | [Open Home](http://localhost:8082/review?screen=home&width=390) |
| Tasks | [Tasks 390](/Users/owensegala/Productivity/productivity/frontend/docs/material-integration/final/tasks-390.jpg) | [Tasks 430](/Users/owensegala/Productivity/productivity/frontend/docs/material-integration/final/tasks-430.jpg) | [Open Tasks](http://localhost:8082/review?screen=tasks&width=390) |
| Base | [Base 390](/Users/owensegala/Productivity/productivity/frontend/docs/material-integration/final/base-390.jpg) | [Base 430](/Users/owensegala/Productivity/productivity/frontend/docs/material-integration/final/base-430.jpg) | [Open Base](http://localhost:8082/review?screen=base&width=390) |
| Avatar | [Avatar 390](/Users/owensegala/Productivity/productivity/frontend/docs/material-integration/final/avatar-medium-390.jpg) | [Avatar 430](/Users/owensegala/Productivity/productivity/frontend/docs/material-integration/final/avatar-medium-430.jpg) | [Open Avatar](http://localhost:8082/review?screen=avatar&width=390) |
| Shop | [Shop 390](/Users/owensegala/Productivity/productivity/frontend/docs/material-integration/final/shop-390.jpg) | [Shop 430](/Users/owensegala/Productivity/productivity/frontend/docs/material-integration/final/shop-430.jpg) | [Open Shop](http://localhost:8082/review?screen=shop&width=390) |
| Avatar Collapsed | [390](/Users/owensegala/Productivity/productivity/frontend/docs/material-integration/final/avatar-collapsed-390.jpg) | [430](/Users/owensegala/Productivity/productivity/frontend/docs/material-integration/final/avatar-collapsed-430.jpg) | Resize with Wardrobe handle |
| Avatar Expanded | [390](/Users/owensegala/Productivity/productivity/frontend/docs/material-integration/final/avatar-expanded-390.jpg) | [430](/Users/owensegala/Productivity/productivity/frontend/docs/material-integration/final/avatar-expanded-430.jpg) | Resize with Wardrobe handle |
| Profile | [390](/Users/owensegala/Productivity/productivity/frontend/docs/material-integration/final/profile-390.jpg) | [430](/Users/owensegala/Productivity/productivity/frontend/docs/material-integration/final/profile-430.jpg) | [Open Profile](http://localhost:8082/review?screen=account&view=profile&width=390) |
| Premium | [390](/Users/owensegala/Productivity/productivity/frontend/docs/material-integration/final/premium-390.jpg) | [430](/Users/owensegala/Productivity/productivity/frontend/docs/material-integration/final/premium-430.jpg) | [Open Premium](http://localhost:8082/review?screen=account&view=premium&width=390) |
| Login | [390](/Users/owensegala/Productivity/productivity/frontend/docs/material-integration/final/login-390.jpg) | [430](/Users/owensegala/Productivity/productivity/frontend/docs/material-integration/final/login-430.jpg) | [Open Login](http://localhost:8082/review?screen=account&view=login&width=390) |
| Signup | [390](/Users/owensegala/Productivity/productivity/frontend/docs/material-integration/final/signup-390.jpg) | [430](/Users/owensegala/Productivity/productivity/frontend/docs/material-integration/final/signup-430.jpg) | [Open Signup](http://localhost:8082/review?screen=account&view=register&width=390) |
| Onboarding | [390](/Users/owensegala/Productivity/productivity/frontend/docs/material-integration/final/onboarding-390.jpg) | [430](/Users/owensegala/Productivity/productivity/frontend/docs/material-integration/final/onboarding-430.jpg) | [Open Onboarding](http://localhost:8082/review?screen=account&view=onboarding&width=390) |

Additional evidence: [keyboard focus](/Users/owensegala/Productivity/productivity/frontend/docs/material-integration/final/login-keyboard-focus-390.jpg), [confirmation field](/Users/owensegala/Productivity/productivity/frontend/docs/material-integration/final/signup-confirmation-390.jpg), [wardrobe last row](/Users/owensegala/Productivity/productivity/frontend/docs/material-integration/final/avatar-scrolled-390.jpg), [Shop final Outfits](/Users/owensegala/Productivity/productivity/frontend/docs/material-integration/final/shop-outfits-end-390.jpg), [Home footer](/Users/owensegala/Productivity/productivity/frontend/docs/material-integration/final/home-end-390.jpg). Local links require the existing Metro server on 8081 and review proxy on 8082. The framed review page constrains phone width in a desktop window.

## 18. Functionality preserved

This pass changes visual surfaces, layout density and decorative rendering. It does not change backend APIs, Cognito, RevenueCat, Premium/Restore logic, task semantics, Base world mechanics, avatar render/equipment/save behavior, Shop purchase/ownership rules, route names/order, onboarding backend state or domain data models. [Changed-file record](/Users/owensegala/Productivity/productivity/frontend/docs/material-integration/changed-files.md) distinguishes this pass from the dirty worktree present at the start. [Protected-file hash checks](/Users/owensegala/Productivity/productivity/frontend/docs/material-integration/protected-files.json) confirm the pre-existing backend/billing, EAS, environment test, Base route, Shop item purchase component and login/register route changes were left byte-identical.

## 19. Build / deployment / version control

No EAS/native/production build, AWS deployment, RevenueCat change, App Store Connect change, commit or push occurred. Changes remain local and uncommitted for review.
