# LifeXP Character Asset Pack v2

Characters render on a shared 1254 × 1254 coordinate system. Source PNGs retain
their original dimensions and transparency.

- `body/` contains the modular neutral character body.
- `body-girl/` contains the second modular character: a 1254 × 1254 head,
  1086 × 1448 torso, and 1024 × 1536 limbs.
- `dresses/` contains ten original 1086 × 1448 outfit PNGs.
- `backgrounds/` contains full-canvas scenes used by the avatar stage and
  wardrobe previews.
- `hair/`, `hats/`, `tops/`, `bottoms/`, `boots/`, `pets/`, and `auras/` contain
  item art used by wardrobe cards. The ten illustrated trousers in `bottoms/`
  and ten boot pairs in `boots/` preserve the supplied PNGs, including their
  transparent margins.
- `aligned/` contains the shared-canvas sprites used by the character renderer.
  Their transparent padding is part of the asset contract: do not crop it.

Every runtime character sprite must be an 8-bit RGBA PNG. Prealigned sprites
must remain exactly 1254 × 1254, with the same pose, center line, and ground point
as the sprites in `body/`. They render across the complete shared canvas. Source
artwork that is not prealigned must register an explicit `frame` (source crop
and destination rectangle in canvas pixels) in `src/avatar/assetRegistry.ts`.
The renderer scales those coordinates with the canvas on every screen size.
`previewCrop` uses the same source bounds for contained wardrobe/shop previews.

The trousers added in September 2026 use a shared waist at y=568, cuffs at
y=1104, and center line at x=627. Tops and boots retain their normal layer
priority above the trousers. Their original image files are copied unchanged;
all framing is performed by the app.

Each supplied boot pair is registered with source cuff measurements. The
renderer scales and leans each shoe independently onto the matching character
foot, keeping the soles level. When trousers and boots are both equipped, the
trouser image is clipped and smoothly tapered into each boot opening so no
fabric or bare-leg wedge shows through the shaft. Wardrobe and shop cards show
the complete pair using a combined `previewCrop`.

Hats use the same source-frame approach. Cap, hood, and circlet masks keep the
face and hair opening clean; ponytails render as a separate behind-the-hat
piece so the tail is not chopped at the crown. Cap masks preserve the lower
side locks so bobs do not acquire a horizontal notch below the brim.

Hair fits are registered against the neutral head and its ears, not the outer
bounds of the artwork. Short styles split the crown/fringe from the rear nape
so the jaw covers the rear strands. Long hair uses `hairDrape` between clothing
and the head: braids and shoulder-length tips remain over the outfit while the
ears and jaw stay in front. The ponytail has an independent rear tail and ear
openings in its front curls. Its crown overlaps the split to avoid a scalp seam.
Twin braids are enlarged around the ear anchors; long shag is shortened and
raised to fit the same head. The original source PNGs remain unchanged.

Both body choices share head, ear, shoulder, waist and foot landmarks, so every
hairstyle and clothing item is available to either character. The girl head uses
three source bands to align the crown, ears/jaw and neck without moving the eyes.
Its limb silhouettes clip away the source artwork's brown glow using SVG paths;
the PNGs are unchanged. Regenerate the copied assets and silhouette metadata with
`python scripts/import-girl-wardrobe.py /path/to/Downloads` (requires Pillow).

Dresses occupy the TOP slot. Collar, bodice and skirt source bands fit the
shoulders, waist and hem independently. While a dress is worn, rendering hides
the starter torso outside its neckline, upper legs and equipped trousers. The
saved trousers remain selected and reappear when switching back to a top. Boots
stay underneath the skirt. No clothing is filtered by body type.

Run `npm run validate:avatar-assets` from the frontend folder after adding or
changing any runtime sprite.

Items that wrap around the character need separate full-canvas PNGs. For
example, a cape should register `capeBack` and `capeFront` sprites in
`src/avatar/assetRegistry.ts`. Both files still use the same 1254 × 1254 canvas;
only their visible pixels differ.
