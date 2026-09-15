# Base game asset pack

Runtime assets use lowercase kebab-case names and transparent PNGs.

- `buildings/<building>/<building>-level-1..5.png` — one progression set per building.
- `tiles/grass-*.png` — plain, flowered, worn, and rocky ground variants used by the terrain compositor.
- `tiles/stone-mask-00..15.png` — all 16 four-way auto-tile variants used by the road network.
- `decorations/<prop>.png` — individual map props extracted from the decoration sheet.
- `*/source/` — untouched source sheets; these are not loaded by the game.
- `archive/` — supplied art that does not map to a current runtime level.

Run `scripts/build-base-asset-pack.py` with Pillow available to rebuild the
tile and decoration crops. Building image imports are declared statically in
`src/base/buildingAssetRegistry.ts`; tile and prop imports are in
`src/base/mapAssetRegistry.ts` because Metro does not support dynamic paths.

Path tiles use a four-bit isometric-grid connection mask. Moving a building
updates its occupied grid cell, reruns A*, favors
joining existing roads, and selects a tile image from the resulting mask.
