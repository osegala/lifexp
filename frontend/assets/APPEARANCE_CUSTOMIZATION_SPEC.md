# Avatar Appearance Customization Asset Specification

## Scope

This document is an audit and production-art manifest for adding persistent skin,
hair, and eye color selection to the Evrenthia avatar. It does not authorize
recoloring the existing PNGs in place or adding an unverified runtime filter.

The audit covers the files registered by
`frontend/src/avatar/assetRegistry.ts`, the shared 1254 × 1254 character canvas,
the source framing in `frontend/src/avatar/spriteLayout.ts`, and the current
`AvatarRenderer`/`CharacterSpriteLayers` render path.

## 1. Summary

| Area | Safe to tint current art directly? | Finding | Required preparation |
| --- | --- | --- | --- |
| Skin | No | Skin color is baked into every body source. The heads also contain facial features, the torsos contain white underclothes, and the BOY legs contain white shorts. GIRL limbs additionally contain a brown source glow that is removed at runtime by silhouette clips. | Create a neutral grayscale skin layer and an untinted detail layer for every registered body source. |
| Eyes | No | Both irises are baked into the corresponding head PNG along with pupils, highlights, whites, outlines, lashes, brows, and skin. | Create an iris-only grayscale mask and a separate untinted eye-detail layer for each head source. |
| Hair | No | Hair is already separate from the body and hats, but every registered render source is painted brown with baked multitone shading. `twin-braids.png` also contains red bows. | Create one neutral grayscale render source per registered hairstyle. Create a separate untinted bow layer for Twin Braids. |

No current source should be passed through a blanket `tintColor`, color matrix,
or whole-image shader. Doing so would recolor clothing, facial features, eye
details, or hair accessories and would not have a predictable result across web,
iOS, and Android.

## Current rendering and alignment contracts

- `CHARACTER_CANVAS` is 1254 × 1254. `CharacterSpriteLayers` renders an SVG
  `viewBox="0 -64 1254 1318"`.
- BOY body sprites are already registered on the full 1254 × 1254 canvas and
  have no `SpriteFrame` transform.
- GIRL source art is not a uniform canvas set. The head is 1254 × 1254, the
  torso is 1086 × 1448, and each limb is 1024 × 1536. These sources are cropped,
  scaled, positioned, and sometimes sheared by exact `sourceFrame` metadata.
- The GIRL head is one file reused as three independently framed sprites:
  `neck`, `head`, and `crown`. Any replacement for that source must support all
  three crops without moving a pixel.
- The GIRL limb `sourceClipPath` values in
  `frontend/assets/avatar/v2/body-girl/silhouettes.json` remove the painted
  brown glow around the limb. New layers must remain compatible with those paths.
- Six short/medium hairstyles use the same aligned source twice as `hairBack`
  and a clipped `hairFront`. Curtain Bob is a single `hairFront` source.
- High Ponytail, Twin Braids, and Long Shag render directly from their original
  1254 × 1254 sources through explicit `framedHair` crop/placement metadata.
- Hat compatibility depends on the existing `hairClip` paths. High Ponytail
  also depends on its `hairPart: "ponytail"` sprite and the current
  `translate(-12 55)` tuck behavior.
- All new runtime art must remain 8-bit RGBA PNG. Transparent padding is part of
  the asset contract and must not be trimmed.

## Asset authoring contract

Every target listed below must:

1. retain the source image's exact pixel dimensions and coordinate origin;
2. retain the source artwork's exact registration—no crop, resize, recenter,
   rotation, or padding change;
3. use transparent pixels outside its declared region;
4. preserve antialiased edges without leaking the original skin, iris, or hair
   color into those edges;
5. preserve the original luminance and shading in a neutral grayscale layer;
6. keep outlines, clothing, facial features, pupils, highlights, eye whites,
   lashes, brows, lips, nails, and accessories in the untinted detail layer;
7. be reviewed composited over both light and dark backgrounds before runtime
   work begins.

`neutral_grayscale_replacement` means a tintable grayscale layer containing only
the pixels whose color is allowed to change. `separate_detail_layer` means a
full-size RGBA layer containing the original untinted details. A source needing
both outputs lists both exact paths.

## 2. Exact asset manifest

### Skin source manifest

| Category | Body type | Source asset path | Source dimensions | Current usage / role | Safe to tint directly | Required new asset type | Required target asset path | Alignment requirements | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| skin | BOY | `frontend/assets/avatar/v2/body/head.png` | 1254 × 1254 | `bodyFront`, region `head`; full shared canvas | no | `neutral_grayscale_replacement` + `separate_detail_layer` | `frontend/assets/avatar/v2/appearance/skin/boy/head-neutral.png`<br>`frontend/assets/avatar/v2/appearance/skin/boy/head-details.png` | Pixel-identical 1254 canvas placement; no frame | Neutral layer contains skin shading only. Detail layer contains brows, nose/mouth details, non-eye linework, and any other non-skin pigment. Eye outputs are listed separately. |
| skin | BOY | `frontend/assets/avatar/v2/body/neck.png` | 1254 × 1254 | `baseBody`, region `neck`; alpha is limited to the neck even though hidden RGB data contains the source head | no | `neutral_grayscale_replacement` + `separate_detail_layer` | `frontend/assets/avatar/v2/appearance/skin/boy/neck-neutral.png`<br>`frontend/assets/avatar/v2/appearance/skin/boy/neck-details.png` | Preserve the current neck alpha placement on the shared canvas | Do not expose or copy hidden RGB pixels outside the registered neck alpha. Detail layer keeps outline/collar-edge details untinted. |
| skin | BOY | `frontend/assets/avatar/v2/body/torso.png` | 1254 × 1254 | `baseBody`, region `torso`; contains exposed skin and white starter underclothes | no | `neutral_grayscale_replacement` + `separate_detail_layer` | `frontend/assets/avatar/v2/appearance/skin/boy/torso-neutral.png`<br>`frontend/assets/avatar/v2/appearance/skin/boy/torso-details.png` | Pixel-identical shared-canvas placement | Neutral layer must contain only exposed neck/shoulder/skin regions. White tank/shorts and their shading stay in details. |
| skin | BOY | `frontend/assets/avatar/v2/body/left-arm.png` | 1254 × 1254 | `bodyBack`, region `upperArmLeft`; includes arm and hand | no | `neutral_grayscale_replacement` + `separate_detail_layer` | `frontend/assets/avatar/v2/appearance/skin/boy/left-arm-neutral.png`<br>`frontend/assets/avatar/v2/appearance/skin/boy/left-arm-details.png` | Pixel-identical shared-canvas placement | Detail layer preserves outlines, fingers, nails, and highlights that must not be hue-shifted. |
| skin | BOY | `frontend/assets/avatar/v2/body/right-arm.png` | 1254 × 1254 | `bodyBack`, region `upperArmRight`; includes arm and hand | no | `neutral_grayscale_replacement` + `separate_detail_layer` | `frontend/assets/avatar/v2/appearance/skin/boy/right-arm-neutral.png`<br>`frontend/assets/avatar/v2/appearance/skin/boy/right-arm-details.png` | Pixel-identical shared-canvas placement | Same separation rules as the left arm. |
| skin | BOY | `frontend/assets/avatar/v2/body/left-leg.png` | 1254 × 1254 | `bodyBack`, region `upperLegLeft`; includes white shorts at the thigh | no | `neutral_grayscale_replacement` + `separate_detail_layer` | `frontend/assets/avatar/v2/appearance/skin/boy/left-leg-neutral.png`<br>`frontend/assets/avatar/v2/appearance/skin/boy/left-leg-details.png` | Pixel-identical shared-canvas placement; retain foot/ground registration | White shorts and hem stay entirely in details. Neutral layer covers only exposed leg/foot skin. |
| skin | BOY | `frontend/assets/avatar/v2/body/right-leg.png` | 1254 × 1254 | `bodyBack`, region `upperLegRight`; includes white shorts at the thigh | no | `neutral_grayscale_replacement` + `separate_detail_layer` | `frontend/assets/avatar/v2/appearance/skin/boy/right-leg-neutral.png`<br>`frontend/assets/avatar/v2/appearance/skin/boy/right-leg-details.png` | Pixel-identical shared-canvas placement; retain foot/ground registration | Same separation rules as the left leg. |
| skin | GIRL | `frontend/assets/avatar/v2/body-girl/head.png` | 1254 × 1254 | One source rendered as `neck`, `head`, and `crown` through three frames | no | `neutral_grayscale_replacement` + `separate_detail_layer` | `frontend/assets/avatar/v2/appearance/skin/girl/head-neutral.png`<br>`frontend/assets/avatar/v2/appearance/skin/girl/head-details.png` | Must preserve the complete source registration used by all three head frames listed below | Neutral layer contains skin shading only. Detail layer contains brows, nose/mouth details, non-eye linework, and other non-skin pigment. Eye outputs are separate. |
| skin | GIRL | `frontend/assets/avatar/v2/body-girl/torso.png` | 1086 × 1448 | `baseBody`, region `torso`; framed source containing exposed skin plus white top and shorts | no | `neutral_grayscale_replacement` + `separate_detail_layer` | `frontend/assets/avatar/v2/appearance/skin/girl/torso-neutral.png`<br>`frontend/assets/avatar/v2/appearance/skin/girl/torso-details.png` | Stay 1086 × 1448 and preserve crop `[219,188,868,1294]` to destination `[490.92,244.36,272.58,453.46]` | White top/shorts and their shadows stay in details. Do not convert this source to 1254 × 1254. |
| skin | GIRL | `frontend/assets/avatar/v2/body-girl/left-arm.png` | 1024 × 1536 | `bodyBack`, region `upperArmLeft`; framed and clipped with `silhouettes.json` | no | `neutral_grayscale_replacement` + `separate_detail_layer` | `frontend/assets/avatar/v2/appearance/skin/girl/left-arm-neutral.png`<br>`frontend/assets/avatar/v2/appearance/skin/girl/left-arm-details.png` | Preserve crop `[342,73,799,1502]`, destination `[706.48,289.975,155.38,464.425]`, and existing source silhouette | Remove the brown exterior glow from new visible layers; pixels outside the actual arm/hand must be transparent. Keep hand/nail/outline details untinted. |
| skin | GIRL | `frontend/assets/avatar/v2/body-girl/right-arm.png` | 1024 × 1536 | `bodyBack`, region `upperArmRight`; framed and clipped with `silhouettes.json` | no | `neutral_grayscale_replacement` + `separate_detail_layer` | `frontend/assets/avatar/v2/appearance/skin/girl/right-arm-neutral.png`<br>`frontend/assets/avatar/v2/appearance/skin/girl/right-arm-details.png` | Preserve crop `[283,73,682,1474]`, destination `[411.82,289.975,135.66,455.325]`, and existing source silhouette | Same glow and detail rules as the left arm. |
| skin | GIRL | `frontend/assets/avatar/v2/body-girl/left-leg.png` | 1024 × 1536 | `bodyBack`, region `upperLegLeft`; framed, silhouette-clipped, and sheared | no | `neutral_grayscale_replacement` + `separate_detail_layer` | `frontend/assets/avatar/v2/appearance/skin/girl/left-leg-neutral.png`<br>`frontend/assets/avatar/v2/appearance/skin/girl/left-leg-details.png` | Preserve crop `[397,82,739,1435]`, destination `[597.8,584.15,205.2,623.5]`, silhouette, and `shearX=-0.02` | Exterior glow must not enter either visible layer. Keep foot/toe/nail/outline details untinted. |
| skin | GIRL | `frontend/assets/avatar/v2/body-girl/right-leg.png` | 1024 × 1536 | `bodyBack`, region `upperLegRight`; framed, silhouette-clipped, and sheared | no | `neutral_grayscale_replacement` + `separate_detail_layer` | `frontend/assets/avatar/v2/appearance/skin/girl/right-leg-neutral.png`<br>`frontend/assets/avatar/v2/appearance/skin/girl/right-leg-details.png` | Preserve crop `[381,47,642,1397]`, destination `[465,584.15,156.6,623.5]`, silhouette, and `shearX=-0.045` | Same glow and detail rules as the left leg. |

### Eye source manifest

| Category | Body type | Source asset path | Source dimensions | Current usage / role | Safe to tint directly | Required new asset type | Required target asset path | Alignment requirements | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| eyes | BOY | `frontend/assets/avatar/v2/body/head.png` | 1254 × 1254 | Eye art is baked into the BOY `head` body sprite | no | `mask` + `separate_detail_layer` | `frontend/assets/avatar/v2/appearance/eyes/boy/iris-mask.png`<br>`frontend/assets/avatar/v2/appearance/eyes/boy/eye-details.png` | Pixel-identical with `body/head.png`; full 1254 canvas | Iris mask contains only the two irises and their internal grayscale shading. Eye details contain sclera, pupils, highlights, outlines, lashes, and any eye-adjacent linework. |
| eyes | GIRL | `frontend/assets/avatar/v2/body-girl/head.png` | 1254 × 1254 | Eye art is baked into the GIRL source that is split into neck/head/crown frames | no | `mask` + `separate_detail_layer` | `frontend/assets/avatar/v2/appearance/eyes/girl/iris-mask.png`<br>`frontend/assets/avatar/v2/appearance/eyes/girl/eye-details.png` | Pixel-identical with `body-girl/head.png`; must align under all three registered frames | Only the `head` crop displays the eyes, but the new files must retain the complete source canvas so the existing frame metadata remains valid. |

### Hair render-source manifest

| Category | Body type | Source asset path | Source dimensions | Current usage / role | Safe to tint directly | Required new asset type | Required target asset path | Alignment requirements | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| hair | SHARED | `frontend/assets/avatar/v2/aligned/windblown-layers-hair.png` | 1254 × 1254 | Registered render source for `avatar-v2/hair/windblown-layers`; reused as `hairBack` and clipped `hairFront` | no | `neutral_grayscale_replacement` | `frontend/assets/avatar/v2/appearance/hair/aligned/windblown-layers-neutral.png` | Exact full-canvas alpha and placement; no frame | Preserve compatibility with `SHORT_HAIR_FRINGE_CLIP` and all hat `hairClip` paths. |
| hair | SHARED | `frontend/assets/avatar/v2/aligned/side-swept-layers-hair.png` | 1254 × 1254 | Registered render source for `avatar-v2/hair/side-swept-layers`; `hairBack` + clipped `hairFront` | no | `neutral_grayscale_replacement` | `frontend/assets/avatar/v2/appearance/hair/aligned/side-swept-layers-neutral.png` | Exact full-canvas alpha and placement; no frame | Preserve fringe/nape split and hat clipping. |
| hair | SHARED | `frontend/assets/avatar/v2/aligned/spring-curls-hair.png` | 1254 × 1254 | Registered render source for `avatar-v2/hair/spring-curls`; `hairBack` + clipped `hairFront` | no | `neutral_grayscale_replacement` | `frontend/assets/avatar/v2/appearance/hair/aligned/spring-curls-neutral.png` | Exact full-canvas alpha and placement; no frame | Preserve individual curl transparency and fringe clipping. |
| hair | SHARED | `frontend/assets/avatar/v2/aligned/skyward-spikes-hair.png` | 1254 × 1254 | Registered render source for `avatar-v2/hair/skyward-spikes`; `hairBack` + clipped `hairFront` | no | `neutral_grayscale_replacement` | `frontend/assets/avatar/v2/appearance/hair/aligned/skyward-spikes-neutral.png` | Exact full-canvas alpha and placement; no frame | Preserve spike-edge antialiasing and hat clipping. |
| hair | SHARED | `frontend/assets/avatar/v2/aligned/tousled-layers-hair.png` | 1254 × 1254 | Registered render source for `avatar-v2/hair/tousled-layers`; `hairBack` + clipped `hairFront` | no | `neutral_grayscale_replacement` | `frontend/assets/avatar/v2/appearance/hair/aligned/tousled-layers-neutral.png` | Exact full-canvas alpha and placement; no frame | Preserve fringe/nape split and hat clipping. |
| hair | SHARED | `frontend/assets/avatar/v2/aligned/curtain-bob-hair.png` | 1254 × 1254 | Registered render source for `avatar-v2/hair/curtain-bob`; one `hairFront` sprite | no | `neutral_grayscale_replacement` | `frontend/assets/avatar/v2/appearance/hair/aligned/curtain-bob-neutral.png` | Exact full-canvas alpha and placement; no frame | This style is not currently split into back/front passes; retain its current one-sprite registration. |
| hair | SHARED | `frontend/assets/avatar/v2/hair/high-ponytail.png` | 1254 × 1254 | Preview and framed render source; emitted as ponytail `hairBack`, `hairDrape`, and `hairFront` pieces | no | `neutral_grayscale_replacement` | `frontend/assets/avatar/v2/appearance/hair/framed/high-ponytail-neutral.png` | Preserve bounds `[198,46,1143,1209]`, anchor `[577,680]`, scale `[0.33,0.285]`, and target `[627,187]` | The single new source serves all three clip passes. Preserve `hairPart="ponytail"`, cap tuck behavior, ear openings, and the runtime tail translation. |
| hair | SHARED | `frontend/assets/avatar/v2/hair/twin-braids.png` | 1254 × 1254 | Preview and framed render source; emitted as `hairDrape` and clipped `hairFront`; red bows are baked into the same PNG | no | `neutral_grayscale_replacement` + `separate_detail_layer` | `frontend/assets/avatar/v2/appearance/hair/framed/twin-braids-neutral.png`<br>`frontend/assets/avatar/v2/appearance/hair/framed/twin-braids-details.png` | Both outputs preserve bounds `[269,54,990,1196]`, anchor `[630,548]`, scale `[0.354,0.34]`, and target `[627,188]` | Neutral layer contains hair only. Detail layer contains both red bows and no hair pixels so bows remain untinted. Both layers must follow identical drape/front clipping. |
| hair | SHARED | `frontend/assets/avatar/v2/aligned/feathered-sweep-hair.png` | 1254 × 1254 | Registered render source for `avatar-v2/hair/feathered-sweep`; `hairBack` + clipped `hairFront` | no | `neutral_grayscale_replacement` | `frontend/assets/avatar/v2/appearance/hair/aligned/feathered-sweep-neutral.png` | Exact full-canvas alpha and placement; no frame | Preserve fringe/nape split and hat clipping. |
| hair | SHARED | `frontend/assets/avatar/v2/hair/long-shag.png` | 1254 × 1254 | Preview and framed render source; emitted as `hairDrape` and clipped `hairFront` | no | `neutral_grayscale_replacement` | `frontend/assets/avatar/v2/appearance/hair/framed/long-shag-neutral.png` | Preserve bounds `[179,65,1072,1168]`, anchor `[630,700]`, scale `[0.30,0.255]`, and target `[627,188]` | One neutral source is reused for the drape and front passes. Preserve shoulder drape and hat clipping. |

### Registered preview and reference files that do not require runtime recolor art

These files are included so every file associated with a registered hairstyle is
accounted for. They are not current character-render sources and therefore do
not block the renderer implementation. They may remain fixed-color style
thumbnails. If product design later requires colorized wardrobe cards, create
neutral copies with the same dimensions and registration before tinting them.

| Category | Body type | Source asset path | Source dimensions | Current usage / role | Safe to tint directly | Required new asset type | Required target asset path | Alignment requirements | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| hair | SHARED | `frontend/assets/avatar/v2/hair/windblown-layers.png` | 1254 × 1254 | `previewSource` only | no | `not_needed` | — | Keep unchanged | Runtime uses the aligned source listed above. |
| hair | SHARED | `frontend/assets/avatar/v2/hair/side-swept-layers.png` | 1254 × 1254 | `previewSource` only | no | `not_needed` | — | Keep unchanged | Runtime uses the aligned source listed above. |
| hair | SHARED | `frontend/assets/avatar/v2/hair/spring-curls.png` | 1254 × 1254 | `previewSource` only | no | `not_needed` | — | Keep unchanged | Runtime uses the aligned source listed above. |
| hair | SHARED | `frontend/assets/avatar/v2/hair/skyward-spikes.png` | 1254 × 1254 | `previewSource` only | no | `not_needed` | — | Keep unchanged | Runtime uses the aligned source listed above. |
| hair | SHARED | `frontend/assets/avatar/v2/hair/tousled-layers.png` | 1254 × 1254 | `previewSource` only | no | `not_needed` | — | Keep unchanged | Runtime uses the aligned source listed above. |
| hair | SHARED | `frontend/assets/avatar/v2/hair/curtain-bob.png` | 1254 × 1254 | `previewSource` only | no | `not_needed` | — | Keep unchanged | Runtime uses the aligned source listed above. |
| hair | SHARED | `frontend/assets/avatar/v2/hair/feathered-sweep.png` | 1254 × 1254 | `previewSource` only | no | `not_needed` | — | Keep unchanged | Runtime uses the aligned source listed above. |
| hair | SHARED | `frontend/assets/avatar/v2/aligned/high-ponytail-hair.png` | 1254 × 1254 | Unregistered reference/archive asset | no | `not_needed` | — | Keep unchanged | Runtime intentionally uses framed `hair/high-ponytail.png`. |
| hair | SHARED | `frontend/assets/avatar/v2/aligned/twin-braids-hair.png` | 1254 × 1254 | Unregistered reference/archive asset | no | `not_needed` | — | Keep unchanged | Runtime intentionally uses framed `hair/twin-braids.png`. |
| hair | SHARED | `frontend/assets/avatar/v2/aligned/long-shag-hair.png` | 1254 × 1254 | Unregistered reference/archive asset | no | `not_needed` | — | Keep unchanged | Runtime intentionally uses framed `hair/long-shag.png`. |
| skin | BOY | `frontend/assets/avatar/v2/body/head-neck.png` | 1254 × 1254 | Unregistered composite reference; `head.png` and `neck.png` are the runtime sources | no | `not_needed` | — | Keep unchanged | Do not register or create a mask for this file; use it only to visually verify the combined BOY head and neck. |

## 3. Skin requirements

The required skin outputs are the neutral/detail pairs listed above for all
thirteen registered body sources:

- BOY: head, neck, torso, left arm/hand, right arm/hand, left leg/foot, and
  right leg/foot.
- GIRL: head/neck/crown source, torso, left arm/hand, right arm/hand, left
  leg/foot, and right leg/foot.

The neutral layer must contain only recolorable skin and its grayscale shading.
The detail layer must contain every element that must retain its authored color,
including clothing, outlines, brows, lashes, lips/mouth details, eye details,
nails, and accessory pixels. The two layers must composite to the current source
appearance when the neutral layer uses the approved default skin color.

For GIRL, retain the non-square source dimensions and all registry framing. Do
not export pre-scaled 1254 × 1254 copies. In particular:

- the head layer must survive all three `sourceFrame` crops exactly:
  - neck: source `[200,992,1050,1159]` to destination
    `[520.75,265.16,212.5,55.67]`;
  - face/head: source `[200,615,1050,995]` to destination
    `[520.75,160,212.5,106]`;
  - crown: source `[200,99,1050,615.5]` to destination
    `[520.75,38.055,212.5,122.085]`;
- torso must stay 1086 × 1448;
- limbs must stay 1024 × 1536 and remain compatible with the current
  `silhouettes.json` paths and leg shear transforms.

All skin outputs must have exact dimensions, exact registration, and transparent
pixels outside the intended layer. Skin color must never be applied over
clothing, eyes, eyebrows, lashes, lips, nails, or other authored details.

## 4. Eye requirements

Two source heads require eye separation:

- `frontend/assets/avatar/v2/body/head.png` → BOY iris mask and eye details;
- `frontend/assets/avatar/v2/body-girl/head.png` → GIRL iris mask and eye
  details.

Each `iris-mask.png` must be transparent everywhere except the colored iris
regions. It may use grayscale values inside the iris to retain the painted iris
depth. It must not include pupils, catchlights/specular highlights, sclera,
eyelids, outlines, or lashes.

Each `eye-details.png` must preserve the original pupils, highlights, whites,
outlines, lashes, and other non-recolorable eye pixels. At the approved default
eye color, the iris layer plus the eye-detail layer must visually reproduce the
current eye artwork with no light halo or original-brown edge.

## 5. Hair requirements

The ten registered hairstyle IDs and required runtime outputs are:

| Hairstyle ID | Current runtime source | Logical renderer pieces | Required output |
| --- | --- | --- | --- |
| `avatar-v2/hair/windblown-layers` | `aligned/windblown-layers-hair.png` | `hairBack`, clipped `hairFront` | `appearance/hair/aligned/windblown-layers-neutral.png` |
| `avatar-v2/hair/side-swept-layers` | `aligned/side-swept-layers-hair.png` | `hairBack`, clipped `hairFront` | `appearance/hair/aligned/side-swept-layers-neutral.png` |
| `avatar-v2/hair/spring-curls` | `aligned/spring-curls-hair.png` | `hairBack`, clipped `hairFront` | `appearance/hair/aligned/spring-curls-neutral.png` |
| `avatar-v2/hair/skyward-spikes` | `aligned/skyward-spikes-hair.png` | `hairBack`, clipped `hairFront` | `appearance/hair/aligned/skyward-spikes-neutral.png` |
| `avatar-v2/hair/tousled-layers` | `aligned/tousled-layers-hair.png` | `hairBack`, clipped `hairFront` | `appearance/hair/aligned/tousled-layers-neutral.png` |
| `avatar-v2/hair/curtain-bob` | `aligned/curtain-bob-hair.png` | `hairFront` | `appearance/hair/aligned/curtain-bob-neutral.png` |
| `avatar-v2/hair/high-ponytail` | `hair/high-ponytail.png`, framed | ponytail `hairBack`, `hairDrape`, clipped `hairFront` | `appearance/hair/framed/high-ponytail-neutral.png` |
| `avatar-v2/hair/twin-braids` | `hair/twin-braids.png`, framed | `hairDrape`, clipped `hairFront` | `appearance/hair/framed/twin-braids-neutral.png` plus untinted `twin-braids-details.png` bows |
| `avatar-v2/hair/feathered-sweep` | `aligned/feathered-sweep-hair.png` | `hairBack`, clipped `hairFront` | `appearance/hair/aligned/feathered-sweep-neutral.png` |
| `avatar-v2/hair/long-shag` | `hair/long-shag.png`, framed | `hairDrape`, clipped `hairFront` | `appearance/hair/framed/long-shag-neutral.png` |

Each neutral hair output must preserve the source dimensions, alpha edges,
luminance-based strand shading, and exact current registration. It must contain
no baked brown hue. The Twin Braids bow layer must align with and follow the same
frame and clip passes as the neutral hair layer.

No physical split into front/back PNGs is required for the current styles. The
renderer deliberately reuses each source through clip paths. Creating new split
files would add registration risk without replacing any current requirement.

Hat clips, ear openings, drape ordering, and ponytail tucking remain registry
behavior. The art must not be cropped to those masks; full source pixels and
transparent padding must remain available to the renderer.

## 6. Persistence plan

The current `localAppearance.ts` stores `bodyType` and `hairId` under two global
device keys. That data is neither user-scoped nor portable across devices. The
backend `USER#<sub> / PROFILE` item is already the authoritative profile record,
and its fields are currently flat DynamoDB attributes.

The lowest-risk eventual model is to add validated string fields to that same
PROFILE record:

- `bodyType`
- `hairId`
- `skinColorId`
- `hairColorId`
- `eyeColorId`

No new table or second profile record is needed. `GET /me` should resolve missing
legacy fields to defaults that reproduce today's art. `PATCH /me` should accept
only canonical IDs defined by the backend and should reject raw colors, asset
paths, and paid cosmetic IDs. The final color IDs and palettes should be approved
with the finished neutral/mask artwork before they become an API contract.

The backend profile should always win after authentication. Local storage may
remain only as an optimistic/offline cache, keyed by authenticated Cognito
subject, for example `evrenthia.avatar.<sub>.appearance`. It must never allow one
user's appearance to render for another user on the same device, and account
deletion must remove that user's cached key. A successful server load should
replace stale local values.

## 7. Recommended next implementation order

1. Produce the thirteen skin neutral/detail pairs at the exact paths and source
   geometry in this manifest.
2. Produce the two iris masks and two eye-detail layers, then verify the default
   composite against both current heads at pixel registration.
3. Produce the ten neutral hair render sources and the Twin Braids bow detail
   layer. Do not replace the source previews or archived aligned files.
4. Review every prepared composite on BOY and GIRL with no hat, a cap, a hood,
   and a circlet; also review High Ponytail tucking and long-hair drape.
5. Extend the avatar asset validator to enforce exact dimensions, RGBA format,
   target-file presence, and the required transparency contract.
6. Add the canonical profile fields, server defaults, validation, and `GET/PATCH
   /me` contract using the existing PROFILE item.
7. Replace the global local appearance keys with an authenticated-user-scoped
   cache and make server state authoritative.
8. Register the prepared layers and add renderer color inputs using only the
   approved layer-compositing method. Preserve every current frame and clip.
9. Add swatch-based selection UI and save behavior; do not expose arbitrary
   color input.
10. Test legacy defaults, cross-user isolation, persistence, hats, dresses,
    long-hair drape, Twin Braids bows, and High Ponytail tucking on web, iOS, and
    Android.

## 8. Go / no-go conclusion

**No-go for runtime recoloring today.** The registry and layering system are a
sound foundation, but the current colored PNGs do not provide safe skin, iris,
or neutral hair layers. Implementation should wait until the required art in
this manifest exists and has passed registration/composite review.

Backend persistence can be designed in parallel, but canonical color IDs should
not be shipped or stored until the approved art palette and default composites
are final.
