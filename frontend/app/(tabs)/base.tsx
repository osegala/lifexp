import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import * as SecureStore from "expo-secure-store";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Image,
  ImageSourcePropType,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";

import { api, apiError } from "../../src/api/client";
import { apiRoutes } from "../../src/api/routes";
import {
  BASE_BACKGROUND_IMAGES,
  getBuildingImageSource,
} from "../../src/base/buildingAssetRegistry";
import {
  DECORATION_IMAGES,
  DecorationAsset,
  getPathTileSource,
} from "../../src/base/mapAssetRegistry";
import { buildPathNetwork } from "../../src/base/pathNetwork";
import { buildingUpgradeAnnouncement, confirmedBuildingUpgrade, worldToBaseProgress } from "../../src/base/buildingProgress";
import type { BuildingUpgrade } from "../../src/base/buildingProgress";
import BuildingUpgradeFeedback, { BuildingTierArtwork, useBuildingUpgradePresentation } from "../../src/components/BuildingUpgradeFeedback";
import { BaseBuildingPanel, BaseResources } from "../../src/components/BasePanels";
import { useBuildingFeedback } from "../../src/context/CompletionFeedbackContext";
import { BASE_LAYOUT_STORAGE_KEY } from "../../src/storage/localAccountData";
import { colors, radius, spacing, uiTheme as ui } from "../../src/theme/theme";
import {
  BaseProgress,
  BuildingProgress,
  BuildingType,
  UpgradeBuildingResponse,
  WorldResponse,
} from "../../src/types/progression";
import { Gesture, GestureDetector } from "react-native-gesture-handler";

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>["name"];
type BuildingMapLayout = {
  x: number;
  y: number;
  width: number;
  height: number;
};
type MapCamera = {
  zoom: number;
  x: number;
  y: number;
};
type CollisionPoint = {
  x: number;
  y: number;
};
type MapGridCell = {
  u: number;
  v: number;
};
type MapDecorationSpec = {
  asset: DecorationAsset;
  width: number;
  height: number;
  offsetX?: number;
  offsetY?: number;
};
type RelativeDecorationSpec = MapDecorationSpec & {
  du: number;
  dv: number;
};
type MapDecorationPlacement = MapDecorationSpec & {
  key: string;
  cell: MapGridCell;
};
type WebMapEvent = {
  preventDefault?: () => void;
  nativeEvent?: {
    deltaY?: number;
    pageX?: number;
    pageY?: number;
    clientX?: number;
    clientY?: number;
  };
};

const MAP_WIDTH = 2400;
const MAP_HEIGHT = 1400;
const WORLD_WIDTH = 5000;
const WORLD_HEIGHT = 3000;
const MAP_SCALE_REFERENCE_WIDTH = 4000;
const MAP_SCALE_REFERENCE_HEIGHT = 2400;
const WORLD_PLAYABLE_INSET_X = (WORLD_WIDTH - MAP_WIDTH) / 2;
const WORLD_PLAYABLE_INSET_Y = (WORLD_HEIGHT - MAP_HEIGHT) / 2;
const BUILDABLE_DIAMOND = {
  centerX: WORLD_WIDTH / 2,
  centerY: WORLD_HEIGHT / 2,
  radiusX: 2940,
  radiusY: 1522,
};
const MAP_SCALE_REFERENCE_ZOOM = 0.55;
const MIN_MAP_ZOOM = Platform.OS === "web" ? 0.55 : 0.45;
const MAX_MAP_ZOOM = 1.7;
const INITIAL_MAP_ZOOM = 0.7;
const ONE_TILE_BUILDING_WIDTH = 430;
const ONE_TILE_BUILDING_HEIGHT = 390;
const GARDEN_BUILDING_WIDTH = 470;
const GARDEN_BUILDING_HEIGHT = 410;
const MAP_TILE_DIAMOND_WIDTH = 170;
const MAP_TILE_DIAMOND_HEIGHT = 88;
const BUILDING_FOOTPRINT_OFFSETS = [
  { du: 0, dv: 0 },
  { du: -1, dv: 0 },
  { du: 0, dv: 1 },
  { du: -1, dv: 1 },
] as const;
const MAP_GRID_ORIGIN = {
  x: 1217,
  y: 702,
};
const BUILDING_BASE_ANCHOR = {
  xRatio: 0.5,
  yRatio: 0.9,
};
const GARDEN_BASE_ANCHOR = {
  xRatio: 0.5,
  yRatio: 0.84,
};
type BuildingAction = "upgrade" | "enter" | "description";

const BUILDING_META: Record<
  BuildingType,
  { icon: IconName; category: string; color: string; description: string }
> = {
  "Home Base": {
    icon: "home-variant",
    category: "Cleaning",
    color: "#B8904E",
    description: "A comfortable heart for your growing kingdom.",
  },
  Workshop: {
    icon: "hammer-wrench",
    category: "Work",
    color: "#6CA6A0",
    description: "Where focused work turns into ambitious creations.",
  },
  Library: {
    icon: "bookshelf",
    category: "School",
    color: "#9B8352",
    description: "A growing archive of everything you learn.",
  },
  "Training Grounds": {
    icon: "dumbbell",
    category: "Fitness",
    color: "#C77A70",
    description: "A place built by every workout and active choice.",
  },
  Garden: {
    icon: "flower",
    category: "Health",
    color: "#8DAA78",
    description: "A living reminder to care for your health.",
  },
  "Hall of Achievements": {
    icon: "trophy",
    category: "Personal Growth",
    color: "#C9A96A",
    description: "A monument to the person you are becoming.",
  },
};

const BUILDING_MAP_POSITIONS: Record<BuildingType, BuildingMapLayout> = {
  "Hall of Achievements": {
    x: 31,
    y: 10,
    width: 38,
    height: 160,
  },
  Library: {
    x: 10,
    y: 31,
    width: 33,
    height: 132,
  },
  "Training Grounds": {
    x: 54,
    y: 30,
    width: 38,
    height: 154,
  },
  Garden: {
    x: 32,
    y: 49,
    width: 34,
    height: 128,
  },
  "Home Base": {
    x: 13,
    y: 66,
    width: 35,
    height: 146,
  },
  Workshop: {
    x: 52,
    y: 66,
    width: 35,
    height: 144,
  },
};

const WILDERNESS_DECORATIONS: MapDecorationPlacement[] = [
  // North-west woodland: staggered trees with undergrowth, not a perimeter row.
  { key: "wild-nw-pine-1", cell: { u: -8, v: 1 }, asset: "pine-tree", width: 128, height: 160 },
  { key: "wild-nw-pine-2", cell: { u: -7, v: 2 }, asset: "pine-tree", width: 105, height: 138, offsetX: -18 },
  { key: "wild-nw-oak", cell: { u: -7, v: 0 }, asset: "oak-tree", width: 138, height: 148, offsetX: 20 },
  { key: "wild-nw-rock", cell: { u: -6, v: 1 }, asset: "rock-cluster", width: 70, height: 62, offsetX: -22 },
  { key: "wild-nw-bush", cell: { u: -8, v: 0 }, asset: "bush-flowers", width: 72, height: 58, offsetX: 24 },

  // A smaller high ridge creates depth behind the central buildings.
  { key: "wild-north-pine", cell: { u: -4, v: 6 }, asset: "pine-tree", width: 130, height: 166 },
  { key: "wild-north-rock", cell: { u: -4, v: 5 }, asset: "rock-large", width: 78, height: 70, offsetX: 18 },
  { key: "wild-north-flowers", cell: { u: -5, v: 5 }, asset: "flowers-white", width: 48, height: 38 },

  // North-east forest edge is denser at the boundary and thins toward town.
  { key: "wild-ne-pine-1", cell: { u: 0, v: 10 }, asset: "pine-tree", width: 132, height: 168 },
  { key: "wild-ne-oak", cell: { u: 1, v: 10 }, asset: "oak-tree", width: 140, height: 150, offsetX: 16 },
  { key: "wild-ne-pine-2", cell: { u: -1, v: 9 }, asset: "pine-tree", width: 108, height: 142, offsetX: -12 },
  { key: "wild-ne-bush", cell: { u: 1, v: 9 }, asset: "bush", width: 74, height: 60 },
  { key: "wild-ne-rock", cell: { u: 0, v: 9 }, asset: "rock-cluster", width: 68, height: 60, offsetX: 24 },

  // An eastern hedgerow fills the long empty field without becoming a wall.
  { key: "wild-east-pine-1", cell: { u: 5, v: 6 }, asset: "pine-tree", width: 122, height: 156 },
  { key: "wild-east-pine-2", cell: { u: 6, v: 6 }, asset: "pine-tree", width: 104, height: 138, offsetX: 20 },
  { key: "wild-east-bush", cell: { u: 6, v: 5 }, asset: "bush-flowers", width: 76, height: 62 },
  { key: "wild-east-rock", cell: { u: 5, v: 5 }, asset: "rock-large", width: 76, height: 68, offsetX: -18 },
  { key: "wild-east-flowers", cell: { u: 7, v: 5 }, asset: "flowers-blue", width: 50, height: 40 },

  // South-west grove sits well beyond the home path and provides foreground.
  { key: "wild-sw-oak", cell: { u: -1, v: -10 }, asset: "oak-tree", width: 144, height: 152 },
  { key: "wild-sw-pine", cell: { u: -2, v: -10 }, asset: "pine-tree", width: 114, height: 148, offsetX: -18 },
  { key: "wild-sw-bush", cell: { u: 0, v: -10 }, asset: "bush", width: 76, height: 62, offsetX: 20 },
  { key: "wild-sw-rock", cell: { u: -2, v: -9 }, asset: "rock-cluster", width: 72, height: 64 },
  { key: "wild-sw-flowers", cell: { u: -1, v: -9 }, asset: "flowers-white", width: 48, height: 38 },

  // South-east copse balances the scene without mirroring the other clusters.
  { key: "wild-se-oak", cell: { u: 7, v: -1 }, asset: "oak-tree", width: 142, height: 150 },
  { key: "wild-se-pine", cell: { u: 8, v: -1 }, asset: "pine-tree", width: 112, height: 145, offsetX: 18 },
  { key: "wild-se-rock", cell: { u: 7, v: -2 }, asset: "rock-large", width: 82, height: 72, offsetX: -22 },
  { key: "wild-se-bush", cell: { u: 8, v: -2 }, asset: "bush", width: 76, height: 62 },

  // A low southern thicket breaks up the remaining open foreground.
  { key: "wild-south-pine", cell: { u: 4, v: -7 }, asset: "pine-tree", width: 118, height: 152 },
  { key: "wild-south-oak", cell: { u: 5, v: -7 }, asset: "oak-tree", width: 132, height: 142, offsetX: 22 },
  { key: "wild-south-bush", cell: { u: 4, v: -8 }, asset: "bush-flowers", width: 76, height: 62 },
  { key: "wild-south-rock", cell: { u: 5, v: -8 }, asset: "rock-large", width: 76, height: 68, offsetX: -18 },
];

const BUILDING_DECORATION_THEMES: Record<BuildingType, RelativeDecorationSpec[]> = {
  "Home Base": [
    { du: -1, dv: 1, asset: "bench", width: 92, height: 62, offsetX: -14 },
    { du: 1, dv: -1, asset: "lamp-post", width: 48, height: 84 },
    { du: -1, dv: 0, asset: "bush-flowers", width: 74, height: 60 },
    { du: 1, dv: 1, asset: "planter-flowers", width: 88, height: 68 },
    { du: 0, dv: -2, asset: "flowers-white", width: 52, height: 42 },
  ],
  Workshop: [
    { du: 1, dv: 0, asset: "crate-stack", width: 76, height: 66, offsetX: 12 },
    { du: 0, dv: -1, asset: "barrels", width: 72, height: 68 },
    { du: 1, dv: -1, asset: "log-pile", width: 84, height: 52 },
    { du: -1, dv: 1, asset: "campfire", width: 68, height: 62 },
    { du: 2, dv: 0, asset: "wood-fence", width: 108, height: 70 },
  ],
  Library: [
    { du: -1, dv: 0, asset: "bench", width: 92, height: 62 },
    { du: 0, dv: 1, asset: "lamp-post", width: 48, height: 84 },
    { du: -1, dv: 1, asset: "flowers-blue", width: 54, height: 44 },
    { du: 1, dv: -1, asset: "planter-flowers", width: 88, height: 68 },
    { du: -2, dv: 0, asset: "bush-flowers", width: 74, height: 60 },
  ],
  "Training Grounds": [
    { du: 1, dv: 0, asset: "wood-fence", width: 112, height: 72 },
    { du: 1, dv: 1, asset: "rock-cluster", width: 72, height: 64 },
    { du: 0, dv: 1, asset: "barrels", width: 70, height: 66 },
    { du: -1, dv: 0, asset: "campfire", width: 68, height: 62 },
    { du: 0, dv: 2, asset: "crate-stack", width: 74, height: 64 },
  ],
  Garden: [
    { du: -1, dv: 0, asset: "well", width: 94, height: 90 },
    { du: 1, dv: 0, asset: "planter-flowers", width: 92, height: 70 },
    { du: 0, dv: -1, asset: "flowers-blue", width: 56, height: 46 },
    { du: -1, dv: 1, asset: "bench", width: 90, height: 60 },
    { du: 1, dv: -1, asset: "barrels", width: 68, height: 64 },
  ],
  "Hall of Achievements": [
    { du: -1, dv: 0, asset: "lamp-post", width: 50, height: 88 },
    { du: 1, dv: 0, asset: "bush-flowers", width: 78, height: 64 },
    { du: -1, dv: -1, asset: "rock-large", width: 78, height: 70 },
    { du: 1, dv: 1, asset: "planter-flowers", width: 90, height: 68 },
    { du: 0, dv: -2, asset: "bench", width: 92, height: 62 },
  ],
};

const GRID_NEIGHBOR_DIRECTIONS = [
  { du: 0, dv: -1, bit: 1 },
  { du: 1, dv: 0, bit: 2 },
  { du: 0, dv: 1, bit: 4 },
  { du: -1, dv: 0, bit: 8 },
] as const;

const DEFAULT_MAP_CAMERA: MapCamera = { zoom: INITIAL_MAP_ZOOM, x: 0, y: 0 };

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getMapBaseScale(viewport: { width: number; height: number }) {
  // Preserve the established world scale while allowing a wider mobile view.
  return (
    Math.max(
      viewport.width / MAP_SCALE_REFERENCE_WIDTH,
      viewport.height / MAP_SCALE_REFERENCE_HEIGHT,
    ) /
    MAP_SCALE_REFERENCE_ZOOM
  );
}

function getMapPanBounds(
  viewport: { width: number; height: number },
  zoom: number,
) {
  const scale = getMapBaseScale(viewport) * zoom;

  return {
    x: Math.max((WORLD_WIDTH * scale - viewport.width) / 2, 0),
    y: Math.max((WORLD_HEIGHT * scale - viewport.height) / 2, 0),
  };
}

function clampMapCamera(
  camera: MapCamera,
  viewport: { width: number; height: number },
) {
  const bounds = getMapPanBounds(viewport, camera.zoom);

  return {
    zoom: camera.zoom,
    x: clamp(camera.x, -bounds.x, bounds.x),
    y: clamp(camera.y, -bounds.y, bounds.y),
  };
}

function isLegacyPercentLayout(layout: BuildingMapLayout) {
  return layout.x <= 100 && layout.y <= 100 && layout.width <= 100;
}

function getSizedBuildingLayout(
  type: BuildingType,
  layout: BuildingMapLayout,
): BuildingMapLayout {
  const nextWidth =
    type === "Garden" ? GARDEN_BUILDING_WIDTH : ONE_TILE_BUILDING_WIDTH;
  const nextHeight =
    type === "Garden" ? GARDEN_BUILDING_HEIGHT : ONE_TILE_BUILDING_HEIGHT;
  const centerX = isLegacyPercentLayout(layout)
    ? ((layout.x + layout.width / 2) / 100) * MAP_WIDTH
    : layout.x + layout.width / 2;
  const centerY = isLegacyPercentLayout(layout)
    ? (layout.y / 100) * MAP_HEIGHT + layout.height / 2
    : layout.y + layout.height / 2;

  return {
    x: clamp(centerX - nextWidth / 2, 0, MAP_WIDTH - nextWidth),
    y: clamp(centerY - nextHeight / 2, 0, MAP_HEIGHT - nextHeight),
    width: nextWidth,
    height: nextHeight,
  };
}

function getBuildingBaseAnchor(type: BuildingType) {
  return type === "Garden" ? GARDEN_BASE_ANCHOR : BUILDING_BASE_ANCHOR;
}

function pointToMapGridCell(point: CollisionPoint): MapGridCell {
  const halfWidth = MAP_TILE_DIAMOND_WIDTH / 2;
  const halfHeight = MAP_TILE_DIAMOND_HEIGHT / 2;
  const localX = point.x - MAP_GRID_ORIGIN.x;
  const localY = point.y - MAP_GRID_ORIGIN.y;

  return {
    u: Math.round((localX / halfWidth + localY / halfHeight) / 2),
    v: Math.round((localX / halfWidth - localY / halfHeight) / 2),
  };
}

function mapGridCellToPoint(cell: MapGridCell): CollisionPoint {
  const halfWidth = MAP_TILE_DIAMOND_WIDTH / 2;
  const halfHeight = MAP_TILE_DIAMOND_HEIGHT / 2;

  return {
    x: MAP_GRID_ORIGIN.x + (cell.u + cell.v) * halfWidth,
    y: MAP_GRID_ORIGIN.y + (cell.u - cell.v) * halfHeight,
  };
}

function snapPointToMapGrid(point: CollisionPoint): CollisionPoint {
  return mapGridCellToPoint(pointToMapGridCell(point));
}

function getBuildingGridCell(
  type: BuildingType,
  layout: BuildingMapLayout,
): MapGridCell {
  return pointToMapGridCell(getCollisionDiamondCenter(type, layout));
}

function getOccupiedGridCells(
  type: BuildingType,
  layout: BuildingMapLayout,
): MapGridCell[] {
  const origin = getBuildingGridCell(type, layout);

  return BUILDING_FOOTPRINT_OFFSETS.map(({ du, dv }) => ({
    u: origin.u + du,
    v: origin.v + dv,
  }));
}

function gridCellKey(cell: MapGridCell) {
  return `${cell.u}:${cell.v}`;
}

function gridCellsOverlap(a: MapGridCell[], b: MapGridCell[]) {
  const occupied = new Set(a.map(gridCellKey));

  return b.some((cell) => occupied.has(gridCellKey(cell)));
}

function layoutFromBaseCenter(
  type: BuildingType,
  layout: BuildingMapLayout,
  center: CollisionPoint,
): BuildingMapLayout {
  const anchor = getBuildingBaseAnchor(type);

  return clampBuildingLayout({
    ...layout,
    x: center.x - layout.width * anchor.xRatio,
    y: center.y - layout.height * anchor.yRatio,
  });
}

function snapBuildingLayoutToGrid(
  type: BuildingType,
  layout: BuildingMapLayout,
): BuildingMapLayout {
  const center = getCollisionDiamondCenter(type, layout);

  return layoutFromBaseCenter(type, layout, snapPointToMapGrid(center));
}

function getSizedBuildingLayouts(
  layouts: Record<BuildingType, BuildingMapLayout>,
): Record<BuildingType, BuildingMapLayout> {
  return (Object.keys(BUILDING_MAP_POSITIONS) as BuildingType[]).reduce(
    (sizedLayouts, type) => {
      const sizedLayout = getSizedBuildingLayout(
        type,
        layouts[type] ?? BUILDING_MAP_POSITIONS[type],
      );

      return {
        ...sizedLayouts,
        [type]: snapBuildingLayoutToGrid(type, sizedLayout),
      };
    },
    {} as Record<BuildingType, BuildingMapLayout>,
  );
}

function getCollisionDiamondCenter(
  type: BuildingType,
  layout: BuildingMapLayout,
): CollisionPoint {
  const anchor = getBuildingBaseAnchor(type);

  return {
    x: layout.x + layout.width * anchor.xRatio,
    y: layout.y + layout.height * anchor.yRatio,
  };
}

function getCollisionFootprintPolygon(
  type: BuildingType,
  layout: BuildingMapLayout,
): CollisionPoint[] {
  const center = getCollisionDiamondCenter(type, layout);
  const halfWidth = MAP_TILE_DIAMOND_WIDTH;
  const halfHeight = MAP_TILE_DIAMOND_HEIGHT;
  const footprintCenter = {
    x: center.x,
    y: center.y - MAP_TILE_DIAMOND_HEIGHT / 2,
  };

  return [
    { x: footprintCenter.x, y: footprintCenter.y - halfHeight },
    { x: footprintCenter.x + halfWidth, y: footprintCenter.y },
    { x: footprintCenter.x, y: footprintCenter.y + halfHeight },
    { x: footprintCenter.x - halfWidth, y: footprintCenter.y },
  ];
}

function polygonBoundsStyle(
  polygon: CollisionPoint[],
  origin: CollisionPoint,
): ViewStyle {
  const xValues = polygon.map((point) => point.x);
  const yValues = polygon.map((point) => point.y);
  const minX = Math.min(...xValues);
  const maxX = Math.max(...xValues);
  const minY = Math.min(...yValues);
  const maxY = Math.max(...yValues);

  return {
    left: minX - origin.x,
    top: minY - origin.y,
    width: maxX - minX,
    height: maxY - minY,
  };
}

function buildingWouldOverlap(
  type: BuildingType,
  candidate: BuildingMapLayout,
  layouts: Record<BuildingType, BuildingMapLayout>,
) {
  const candidateCells = getOccupiedGridCells(type, candidate);

  return (Object.keys(layouts) as BuildingType[]).some((otherType) => {
    if (otherType === type) {
      return false;
    }

    return gridCellsOverlap(
      candidateCells,
      getOccupiedGridCells(otherType, layouts[otherType]),
    );
  });
}

function clampBuildingLayout(layout: BuildingMapLayout): BuildingMapLayout {
  return {
    ...layout,
    x: clamp(
      layout.x,
      -WORLD_PLAYABLE_INSET_X,
      WORLD_WIDTH - WORLD_PLAYABLE_INSET_X - layout.width,
    ),
    y: clamp(
      layout.y,
      -WORLD_PLAYABLE_INSET_Y,
      WORLD_HEIGHT - WORLD_PLAYABLE_INSET_Y - layout.height,
    ),
  };
}

function isInsideBuildableDiamond(
  type: BuildingType,
  layout: BuildingMapLayout,
) {
  return getOccupiedGridCells(type, layout).every((cell) => {
    const point = mapGridCellToPoint(cell);
    const worldX = point.x + WORLD_PLAYABLE_INSET_X;
    const worldY = point.y + WORLD_PLAYABLE_INSET_Y;

    return (
      Math.abs(worldX - BUILDABLE_DIAMOND.centerX) /
          BUILDABLE_DIAMOND.radiusX +
        Math.abs(worldY - BUILDABLE_DIAMOND.centerY) /
          BUILDABLE_DIAMOND.radiusY <=
      0.97
    );
  });
}

function resolveBuildingMove(
  type: BuildingType,
  target: BuildingMapLayout,
  layouts: Record<BuildingType, BuildingMapLayout>,
) {
  const start = layouts[type];
  const snappedTarget = snapBuildingLayoutToGrid(type, target);

  return buildingWouldOverlap(type, snappedTarget, layouts) ||
    !isInsideBuildableDiamond(type, snappedTarget)
    ? start
    : snappedTarget;
}

function isBuildingLayoutMap(
  value: unknown,
): value is Record<BuildingType, BuildingMapLayout> {
  if (!value || typeof value !== "object") {
    return false;
  }

  return (Object.keys(BUILDING_MAP_POSITIONS) as BuildingType[]).every(
    (type) => {
      const layout = (
        value as Partial<Record<BuildingType, BuildingMapLayout>>
      )[type];

      return (
        Boolean(layout) &&
        typeof layout?.x === "number" &&
        typeof layout?.y === "number" &&
        typeof layout?.width === "number" &&
        typeof layout?.height === "number"
      );
    },
  );
}

async function loadStoredBuildingLayouts() {
  try {
    const stored =
      Platform.OS === "web"
        ? globalThis.localStorage?.getItem(BASE_LAYOUT_STORAGE_KEY)
        : await SecureStore.getItemAsync(BASE_LAYOUT_STORAGE_KEY);

    if (!stored) {
      return null;
    }

    const parsed = JSON.parse(stored) as unknown;
    return isBuildingLayoutMap(parsed) ? parsed : null;
  } catch (error) {
    console.log("Building layout load error:", error);
    return null;
  }
}

async function saveStoredBuildingLayouts(
  layouts: Record<BuildingType, BuildingMapLayout>,
) {
  try {
    const serialized = JSON.stringify(layouts);

    if (Platform.OS === "web") {
      globalThis.localStorage?.setItem(BASE_LAYOUT_STORAGE_KEY, serialized);
      return;
    }

    await SecureStore.setItemAsync(BASE_LAYOUT_STORAGE_KEY, serialized);
  } catch (error) {
    console.log("Building layout save error:", error);
  }
}

function MapViewport({
  image,
  children,
  camera,
  gesture,
  onLayout,
  viewport,
  webHandlers,
}: {
  image: ImageSourcePropType | undefined;
  children: React.ReactNode;
  camera: MapCamera;
  gesture: ReturnType<typeof Gesture.Simultaneous>;
  onLayout: NonNullable<React.ComponentProps<typeof View>["onLayout"]>;
  viewport: { width: number; height: number };
  webHandlers?: Record<string, unknown>;
}) {
  const panStyle = mapPanTransform(camera);
  const scaleStyle = mapScaleTransform(camera, getMapBaseScale(viewport));
  const content = image ? (
    <View style={[styles.mapContentFrame, panStyle]}>
      <View style={[styles.mapContent, scaleStyle]}>
        <Image
          source={image}
          resizeMode="stretch"
          style={styles.mapBackgroundImage}
        />
        {children}
      </View>
    </View>
  ) : (
    <View style={[styles.mapContentFrame, panStyle]}>
      <View style={[styles.mapContent, scaleStyle]}>
        <View style={styles.pathVertical} />
        <View style={styles.pathHorizontal} />
        {children}
      </View>
    </View>
  );

  if (!image) {
    return (
      <GestureDetector gesture={gesture}>
        <View
          style={styles.mapGround}
          onLayout={onLayout}
          {...(webHandlers as React.ComponentProps<typeof View>)}
        >
          {content}
        </View>
      </GestureDetector>
    );
  }

  return (
    <GestureDetector gesture={gesture}>
      <View
        style={styles.mapGround}
        onLayout={onLayout}
        {...(webHandlers as React.ComponentProps<typeof View>)}
      >
        {content}
      </View>
    </GestureDetector>
  );
}

function AnimatedCampfire({
  decoration,
  point,
}: {
  decoration: MapDecorationPlacement;
  point: CollisionPoint;
}) {
  const flicker = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(flicker, {
          toValue: 1,
          duration: 520,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(flicker, {
          toValue: 0,
          duration: 680,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [flicker]);

  return (
    <Animated.Image
      source={DECORATION_IMAGES.campfire}
      resizeMode="contain"
      style={[
        styles.mapDecoration,
        {
          left:
            point.x -
            decoration.width / 2 +
            (decoration.offsetX ?? 0),
          top:
            point.y -
            decoration.height +
            22 +
            (decoration.offsetY ?? 0),
          width: decoration.width,
          height: decoration.height,
          zIndex: Math.round(point.y),
          opacity: flicker.interpolate({
            inputRange: [0, 1],
            outputRange: [0.9, 1],
          }),
          transform: [
            {
              scale: flicker.interpolate({
                inputRange: [0, 1],
                outputRange: [0.97, 1.04],
              }),
            },
          ],
        },
      ]}
    />
  );
}

function mapPanTransform(camera: MapCamera): ViewStyle {
  return {
    transform: [{ translateX: camera.x }, { translateY: camera.y }],
  };
}

function mapScaleTransform(camera: MapCamera, baseScale: number): ViewStyle {
  return {
    transform: [{ scale: baseScale * camera.zoom }],
  };
}

export default function BaseScreen() {
  const [base, setBase] = useState<BaseProgress | null>(null);
  const [selectedBuilding, setSelectedBuilding] =
    useState<BuildingProgress | null>(null);
  const [descriptionOpen, setDescriptionOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const { pending, enqueue: enqueueBuildings, finish: finishBuildings } = useBuildingFeedback();
  const upgrading = useRef(false);
  const [buildingLayouts, setBuildingLayouts] = useState(() =>
    getSizedBuildingLayouts(BUILDING_MAP_POSITIONS),
  );
  const [layoutHydrated, setLayoutHydrated] = useState(false);
  const [mapCamera, setMapCamera] = useState<MapCamera>(DEFAULT_MAP_CAMERA);
  const [mapSize, setMapSize] = useState({ width: 1, height: MAP_HEIGHT });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [upgradeError, setUpgradeError] = useState("");
  // Never consume off-screen, before XP feedback finishes, or against stale map artwork.
  const celebration = focused && !loading && pending?.upgrades.every(upgrade =>
    base?.buildings.some(building => building.buildingId === upgrade.buildingId && building.visualTier >= upgrade.newTier))
    ? pending : undefined;
  const upgradeMotion = useBuildingUpgradePresentation(celebration, finishBuildings);
  const mapCameraRef = useRef(mapCamera);
  const mapPanStart = useRef(DEFAULT_MAP_CAMERA);
  const webPanStart = useRef<{
    pointerX: number;
    pointerY: number;
    camera: MapCamera;
  } | null>(null);
  const buildingDragActive = useRef(false);
  const pinchStartZoom = useRef(mapCamera.zoom);

  mapCameraRef.current = mapCamera;

  const moveBuilding = useCallback(
    (type: BuildingType, layout: BuildingMapLayout) => {
      setBuildingLayouts((current) => {
        const nextLayout = resolveBuildingMove(type, layout, current);

        if (
          nextLayout.x === current[type].x &&
          nextLayout.y === current[type].y
        ) {
          return current;
        }

        return { ...current, [type]: nextLayout };
      });
    },
    [],
  );

  const composedMapGesture = useMemo(() => {
    const panGesture = Gesture.Pan()
      .minDistance(8)
      .runOnJS(true)
      .onBegin(() => {
        mapPanStart.current = mapCameraRef.current;
      })
      .onUpdate((event) => {
        if (buildingDragActive.current) {
          return;
        }

        setMapCamera((current) =>
          clampMapCamera(
            {
              ...current,
              x: mapPanStart.current.x + event.translationX,
              y: mapPanStart.current.y + event.translationY,
            },
            mapSize,
          ),
        );
      });

    const pinchGesture = Gesture.Pinch()
      .runOnJS(true)
      .onBegin(() => {
        pinchStartZoom.current = mapCameraRef.current.zoom;
      })
      .onUpdate((event) => {
        setMapCamera((current) =>
          clampMapCamera(
            {
              ...current,
              zoom: clamp(
                pinchStartZoom.current * event.scale,
                MIN_MAP_ZOOM,
                MAX_MAP_ZOOM,
              ),
            },
            mapSize,
          ),
        );
      });

    return Gesture.Simultaneous(panGesture, pinchGesture);
  }, [mapSize]);

  const webMapHandlers = useMemo(() => {
    if (Platform.OS !== "web") {
      return undefined;
    }

    return {
      onWheel: (event: WebMapEvent) => {
        event.preventDefault?.();
        const deltaY = event.nativeEvent?.deltaY ?? 0;
        const zoomDelta = deltaY > 0 ? 0.92 : 1.08;

        setMapCamera((current) =>
          clampMapCamera(
            {
              ...current,
              zoom: clamp(current.zoom * zoomDelta, MIN_MAP_ZOOM, MAX_MAP_ZOOM),
            },
            mapSize,
          ),
        );
      },
      onStartShouldSetResponder: () => true,
      onMoveShouldSetResponder: () => true,
      onResponderGrant: (event: WebMapEvent) => {
        if (buildingDragActive.current) {
          return;
        }

        webPanStart.current = {
          pointerX: event.nativeEvent?.pageX ?? event.nativeEvent?.clientX ?? 0,
          pointerY: event.nativeEvent?.pageY ?? event.nativeEvent?.clientY ?? 0,
          camera: mapCameraRef.current,
        };
      },
      onResponderMove: (event: WebMapEvent) => {
        if (buildingDragActive.current || !webPanStart.current) {
          return;
        }

        const pointerX =
          event.nativeEvent?.pageX ?? event.nativeEvent?.clientX ?? 0;
        const pointerY =
          event.nativeEvent?.pageY ?? event.nativeEvent?.clientY ?? 0;
        const dragStart = webPanStart.current;

        setMapCamera(() =>
          clampMapCamera(
            {
              ...dragStart.camera,
              x: dragStart.camera.x + pointerX - dragStart.pointerX,
              y: dragStart.camera.y + pointerY - dragStart.pointerY,
            },
            mapSize,
          ),
        );
      },
      onResponderRelease: () => {
        webPanStart.current = null;
      },
      onResponderTerminate: () => {
        webPanStart.current = null;
      },
    };
  }, [mapSize]);

  useEffect(() => {
    let mounted = true;

    loadStoredBuildingLayouts().then((stored) => {
      if (!mounted) {
        return;
      }

      if (stored) {
        setBuildingLayouts(getSizedBuildingLayouts(stored));
      }

      setLayoutHydrated(true);
    });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (layoutHydrated) {
      saveStoredBuildingLayouts(buildingLayouts);
    }
  }, [buildingLayouts, layoutHydrated]);

  useEffect(() => {
    setMapCamera((current) => clampMapCamera(current, mapSize));
  }, [mapSize]);

  const loadBase = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get<WorldResponse>(apiRoutes.world);
      const nextBase = worldToBaseProgress(response.data);
      setLoadError("");
      setBase(nextBase);
      setSelectedBuilding((current) => {
        if (!current) {
          return null;
        }

        return (
          nextBase.buildings.find(
            (building) => building.buildingId === current.buildingId,
          ) ??
          nextBase.buildings[0] ??
          null
        );
      });
      return nextBase;
    } catch (error) {
      const message = apiError(error, "Could not load your world.").message;
      setLoadError(message);
      Alert.alert("World", message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );
  useEffect(() => {
    // Refresh on focus and when newly confirmed upgrades arrive while already focused.
    if (focused) void loadBase();
  }, [focused, pending?.id, loadBase]);

  const sortedBuildings = useMemo(
    () =>
      [...(base?.buildings ?? [])].sort((a, b) => {
        const aCenter = getCollisionDiamondCenter(
          a.type,
          buildingLayouts[a.type],
        );
        const bCenter = getCollisionDiamondCenter(
          b.type,
          buildingLayouts[b.type],
        );

        return aCenter.y === bCenter.y
          ? aCenter.x - bCenter.x
          : aCenter.y - bCenter.y;
      }),
    [base?.buildings, buildingLayouts],
  );

  const pathTiles = useMemo(
    () =>
      buildPathNetwork(
        (Object.keys(buildingLayouts) as BuildingType[]).map((type) =>
          getBuildingGridCell(type, buildingLayouts[type]),
        ),
      ),
    [buildingLayouts],
  );

  const mapDecorations = useMemo(() => {
    const buildingEntries = (Object.keys(buildingLayouts) as BuildingType[]).map(
      (type) => ({ type, cell: getBuildingGridCell(type, buildingLayouts[type]) }),
    );
    const buildingCells = buildingEntries.map(({ cell }) => cell);
    const occupied = new Set([
      ...buildingCells.map(gridCellKey),
      ...pathTiles.map(gridCellKey),
    ]);
    const decorations: MapDecorationPlacement[] = [];

    const place = (placement: MapDecorationPlacement, buildingClearance = 0) => {
      const key = gridCellKey(placement.cell);
      if (occupied.has(key)) return false;
      if (
        buildingClearance > 0 &&
        buildingCells.some(
          (building) =>
            Math.abs(building.u - placement.cell.u) +
              Math.abs(building.v - placement.cell.v) <
            buildingClearance,
        )
      ) {
        return false;
      }

      occupied.add(key);
      decorations.push(placement);
      return true;
    };

    // Give each destination a small, readable story. If its preferred side is
    // occupied by the dynamically generated road, rotate the prop around the
    // building until it finds the next open neighboring cell.
    buildingEntries.forEach(({ type, cell }) => {
      BUILDING_DECORATION_THEMES[type].forEach((spec, index) => {
        const rotations = [
          { du: spec.du, dv: spec.dv },
          { du: -spec.dv, dv: spec.du },
          { du: -spec.du, dv: -spec.dv },
          { du: spec.dv, dv: -spec.du },
        ];

        rotations.some(({ du, dv }, rotation) =>
          place({
            key: `building-${type}-${index}-${rotation}`,
            cell: { u: cell.u + du, v: cell.v + dv },
            asset: spec.asset,
            width: spec.width,
            height: spec.height,
            offsetX: spec.offsetX,
            offsetY: spec.offsetY,
          }),
        );
      });
    });

    // Uneven groves provide a foreground/background frame without tracing a
    // visible ring around the map.
    WILDERNESS_DECORATIONS.forEach((decoration) => place(decoration, 2));

    // A few useful objects sit beside long road segments. They are deliberately
    // sparse and occupy an open neighboring cell rather than covering paving.
    let pathsideCount = 0;
    pathTiles
      .filter((tile) => tile.mask === 5 || tile.mask === 10)
      .sort((a, b) =>
        a.u + a.v === b.u + b.v
          ? a.u - a.v - (b.u - b.v)
          : a.u + a.v - (b.u + b.v),
      )
      .forEach((tile, index) => {
        if (pathsideCount >= 10 || index % 2 !== 1) return;
        const openSides = GRID_NEIGHBOR_DIRECTIONS.filter(
          ({ bit }) => (tile.mask & bit) === 0,
        );
        for (const direction of openSides) {
          const pathsideAssets: DecorationAsset[] = [
            "lamp-post",
            "bench",
            "planter-flowers",
          ];
          const asset = pathsideAssets[pathsideCount % pathsideAssets.length];
          const placed = place(
            {
              key: `pathside-${tile.u}-${tile.v}-${direction.bit}`,
              cell: {
                u: tile.u + direction.du,
                v: tile.v + direction.dv,
              },
              asset,
              width: asset === "lamp-post" ? 46 : 88,
              height:
                asset === "lamp-post"
                  ? 82
                  : asset === "planter-flowers"
                    ? 66
                    : 58,
              offsetX: direction.bit === 1 || direction.bit === 8 ? -10 : 10,
            },
            2,
          );
          if (placed) {
            pathsideCount += 1;
            break;
          }
        }
      });

    return decorations;
  }, [buildingLayouts, pathTiles]);

  if (loading && !base) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator size="large" color={ui.colors.primary} accessibilityLabel="Loading world" />
        <Text style={styles.loadingText}>Building your kingdom...</Text>
      </View>
    );
  }

  async function handleBuildingAction(
    action: BuildingAction,
  ) {
    if (!selectedBuilding) {
      return;
    }

    if (action === "enter") {
      Alert.alert("Interiors unavailable", "Interior customization needs a future backend API.");
      return;
    }

    if (action === "upgrade") {
      if (upgrading.current) return;
      if (!selectedBuilding.upgradeAvailable) {
        Alert.alert(
          `${selectedBuilding.type} upgrade`,
          selectedBuilding.level >= selectedBuilding.maxLevel
            ? "This building is at its maximum level."
            : `The next upgrade costs ${selectedBuilding.upgradeCost ?? "more"} World Points.`,
        );
        return;
      }

      try {
        upgrading.current = true;
        setUpgradeError("");
        const response = await api.post<UpgradeBuildingResponse>(
          apiRoutes.upgradeBuilding(selectedBuilding.buildingId),
          {},
        );
        const upgrades = confirmedBuildingUpgrade(response.data);
        enqueueBuildings({ id: JSON.stringify(["upgrade", response.data.building.buildingId, response.data.building.newLevel]), upgrades });
        const nextBase = await loadBase();
        const upgradedBuilding = nextBase?.buildings.find(
          (building) => building.buildingId === selectedBuilding.buildingId,
        );
        if (upgradedBuilding) {
          setSelectedBuilding(upgradedBuilding);
        }
      } catch (error) {
        const message = apiError(error, "This building cannot be upgraded yet.").message;
        setUpgradeError(message);
        Alert.alert("Upgrade unavailable", message);
      } finally {
        upgrading.current = false;
      }
      return;
    }

    setDescriptionOpen((open) => !open);
  }

  function clearSelectedBuilding() {
    setSelectedBuilding(null);
    setDescriptionOpen(false);
    setUpgradeError("");
  }

  return (
    <View style={styles.container}>
      <MapViewport
        image={BASE_BACKGROUND_IMAGES.tiledGround}
        camera={mapCamera}
        gesture={composedMapGesture}
        viewport={mapSize}
        webHandlers={webMapHandlers}
        onLayout={(event) => {
          const nextMapSize = {
            width: event.nativeEvent.layout.width,
            height: event.nativeEvent.layout.height,
          };

          setMapSize(nextMapSize);
          setMapCamera((current) => clampMapCamera(current, nextMapSize));
        }}
      >
        <View style={styles.mapStage}>
          <Pressable
            style={styles.mapClearPressable}
            onPress={clearSelectedBuilding}
          />

          {pathTiles.map((tile) => {
            const point = mapGridCellToPoint(tile);
            return (
              <Image
                key={`path-${tile.u}-${tile.v}`}
                source={getPathTileSource(tile.mask)}
                resizeMode="contain"
                style={[
                  styles.pathTile,
                  {
                    left: point.x - MAP_TILE_DIAMOND_WIDTH / 2,
                    top: point.y - MAP_TILE_DIAMOND_HEIGHT / 2,
                  },
                ]}
              />
            );
          })}

          {mapDecorations.map((decoration) => {
            const point = mapGridCellToPoint(decoration.cell);
            if (decoration.asset === "campfire") {
              return (
                <AnimatedCampfire
                  key={decoration.key}
                  decoration={decoration}
                  point={point}
                />
              );
            }

            return (
              <Image
                key={decoration.key}
                source={DECORATION_IMAGES[decoration.asset]}
                resizeMode="contain"
                style={[
                  styles.mapDecoration,
                  {
                    left:
                      point.x - decoration.width / 2 +
                      (decoration.offsetX ?? 0),
                    top:
                      point.y - decoration.height +
                      22 +
                      (decoration.offsetY ?? 0),
                    width: decoration.width,
                    height: decoration.height,
                    zIndex: Math.round(point.y),
                  },
                ]}
              />
            );
          })}

          {sortedBuildings.map((building) => (
            <BuildingNode
              key={building.type}
              building={building}
              selected={selectedBuilding?.type === building.type}
              upgrade={celebration?.upgrades.find(upgrade => upgrade.buildingId === building.buildingId && upgrade.newTier === building.visualTier)}
              upgradeMotion={upgradeMotion}
              layout={buildingLayouts[building.type]}
              layouts={buildingLayouts}
              mapScale={getMapBaseScale(mapSize) * mapCamera.zoom}
              zIndex={Math.round(
                getCollisionDiamondCenter(
                  building.type,
                  buildingLayouts[building.type],
                ).y,
              )}
              onPress={() => {
                setUpgradeError("");
                setSelectedBuilding((current) => {
                  if (current?.type === building.type) {
                    setDescriptionOpen(false);
                    return null;
                  }

                  setDescriptionOpen(false);
                  return building;
                });
              }}
              onMove={moveBuilding}
              onDragStart={() => {
                buildingDragActive.current = true;
              }}
              onDragEnd={() => {
                buildingDragActive.current = false;
              }}
            />
          ))}
        </View>
      </MapViewport>

      <BaseResources worldPoints={base?.worldPoints} loading={loading} error={loadError} onRetry={() => void loadBase()} />
      {selectedBuilding && <BaseBuildingPanel building={selectedBuilding} description={BUILDING_META[selectedBuilding.type].description}
        descriptionOpen={descriptionOpen} error={upgradeError} onAction={handleBuildingAction} onClose={clearSelectedBuilding} />}

      {Platform.OS === "web" && <Text role="status" aria-live="polite" aria-atomic style={styles.announcement}>
        {celebration ? buildingUpgradeAnnouncement(celebration) : ""}
      </Text>}
      {celebration && <BuildingUpgradeFeedback batch={celebration} motion={upgradeMotion} onDone={finishBuildings} tone="parchment" style={styles.upgradeFeedback} />}
    </View>
  );
}

function BuildingNode({
  building,
  selected,
  upgrade,
  upgradeMotion,
  layout,
  layouts,
  mapScale,
  zIndex,
  onPress,
  onMove,
  onDragStart,
  onDragEnd,
}: {
  building: BuildingProgress;
  selected: boolean;
  upgrade?: BuildingUpgrade;
  upgradeMotion: ReturnType<typeof useBuildingUpgradePresentation>;
  layout: BuildingMapLayout;
  layouts: Record<BuildingType, BuildingMapLayout>;
  mapScale: number;
  zIndex: number;
  onPress: () => void;
  onMove: (type: BuildingType, layout: BuildingMapLayout) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const meta = BUILDING_META[building.type];
  const imageSource = getBuildingImageSource(
    building.type,
    building.visualTier,
  );
  const dragStartLayout = useRef(layout);
  const dragPreviewLayout = useRef(layout);
  const dragTranslation = useRef(new Animated.ValueXY()).current;
  const collisionPolygon = getCollisionFootprintPolygon(building.type, layout);
  const grabAreaStyle = polygonBoundsStyle(collisionPolygon, layout);
  const [keyboardFocused, setKeyboardFocused] = useState(false);
  const buildingGesture = useMemo(() => {
    const dragGesture = Gesture.Pan()
      .minDistance(1)
      .runOnJS(true)
      .onBegin(() => {
        dragStartLayout.current = layout;
        dragPreviewLayout.current = layout;
        dragTranslation.setValue({ x: 0, y: 0 });
        onDragStart();
      })
      .onUpdate((event) => {
        const previewLayout = resolveBuildingMove(
          building.type,
          clampBuildingLayout({
            ...dragStartLayout.current,
            x:
              dragStartLayout.current.x +
              event.translationX / Math.max(mapScale, 0.01),
            y:
              dragStartLayout.current.y +
              event.translationY / Math.max(mapScale, 0.01),
          }),
          layouts,
        );

        dragPreviewLayout.current = previewLayout;
        dragTranslation.setValue({
          x: previewLayout.x - dragStartLayout.current.x,
          y: previewLayout.y - dragStartLayout.current.y,
        });
      })
      .onFinalize(() => {
        onMove(building.type, dragPreviewLayout.current);
        dragTranslation.setValue({ x: 0, y: 0 });
        onDragEnd();
      });

    const tapGesture = Gesture.Tap()
      .runOnJS(true)
      .onEnd((_, success) => {
        if (success) {
          onPress();
        }
      });

    return Gesture.Exclusive(dragGesture, tapGesture);
  }, [
    building.type,
    layout,
    layouts,
    mapScale,
    dragTranslation,
    onDragEnd,
    onDragStart,
    onMove,
    onPress,
  ]);

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.buildingSlot,
        {
          left: layout.x,
          top: layout.y,
          width: layout.width,
          height: layout.height,
          zIndex,
          transform: dragTranslation.getTranslateTransform(),
        },
      ]}
    >
      <View
        pointerEvents="none"
        style={[
          styles.buildingNode,
          imageSource ? styles.buildingNodeArt : { borderColor: meta.color },
        ]}
      >
        {imageSource ? (
          <BuildingTierArtwork type={building.type} tier={building.visualTier} upgrade={upgrade} motion={upgradeMotion} />
        ) : (
          <MaterialCommunityIcons
            name={meta.icon}
            size={32 + building.visualTier * 2}
            color={meta.color}
          />
        )}
      </View>

      <GestureDetector gesture={buildingGesture}>
        <View
          pointerEvents="box-only"
          accessible accessibilityRole="button"
          accessibilityState={{ selected }} aria-pressed={selected}
          accessibilityLabel={`${building.type}, level ${building.level}, tier ${building.visualTier}. Select building`}
          accessibilityHint="Opens building actions; drag to move the building"
          accessibilityActions={[{ name: "activate", label: "Select building" }]}
          onAccessibilityTap={onPress}
          onAccessibilityAction={event => { if (event.nativeEvent.actionName === "activate") onPress(); }}
          {...(Platform.OS === "web" ? { tabIndex: 0 } : {})}
          onFocus={() => setKeyboardFocused(true)} onBlur={() => setKeyboardFocused(false)}
          style={[styles.buildingGrabArea, grabAreaStyle, keyboardFocused && styles.buildingFocus]}
        >
          <View style={styles.buildingGrabHitbox} />
        </View>
      </GestureDetector>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: ui.colors.background },
  loadingScreen: {
    flex: 1,
    backgroundColor: ui.colors.background,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
  },
  loadingText: { ...ui.type.body, color: ui.colors.secondaryText },
  mapGround: {
    flex: 1,
    backgroundColor: "#223226",
    padding: 0,
    overflow: "hidden",
    position: "relative",
  },
  mapContentFrame: {
    position: "absolute",
    inset: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  mapContent: {
    width: WORLD_WIDTH,
    height: WORLD_HEIGHT,
  },
  mapBackgroundImage: {
    position: "absolute",
    inset: 0,
  },
  pathVertical: {
    position: "absolute",
    width: 26,
    top: 0,
    bottom: 0,
    left: "47%",
    backgroundColor: colors.primaryDark,
    opacity: 0.42,
  },
  pathHorizontal: {
    position: "absolute",
    height: 26,
    left: 0,
    right: 0,
    top: "47%",
    backgroundColor: colors.primaryDark,
    opacity: 0.42,
  },
  mapStage: {
    position: "absolute",
    left: WORLD_PLAYABLE_INSET_X,
    top: WORLD_PLAYABLE_INSET_Y,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    overflow: "visible",
  },
  mapClearPressable: {
    position: "absolute",
    inset: 0,
  },
  pathTile: {
    position: "absolute",
    width: MAP_TILE_DIAMOND_WIDTH,
    height: MAP_TILE_DIAMOND_HEIGHT,
    zIndex: 1,
  },
  mapDecoration: {
    position: "absolute",
  },
  buildingSlot: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "flex-end",
    zIndex: 5,
  },
  buildingGrabArea: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  buildingGrabHitbox: {
    width: "100%",
    height: "100%",
  },
  buildingFocus: { outlineWidth: 2, outlineOffset: 3, outlineColor: ui.colors.focus, outlineStyle: "solid" },
  upgradeFeedback: { top: ui.spacing.md * 2 + ui.size.target, bottom: undefined },
  buildingNode: {
    width: "100%",
    height: "100%",
    borderRadius: radius.md,
    borderWidth: 0,
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  buildingNodeArt: {
    borderColor: "transparent",
    backgroundColor: "transparent",
  },
  announcement: { position: "absolute", width: 1, height: 1, overflow: "hidden", opacity: 0 },
});
