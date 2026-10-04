# Inclusive hairstyle integration — local review

## Imported assets and stable IDs

All sources are in `/Users/owensegala/Downloads/`. Destinations below are relative
to the repository root. Every new PNG is a **byte-for-byte copy**, 1254×1254 RGBA;
no cropping, resampling, rotation, redraw, alpha editing, or re-encoding was done.
The import checksums are pinned in `frontend/tests/inclusive-hairstyles.test.mjs`.

| Display name | Full saved ID | Source filename | Production file |
| --- | --- | --- | --- |
| Close Waves | `avatar-v2/hair/close-waves` | `ChatGPT Image Oct 2, 2026, 11_33_29 PM-1.png` | `frontend/assets/avatar/v2/hair/close-waves.png` |
| Tapered Coils | `avatar-v2/hair/tapered-coils` | `ChatGPT Image Oct 2, 2026, 11_33_30 PM-2.png` | `frontend/assets/avatar/v2/hair/tapered-coils.png` |
| Cornrows | `avatar-v2/hair/cornrows` | `ChatGPT Image Oct 2, 2026, 11_33_31 PM-3.png` | `frontend/assets/avatar/v2/hair/cornrows.png` |
| Loc Updo | `avatar-v2/hair/loc-updo` | `ChatGPT Image Oct 2, 2026, 11_33_32 PM-4.png` | `frontend/assets/avatar/v2/hair/loc-updo.png` |
| Two Strand Twists | `avatar-v2/hair/two-strand-twists` | `ChatGPT Image Oct 2, 2026, 11_33_32 PM-5.png` | `frontend/assets/avatar/v2/hair/two-strand-twists.png` |
| Rounded Curls | `avatar-v2/hair/rounded-curls` | `ChatGPT Image Oct 2, 2026, 11_33_40 PM-1.png` | `frontend/assets/avatar/v2/hair/rounded-curls.png` |
| Box Braids | `avatar-v2/hair/box-braids` | `ChatGPT Image Oct 2, 2026, 11_33_41 PM-2.png` | `frontend/assets/avatar/v2/hair/box-braids.png` |
| Twin Puffs | `avatar-v2/hair/twin-puffs` | `ChatGPT Image Oct 2, 2026, 11_33_41 PM-3.png` | `frontend/assets/avatar/v2/hair/twin-puffs.png` |
| Bantu Knots | `avatar-v2/hair/bantu-knots` | `ChatGPT Image Oct 2, 2026, 11_33_42 PM-4.png` | `frontend/assets/avatar/v2/hair/bantu-knots.png` |
| Half Up Twists | `avatar-v2/hair/half-up-twists` | `ChatGPT Image Oct 2, 2026, 11_33_43 PM-5.png` | `frontend/assets/avatar/v2/hair/half-up-twists.png` |

The original ten IDs, their ordering, framing, and the default
`avatar-v2/hair/windblown-layers` are unchanged by this integration.

## Rendering and neutralization

The supplied art is brown, not neutral grayscale. It is neutralized **at render
time**, without generating another set of PNGs. In `avatarTintMatrix`, hair uses
`L = 0.2126R + 0.7152G + 0.0722B`, then
`(Rout, Gout, Bout) = L × selected hair tint channels`; `Aout = Ain`.
This runs in the renderer's existing filter working space. Equal-channel
grayscale inputs produce the same output as the previous diagonal matrix
(tested for every gray value and hair swatch). The skin and eye branches are
unchanged. There is no extra shadow lift or highlight floor.

No beads, bands, bows, wraps, clips, or other discrete accessory pixels were
identified in these ten inputs, so no untinted accessory layers were added.
Authored scalp/parting-like pixels remain part of the supplied hair texture and
follow the hair color; separate skin-colored scalp masks are not provided.

Registry entries reuse `framedHair`, the existing front/drape layers, front
fringe clip, and hat clips, except Box Braids: like Curtain Bob it uses one
complete front sprite to preserve the authored opening and strands. The entire
source canvas is preserved. Only new hairstyles receive new calibration:

| Slug | Source anchor | Runtime X/Y scale | Target anchor |
| --- | --- | --- | --- |
| close-waves | 628,674 | 0.196,0.15 | 627,110 |
| tapered-coils | 628,725 | 0.18816,0.15936 | 627,110 |
| cornrows | 628,529 | 0.2352,0.17472 | 627,110 |
| loc-updo | 628,615 | 0.38,0.26 | 627,110 |
| two-strand-twists | 628,350 | 0.39,0.245 | 627,110 |
| rounded-curls | 628,526 | 0.34,0.29 | 627,110 |
| box-braids | 628,226 | 0.40,0.40 | 627,88 |
| twin-puffs | 628,560 | 0.40,0.31 | 627,94 |
| bantu-knots | 628,518 | 0.30,0.243 | 627,110 |
| half-up-twists | 628,475 | 0.39,0.30 | 627,110 |

The same hairstyle frames are used on BOY and GIRL. No body geometry, dress fit,
existing hairstyle placement, or PNG pixels were changed by this integration.

### October 4 fit correction, revised after reference review

The first reduction was still too large in the user's app. This revision makes
Close Waves and Tapered Coils another 7.5% narrower; Cornrows another 8.2%
narrower; Bantu Knots another 9.1% narrower. Heights also shrink 7.4–9.0%.
Source anchors and target hairlines remain fixed.

A subsequent fit refinement reduces only Tapered Coils and Cornrows by another
4% on both axes, keeping their proportions and hairline anchors unchanged.

The Box Braids source PNG was never altered: its SHA-256 remains
`012ab2a572002e95a42b4a70643c71026f7aaad535d0e08e9af0c5aea2d59918`,
identical to the supplied Downloads file. Its previous 0.43×0.29 transform
stretched the hairstyle wider than it was tall. Generic fringe clipping cut
braids off beside the eyes, and the subsequent curved mask still concealed
authored strands. Both approaches are superseded.

Box Braids now renders the entire 1254×1254 image once on `hairFront`, without
any style-specific clipping, face mask, or rear copy. Its destination is
`[375.8, -2.4, 501.6, 501.6]`: uniform 0.4 scaling, 7% narrower than before,
with the source aspect ratio and full braid length restored. Face-framing
strands may naturally overlap the outer face, as in the reference, but no
strands end at a synthetic flat/curved fringe boundary. Existing equipped-hat
clipping still applies; hair-color selection remains unchanged.

The now-unused custom-fringe parameter was removed from the shared helper.
Other hairstyle transforms/clips and all PNGs, colors, body geometry, dress
frames, persistence fields, and backend files are unchanged in this correction.
Add `&detail` for enlarged previews; its taller view includes the complete braid
ends. Pass comma-separated slugs in `style` to compare the five corrected styles.
Browser SVG checks do not replace native-app review.

## Selection and persistence

The canonical frontend list and backend shared API allowlist now contain the
same 20 IDs. Backend change: only `backend/layers/api-shared/nodejs/appearance.mjs`;
no new profile fields, storage shape, API endpoint, or contract.

The existing shared editor displays 20 wrapping hairstyle choices, with a
44-point minimum height, radio labels/checked state, and a selected-name live
region. It is still inside the existing scrollable onboarding/edit flow.

Local tests cover selecting every new ID, PATCH `/me`, saving, closing/reopening,
per-user cache separation, a fresh cache module, clearing cache, and restoring
from a simulated server response. Browser QA also checked keyboard selection,
save/reopen/reload against a **local mock profile**, plus 320/768/1024/1440-width
layouts. These are not live Cognito/AWS or physical-device checks.

**Deployment dependency:** the allowlist edit is local only. An unchanged live
backend still rejects the new IDs. End-to-end live persistence must wait for a
separately authorized backend release; no AWS access or deployment was made.

## Reproducible visual review

From the frontend directory:

```sh
node scripts/preview-hairstyles.cjs
```

Open `http://127.0.0.1:8771/`. The default contact page shows all ten new styles
on both bodies with `skin_01`, `skin_08`, and `skin_16`. The script imports the
real `AvatarRenderer`, `CharacterSpriteLayers`, registry, filters, and clips;
it only adapts native primitives to browser SVG/DOM and zooms the preview
viewBox to the head/shoulders. It does not duplicate placement geometry or
call any account/API service. It is not an iOS/Android render certification.

Useful query examples:

- `/?body=GIRL&tone=skin_08` — ten-style sheet on GIRL.
- `/?style=rounded-curls&body=BOY&colors=all` — all 20 hair colors.
- `/?style=box-braids&body=GIRL&colors=black,brown,blonde,purple` — selected colors.
- `/?body=GIRL&tone=skin_08&hat=starlight-hat` — cap comparison.
- `/?body=BOY&tone=skin_16&hat=frostbound-hat` — hood comparison.
- `/?body=GIRL&tone=skin_01&hat=celestial-acolyte-hat` — open circlet comparison.

Visual checks performed:

- All ten on both bodies, light/medium/deep skin: aligned hairlines, visible
  faces, retained texture, no body repositioning. Close-cut widths and the
  Box Braids/Twin Puffs crown anchors were calibrated during this review.
- All 20 colors on existing Side Swept Layers, Rounded Curls, Box Braids, and
  Loc Updo; black/brown/light/fantasy colors respond and retain texture.
- All ten with Starlight cap, Frostbound hood, and Celestial Acolyte circlet.
  Open circlet and compact styles are usable in the browser preview.
- Existing closed-hat clips can make horizontal cut edges on wide/long hair:
  especially Two Strand Twists/Twin Puffs beside a cap, and Box Braids below
  the Frostbound hood. There is no per-style hat-compatibility metadata today.
  No new compatibility system, shrinking, or blanket hiding was introduced.
- Light hair swatches remain relatively dark/muted on the supplied dark art;
  blonde/platinum are not a bright bleach-blonde result. The original shading
  was preserved rather than applying an unrequested texture-lightening pass.
- Scalp-like parting artwork and dense strand texture need native enlarged
  review, particularly against very deep skin. No separate scalp mask exists.

## Files changed by this integration

- Ten imported PNGs listed above; this report; `frontend/assets/ASSET_INVENTORY.md`.
- `frontend/src/avatar/appearance.ts`: append ten IDs only.
- `frontend/src/avatar/assetRegistry.ts`: ten new framed entries only.
- `frontend/src/avatar/colorize.ts`: shared hair RGB neutralization.
- `frontend/src/components/AppearanceEditor.tsx`: hairstyle name/labels and targets.
- `backend/layers/api-shared/nodejs/appearance.mjs`: canonical allowlist additions.
- `backend/tests/avatar-appearance.test.mjs`: 20 IDs, frontend parity, profile roundtrip.
- `frontend/tests/avatar-appearance.test.mjs`, `avatar-wardrobe.test.mjs`,
  `asset-integration.test.mjs`: counts, old IDs/default, and color invariants.
- `frontend/tests/appearance-editor.test.mjs`: new-hair save/reopen and accessible picker tests.
- `frontend/tests/inclusive-hairstyles.test.mjs`: imports, both-body renderer wiring,
  neutralization, hat metadata, and per-user reload/login simulations.
- `frontend/scripts/preview-hairstyles.cjs`: local visual QA only.
- `frontend/scripts/validate-avatar-layers.js`: scan all original hair PNGs too,
  so directly registered sprites such as Box Braids cannot escape validation.

Pre-existing uncommitted skin-palette, GIRL head/thigh, editor-close, and skin
swatch accessibility changes were retained, not reverted or attributed to this
hairstyle integration. `frontend/app/(tabs)/avatar.tsx` was already modified and
was not edited for this integration.

## Validation and decision

Frontend: `node --test` (108 passing), `npx tsc --noEmit`, `npm run lint`,
`npm run validate:avatar-assets` (143 sprites), `npm run audit:assets` (271
images), preview syntax check, and `git diff --check`.
Backend: `node --test` (191 passing). No network/live integration run.

**GO for live/device visual review; not unconditional production sign-off.**
Review the closed-hat combinations and muted light colors before approving
those looks. Live save/login remains unverified until the matching allowlist
is released through a separately authorized workflow. No commit or push.
