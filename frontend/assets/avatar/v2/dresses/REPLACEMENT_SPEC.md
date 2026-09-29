# Dress Armhole Correction Plan

The current 1086×1448 flattened dress sprites already align acceptably at the
neck, chest, waist, and skirt on both avatar bodies. The visible defect is the
rear/internal rim painted around each armhole: because a dress renders above the
arms, that rim also renders above the arm and makes the garment look pasted on.

Keep one flattened sprite per dress. Do not create BOY/GIRL or front/back
variants unless a specific dress fails the single-sprite proof described below.

## Required correction

For each dress, erase only the rear/internal armhole rim that should sit behind
the character arm. Preserve the front-facing edge, shoulder straps, front trim,
neckline, chest, waist, skirt, highlights, shadows, decorations, canvas size,
and registration. The erased rear rim must become transparent; the arm itself
then supplies the rear boundary of the opening.

| Dress | Production source | Review-only candidate path |
| --- | --- | --- |
| Starlight | `frontend/assets/avatar/v2/dresses/starlight.png` | `frontend/artwork-candidates/avatar/v2/dresses/starlight-armhole-candidate.png` |
| Forest Ranger | `frontend/assets/avatar/v2/dresses/forest-ranger.png` | `frontend/artwork-candidates/avatar/v2/dresses/forest-ranger-armhole-candidate.png` |
| Frostbound | `frontend/assets/avatar/v2/dresses/frostbound.png` | `frontend/artwork-candidates/avatar/v2/dresses/frostbound-armhole-candidate.png` |
| Teal Wayfarer | `frontend/assets/avatar/v2/dresses/teal-wayfarer.png` | `frontend/artwork-candidates/avatar/v2/dresses/teal-wayfarer-armhole-candidate.png` |
| Crimson Guard | `frontend/assets/avatar/v2/dresses/crimson-guard.png` | `frontend/artwork-candidates/avatar/v2/dresses/crimson-guard-armhole-candidate.png` |
| Royal Vanguard | `frontend/assets/avatar/v2/dresses/royal-vanguard.png` | `frontend/artwork-candidates/avatar/v2/dresses/royal-vanguard-armhole-candidate.png` |
| Royal Bard | `frontend/assets/avatar/v2/dresses/royal-bard.png` | `frontend/artwork-candidates/avatar/v2/dresses/royal-bard-armhole-candidate.png` |
| Harbor Scout | `frontend/assets/avatar/v2/dresses/harbor-scout.png` | `frontend/artwork-candidates/avatar/v2/dresses/harbor-scout-armhole-candidate.png` |
| Verdant Warden | `frontend/assets/avatar/v2/dresses/verdant-warden.png` | `frontend/artwork-candidates/avatar/v2/dresses/verdant-warden-armhole-candidate.png` |
| Celestial Acolyte | `frontend/assets/avatar/v2/dresses/celestial-acolyte.png` | `frontend/artwork-candidates/avatar/v2/dresses/celestial-acolyte-armhole-candidate.png` |

All ten validated candidates were promoted to their existing production paths.
The candidates remain outside the runtime asset tree as reproducible review
artifacts; every production PNG is byte-identical to its corresponding candidate.

## Forest Ranger proof of concept

- Source: `frontend/assets/avatar/v2/dresses/forest-ranger.png`
- Candidate: `frontend/artwork-candidates/avatar/v2/dresses/forest-ranger-armhole-candidate.png`
- Canvas: 1086×1448 RGBA, unchanged
- Source SHA-256: `a7ae50a9bf311a0fa05f18901f9aafcd59652d2294115db341b0cfa14ee39b36`
- Candidate SHA-256: `db0b2c9461c1d0a714f4b6bcd75c5313d254bee4442f4a4d5930b2f2370a3903`
- Changed pixels: 5,367, all cleared to transparent within the two rear-rim
  regions; pixels outside those regions are byte-identical to the source.

The candidate passed local visual checks on BOY and GIRL: the neckline remains
aligned, both arms complete the openings, front trim remains visible in front,
and torso/skirt registration is unchanged. This is a GO for applying the same
localized correction to the remaining nine dresses, one candidate at a time.

## Completed candidate validation

Every candidate is 1086×1448 RGBA. Each edit only clears pixels inside its two
rear-armhole polygons; every pixel outside those polygons is byte-identical to
the production source.

| Dress | Source SHA-256 | Candidate SHA-256 | Pixels cleared |
| --- | --- | --- | ---: |
| Forest Ranger | `a7ae50a9bf311a0fa05f18901f9aafcd59652d2294115db341b0cfa14ee39b36` | `db0b2c9461c1d0a714f4b6bcd75c5313d254bee4442f4a4d5930b2f2370a3903` | 5,367 |
| Starlight | `c0e8d5dda55244f89f9b536d21348d82610d004e43fb871591516a2e8b5dabc1` | `76383b7eb9b7a77b6acbbbdbc84425b10e124aa4dc42767e8ebcf752c2673776` | 7,831 |
| Frostbound | `d796a68efcc5f9f3893dfe144966494e6129fe95456032819eacc0b4de5a74bb` | `0e347c4b1c582aa8de186aa2c8dc808fb8b188b95e7afc531c52880e135a10b2` | 6,047 |
| Teal Wayfarer | `8ca504cf5b237add5437ef90a935b0e77fed0db4883a9fe66a3b2c4d4b530ea2` | `8ec3c60bb85d60a89833099ef3c030a0dbc82e45454d6dbbfaee6d7b8c7990eb` | 7,983 |
| Crimson Guard | `32fd7cffa8be700ed37278208cbe67daedd5add116765534a0b47eeb5c48755c` | `c20585dad5e740def6aa0b6686bdbc62ac565d89b13d495d11e86c0b56fb0130` | 8,803 |
| Royal Vanguard | `a0103fba76a83326235212c9efc9be357cfd2c31c834b7de8a8fddabd80060c9` | `57f4600132fd708434576f83675695c67a3501c9ffd96569b897c2c5478c0954` | 9,910 |
| Royal Bard | `341812ab267bcbbfc8fe5480e89c4de7995a51050584c7c7a46ebe5a34e80492` | `a38e0b00dbf7c1bfa6733f6d0c849b6bcb6fdf394d471c82504dd54d32a0dbd3` | 8,789 |
| Harbor Scout | `b7e71fe99e3f3f4bc0ee674a45ed12591351be55e90b70ce3ed002af38c3c78d` | `be0cd0f0d614c9e5b2032f49a2afcdb1bbe7a49d4175c2929a923610a45f686a` | 12,831 |
| Verdant Warden | `c637290fcf6164c7c1cbf6b0a639829c481c62fb8ab37e5c974e5d89275e8a78` | `b7d67a3c926d480dd13b89ada0b7de4300b946b0e8843e17620a39bcb7b47897` | 7,996 |
| Celestial Acolyte | `883da64362b51c3f86d4e28ea8cd588385db9c6bfcc560717d61c4bcfb109793` | `83182f7257a0ac3d35d68ad3a109b308ab4cca6d7ef0c62571e06dc644aad6f6` | 8,377 |

BOY/GIRL comparison sheets are stored in
`frontend/artwork-candidates/avatar/v2/dresses/comparisons/`. Frostbound and
Harbor Scout use wider dress-specific correction polygons because their rear
trim is wider; neither requires different rendering or split assets.

## Validation and promotion

For every candidate:

1. Confirm 1086×1448 RGBA and byte-identical pixels outside the two armhole edit
   regions.
2. Preview the same sprite on BOY and GIRL with shoulder-cap suppression disabled
   for that proof only.
3. Check the neck, both arm openings, shoulder continuity, torso, waist, skirt,
   hats, hair, bottoms, and boots.
4. The promoted production PNG stays at its existing path. Corrected dresses no
   longer opt into shoulder-cap suppression, allowing the arm to complete each
   opening; the starter tunic retains its separate shoulder-coverage behavior.

The renderer does not need a `clothingBack` layer, body-specific dress sprites,
or a 40-file replacement set for any currently supported dress. A split layer is
an exception only if a future candidate demonstrably cannot preserve a necessary
front edge while removing its rear rim.
