# Aligned Dress Replacement Contract

The current dress PNGs are 1086×1448 presentation illustrations. Runtime code
splits each image into collar, bodice, and skirt bands, then stretches those
bands into shared avatar coordinates. The source armholes were not authored
against either modular body, and a single flattened image cannot put the back
armhole edge behind an arm while keeping the front garment above it.

These files remain usable for catalog previews, but they should not be treated
as final rig sprites.

## Required replacement assets

Each replacement must be a 1254×1254 transparent RGBA PNG registered to the
existing character canvas. `front` contains the garment area drawn over the
body. `back` contains only collar, shoulder, or armhole elements that must sit
behind the arms. Do not include body pixels in either layer.

| Dress | Existing preview/reference | BOY target layers | GIRL target layers |
| --- | --- | --- | --- |
| Starlight | `starlight.png` | `aligned/boy/starlight-front.png`, `aligned/boy/starlight-back.png` | `aligned/girl/starlight-front.png`, `aligned/girl/starlight-back.png` |
| Forest Ranger | `forest-ranger.png` | `aligned/boy/forest-ranger-front.png`, `aligned/boy/forest-ranger-back.png` | `aligned/girl/forest-ranger-front.png`, `aligned/girl/forest-ranger-back.png` |
| Frostbound | `frostbound.png` | `aligned/boy/frostbound-front.png`, `aligned/boy/frostbound-back.png` | `aligned/girl/frostbound-front.png`, `aligned/girl/frostbound-back.png` |
| Teal Wayfarer | `teal-wayfarer.png` | `aligned/boy/teal-wayfarer-front.png`, `aligned/boy/teal-wayfarer-back.png` | `aligned/girl/teal-wayfarer-front.png`, `aligned/girl/teal-wayfarer-back.png` |
| Crimson Guard | `crimson-guard.png` | `aligned/boy/crimson-guard-front.png`, `aligned/boy/crimson-guard-back.png` | `aligned/girl/crimson-guard-front.png`, `aligned/girl/crimson-guard-back.png` |
| Royal Vanguard | `royal-vanguard.png` | `aligned/boy/royal-vanguard-front.png`, `aligned/boy/royal-vanguard-back.png` | `aligned/girl/royal-vanguard-front.png`, `aligned/girl/royal-vanguard-back.png` |
| Royal Bard | `royal-bard.png` | `aligned/boy/royal-bard-front.png`, `aligned/boy/royal-bard-back.png` | `aligned/girl/royal-bard-front.png`, `aligned/girl/royal-bard-back.png` |
| Harbor Scout | `harbor-scout.png` | `aligned/boy/harbor-scout-front.png`, `aligned/boy/harbor-scout-back.png` | `aligned/girl/harbor-scout-front.png`, `aligned/girl/harbor-scout-back.png` |
| Verdant Warden | `verdant-warden.png` | `aligned/boy/verdant-warden-front.png`, `aligned/boy/verdant-warden-back.png` | `aligned/girl/verdant-warden-front.png`, `aligned/girl/verdant-warden-back.png` |
| Celestial Acolyte | `celestial-acolyte.png` | `aligned/boy/celestial-acolyte-front.png`, `aligned/boy/celestial-acolyte-back.png` | `aligned/girl/celestial-acolyte-front.png`, `aligned/girl/celestial-acolyte-back.png` |

## Registration requirements

- Use the exact 1254×1254 avatar canvas with no runtime crop or rescale.
- Fit each body independently; do not derive the GIRL armholes by stretching the
  BOY artwork or vice versa.
- Preserve the current neckline, waist, and ground anchors.
- Keep transparent openings around exposed neck and arms.
- Paint the rear armhole/collar edge only in `back`; paint the bodice, front
  armhole edge, and skirt in `front`.
- Check both light and dark skin tones so no body or source-color fringe appears.
- Check long hair, hats, boots, and the hidden-bottom behavior before acceptance.

The renderer now supports body-specific sprite definitions. Register each
`back` layer as `clothingBack` with its matching `bodyType`, and each `front`
layer as `upperBody`, `fullOutfit: true`, with the same `bodyType`. Existing
preview PNGs can remain the wardrobe thumbnails.
