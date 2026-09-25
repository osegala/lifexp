import { ImageSourcePropType } from "react-native";

export type PathTileMask = number;

export type TerrainTile =
  | "grass"
  | "grass-grass"
  | "grass-flowers"
  | "grass-rocks"
  | "grass-worn";

// Keep every extracted terrain tile statically visible to Metro, even while
// the current base scene uses the precomposed tiled-ground background.
export const TERRAIN_TILE_IMAGES: Record<TerrainTile, ImageSourcePropType> = {
  grass: require("../../assets/base/tiles/grass.png"),
  "grass-grass": require("../../assets/base/tiles/grass-grass.png"),
  "grass-flowers": require("../../assets/base/tiles/grass-flowers.png"),
  "grass-rocks": require("../../assets/base/tiles/grass-rocks.png"),
  "grass-worn": require("../../assets/base/tiles/grass-worn.png"),
};

// Grid-neighbor bits project onto the diamond's shared edges as follows:
// 1=south-west, 2=south-east, 4=north-east, 8=north-west. The generated
// artwork uses those exact edge contacts, so adjacent tiles meet seamlessly.
const PATH_TILE_IMAGES: Record<PathTileMask, ImageSourcePropType> = {
  0: require("../../assets/base/tiles/stone-mask-00.png"),
  1: require("../../assets/base/tiles/stone-mask-01.png"),
  2: require("../../assets/base/tiles/stone-mask-02.png"),
  3: require("../../assets/base/tiles/stone-mask-03.png"),
  4: require("../../assets/base/tiles/stone-mask-04.png"),
  5: require("../../assets/base/tiles/stone-mask-05.png"),
  6: require("../../assets/base/tiles/stone-mask-06.png"),
  7: require("../../assets/base/tiles/stone-mask-07.png"),
  8: require("../../assets/base/tiles/stone-mask-08.png"),
  9: require("../../assets/base/tiles/stone-mask-09.png"),
  10: require("../../assets/base/tiles/stone-mask-10.png"),
  11: require("../../assets/base/tiles/stone-mask-11.png"),
  12: require("../../assets/base/tiles/stone-mask-12.png"),
  13: require("../../assets/base/tiles/stone-mask-13.png"),
  14: require("../../assets/base/tiles/stone-mask-14.png"),
  15: require("../../assets/base/tiles/stone-mask-15.png"),
};

export function getPathTileSource(mask: PathTileMask) {
  return PATH_TILE_IMAGES[mask] ?? PATH_TILE_IMAGES[0];
}

export type DecorationAsset =
  | "barrels"
  | "bench"
  | "bush"
  | "bush-flowers"
  | "campfire"
  | "crate-stack"
  | "flowers-blue"
  | "flowers-white"
  | "lamp-post"
  | "log-pile"
  | "oak-tree"
  | "pine-tree"
  | "planter-flowers"
  | "rock-cluster"
  | "rock-large"
  | "stone-wall"
  | "well"
  | "wood-fence";

export const DECORATION_IMAGES: Record<DecorationAsset, ImageSourcePropType> = {
  barrels: require("../../assets/base/decorations/barrels.png"),
  bench: require("../../assets/base/decorations/bench.png"),
  bush: require("../../assets/base/decorations/bush.png"),
  "bush-flowers": require("../../assets/base/decorations/bush-flowers.png"),
  campfire: require("../../assets/base/decorations/campfire.png"),
  "crate-stack": require("../../assets/base/decorations/crate-stack.png"),
  "flowers-blue": require("../../assets/base/decorations/flowers-blue.png"),
  "flowers-white": require("../../assets/base/decorations/flowers-white.png"),
  "lamp-post": require("../../assets/base/decorations/lamp-post.png"),
  "log-pile": require("../../assets/base/decorations/log-pile.png"),
  "oak-tree": require("../../assets/base/decorations/oak-tree.png"),
  "pine-tree": require("../../assets/base/decorations/pine-tree.png"),
  "planter-flowers": require("../../assets/base/decorations/planter-flowers.png"),
  "rock-cluster": require("../../assets/base/decorations/rock-cluster.png"),
  "rock-large": require("../../assets/base/decorations/rock-large.png"),
  "stone-wall": require("../../assets/base/decorations/stone-wall.png"),
  well: require("../../assets/base/decorations/well.png"),
  "wood-fence": require("../../assets/base/decorations/wood-fence.png"),
};
