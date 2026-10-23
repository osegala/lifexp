# Home mock-fidelity pass

Home keeps its current structure and behavior. This pass uses the approved mock's proportions: a shorter scene, a larger portrait toward the left, resource values beside the torso, and progression inset over the bottom edge of the artwork.

| Measured at 390px | Before | After |
|---|---:|---:|
| Complete hero height | 439px | 360px |
| Character canvas | 288px | 448px |
| Character center relative to screen center | 24px left | 50px left |
| First resource pill top | 81px | 234px |
| Resource HUD right inset | 8px | 20px |
| XP HUD | Separate full-width 39px strip | Inset 38px overlay, 8px from scene bottom |
| Today top | 456px | 376px |
| Today height | 279px | 279px |
| Task-row height | 51px | 51px |
| Today bottom | 735px | 655px |

The character uses the mock's portrait framing: the lower body falls behind the progression HUD and scene edge. The same equipped renderer and all its props remain unchanged. Its existing 320px canvas is scaled locally in Home to 448px; source sprites remain untouched. The portrait starts below the flowing title/header, so safe-area and larger-title spacing still contribute to the hero's height.

The equipped background now has explicit responsive image dimensions. Previously the Home image had absolute positioning without width/height, producing an oversized corner crop on web. It now covers a view at full hero width and 112% hero height, revealing the castle, terraces and garden behind the portrait. The source resolver, error recovery and equipped-background selection are unchanged.

Resource pills retain the same sizes and real dynamic values, placed as a compact vertical stack lower and 20px inward. XP/level/name/progress remain the same values and components; the existing strip is now translucent and inset within the artwork, with no new frame or gold. Today markup, material, padding, task rows and callbacks are byte-identical to the start of this pass.

The fantasy navigation source is byte-identical. A Home-only 14px dark tonal fade above it blends the content edge with the bar. This is decorative, ignores pointer input and is hidden from accessibility; it adds no ornament, texture, glow or gold.

## Comparison and screenshots

[390px mock / before / after](/Users/owensegala/Productivity/productivity/frontend/docs/home-mock-fidelity/comparison-390.jpg) · [430px mock / before / after](/Users/owensegala/Productivity/productivity/frontend/docs/home-mock-fidelity/comparison-430.jpg)

[390×844 Home](/Users/owensegala/Productivity/productivity/frontend/docs/home-mock-fidelity/home-390.jpg) · [430×932 Home](/Users/owensegala/Productivity/productivity/frontend/docs/home-mock-fidelity/home-430.jpg) · [Both widths](/Users/owensegala/Productivity/productivity/frontend/docs/home-mock-fidelity/phone-widths.jpg) · [Live review](http://localhost:8082/review?screen=home&width=390)

The side-by-side review shows a portrait scale and shorter scene closer to the mock, substantially more space above the fold, and a continuous environment/progression edge. The complete unchanged journal ends 125px above the navigation's top at 390px, compared with 45px previously. Actual equipped art, currencies and the canonical three-task preview remain authoritative; the mock's decorative quote and extra example task were not added.

## Files and scope

- [HomeContent.tsx](/Users/owensegala/Productivity/productivity/frontend/src/components/HomeContent.tsx): hero layout, explicit background crop, portrait scale/offset, resource placement, inset progression and local nav blending.
- [Primitives.tsx](/Users/owensegala/Productivity/productivity/frontend/src/components/ui/Primitives.tsx): optional decorative `overlay` slot for ScreenShell, used only by Home. Existing screens retain the exact default content tree when no overlay is supplied.
- [home-redesign.test.mjs](/Users/owensegala/Productivity/productivity/frontend/tests/home-redesign.test.mjs): existing bounded-stage assertion updated from 400px to 360px. Behavioral assertions remain intact.
- This report and local screenshot/measurement/validation evidence under `docs/home-mock-fidelity/`.

No other existing file changed during this pass. Navigation, Avatar, Tasks, Shop, Base, APIs, auth, billing and the character renderer were left intact. There are no new runtime assets or dependencies.

## Validation

- `npm test`: **278 passed**, 0 failed.
- `npx tsc --noEmit`: passed.
- `npm run lint`: passed, 0 warnings.
- `git diff --check`: passed.
- 390×844 and 430×932 web renders: no horizontal overflow or broken images; complete Today journal visible; unchanged 51px row targets; XP HUD within the scene.
- Byte comparison confirms Today markup/styles and navigation source unchanged, and all other initially dirty files preserved.

[Measurements](/Users/owensegala/Productivity/productivity/frontend/docs/home-mock-fidelity/responsive-review.json) · [Validation record](/Users/owensegala/Productivity/productivity/frontend/docs/home-mock-fidelity/validation.json)

Top safe-area padding and the existing bottom content/navigation insets remain. Captures are from Expo Web fixtures; actual native status-bar/device rendering was not exercised. Functionality and data flow are unchanged. No build, deployment, commit or push occurred.
