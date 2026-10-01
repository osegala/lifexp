# Dress Armhole Artwork Replacement Contract

The current flattened dress sprites use one shared 1086×1448 RGBA image per
dress. Their collar, bodice, and skirt source frames already map into the avatar
canvas independently. Keep that stable pipeline.

The corrected artwork at the existing production paths now removes the
rear-armhole rims:

- `frontend/assets/avatar/v2/dresses/starlight.png`
- `frontend/assets/avatar/v2/dresses/forest-ranger.png`
- `frontend/assets/avatar/v2/dresses/frostbound.png`
- `frontend/assets/avatar/v2/dresses/teal-wayfarer.png`
- `frontend/assets/avatar/v2/dresses/crimson-guard.png`
- `frontend/assets/avatar/v2/dresses/royal-vanguard.png`
- `frontend/assets/avatar/v2/dresses/royal-bard.png`
- `frontend/assets/avatar/v2/dresses/harbor-scout.png`
- `frontend/assets/avatar/v2/dresses/verdant-warden.png`
- `frontend/assets/avatar/v2/dresses/celestial-acolyte.png`

The replacements preserve the filenames and 1086×1448 RGBA canvas. Their
rear/internal armhole rims are removed while the front trim remains. Validate
future artwork through the exact collar/bodice/skirt runtime transforms on
both BOY and GIRL before promotion.

No runtime armhole mask, body-specific dress rig, source-pixel clearing script,
or global shoulder clip is part of this contract. `fullOutfit` remains the only
dress-only body treatment: it hides the torso/neck behind the dress opening,
hides ordinary bottoms, and limits bare legs below the skirt. Base bodies and
ordinary tops do not opt into that behavior.
