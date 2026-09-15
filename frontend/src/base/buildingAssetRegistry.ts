import { ImageSourcePropType } from "react-native";
import { BuildingType} from "../types/progression";

/**
 * Building artwork registry
 * ---------------------------------------------------------------
 * Mirrors `src/avatar/assetRegistry.ts`. Each building has up to 5
 * visual tiers (see `visualTierForLevel` in BuildingService.java on
 * the backend, which sends `visualTier` as part of BuildingProgress).
 *
 * TO ADD ART:
 * 1. Drop a transparent PNG into:
 *      frontend/assets/base/buildings/<slug>/<slug>-level-<n>.png
 *    where <slug> is one of the BUILDING_SLUGS values below and
 *    <n> is 1-5. Match the avatar assets' square canvas convention
 *    (e.g. 1024x1024 or 1254x1254) so scaling stays consistent.
 * 2. Add the matching require() line in BUILDING_TIER_IMAGES below
 *    (Metro needs static require() paths, so this can't be built
 *    dynamically from a string).
 * 3. That's it — base.tsx and getBuildingImageSource() need no
 *    further changes.
 *
 * You do NOT need art for every tier before shipping anything. Any
 * tier without an image automatically falls back to the nearest
 * lower tier that *does* have art (see getBuildingImageSource), and
 * a building with no art at all falls back to the existing icon UI
 * in base.tsx.
 */

export const BUILDING_SLUGS: Record<BuildingType, string> = {
    "Home Base": "home-base",
    Workshop: "workshop",
    Library: "library",
    "Training Grounds": "training-grounds",
    Garden: "garden",
    "Hall of Achievements": "hall-of-achievement",
};

export type BuildingTier = 1 | 2 | 3 | 4 | 5;

type TierImageMap = Partial<Record<BuildingTier, ImageSourcePropType>>;

export const BUILDING_TIER_IMAGES: Record<BuildingType, TierImageMap> = {
    "Home Base": {
        1: require("../../assets/base/buildings/home-base/home-base-level-1.png"),
        2: require("../../assets/base/buildings/home-base/home-base-level-2.png"),
        3: require("../../assets/base/buildings/home-base/home-base-level-3.png"),
        4: require("../../assets/base/buildings/home-base/home-base-level-4.png"),
        5: require("../../assets/base/buildings/home-base/home-base-level-5.png"),
    },
    Workshop: {
        1: require("../../assets/base/buildings/workshop/workshop-level-1.png"),
        2: require("../../assets/base/buildings/workshop/workshop-level-2.png"),
        3: require("../../assets/base/buildings/workshop/workshop-level-3.png"),
        4: require("../../assets/base/buildings/workshop/workshop-level-4.png"),
        5: require("../../assets/base/buildings/workshop/workshop-level-5.png"),
    },
    Library: {
        1: require("../../assets/base/buildings/library/library-level-1.png"),
        2: require("../../assets/base/buildings/library/library-level-2.png"),
        3: require("../../assets/base/buildings/library/library-level-3.png"),
        4: require("../../assets/base/buildings/library/library-level-4.png"),
        5: require("../../assets/base/buildings/library/library-level-5.png"),
    },
    "Training Grounds": {
        1: require("../../assets/base/buildings/training-grounds/training-grounds-level-1.png"),
        2: require("../../assets/base/buildings/training-grounds/training-grounds-level-2.png"),
        3: require("../../assets/base/buildings/training-grounds/training-grounds-level-3.png"),
        4: require("../../assets/base/buildings/training-grounds/training-grounds-level-4.png"),
        5: require("../../assets/base/buildings/training-grounds/training-grounds-level-5.png"),
    },
    Garden: {
        1: require("../../assets/base/buildings/garden/garden-level-1.png"),
        2: require("../../assets/base/buildings/garden/garden-level-2.png"),
        3: require("../../assets/base/buildings/garden/garden-level-3.png"),
        4: require("../../assets/base/buildings/garden/garden-level-4.png"),
        5: require("../../assets/base/buildings/garden/garden-level-5.png"),
    },
    "Hall of Achievements": {
        1: require("../../assets/base/buildings/hall-of-achievement/hall-of-achievement-level-1.png"),
        2: require("../../assets/base/buildings/hall-of-achievement/hall-of-achievement-level-2.png"),
        3: require("../../assets/base/buildings/hall-of-achievement/hall-of-achievement-level-3.png"),
        4: require("../../assets/base/buildings/hall-of-achievement/hall-of-achievement-level-4.png"),
        5: require("../../assets/base/buildings/hall-of-achievement/hall-of-achievement-level-5.png"),
    },
};

/**
 * Returns the best available artwork for a building at a given tier,
 * falling back to the nearest lower tier's art if the exact tier
 * hasn't been illustrated yet. Returns undefined if no art exists
 * at all for that building (caller should fall back to the icon UI).
 */

export function getBuildingImageSource(
    type: BuildingType,
    tier: number,
): ImageSourcePropType | undefined {
    const tierMap = BUILDING_TIER_IMAGES[type];
    const ClampedTier = Math.max(1, Math.min(5, tier)); // Ensure tier is between 1 and 5

    for(let t = ClampedTier; t >= 1; t--) {
        const source = tierMap[t as BuildingTier];
        if (source) return source;
    }
    
    return undefined; // No art available for this building
}

/**
 * Base scene background art (the "map" behind the building grid).
 * Same drop-in approach: add the file, then uncomment/replace the
 * require() line below. Leave as undefined to keep the current flat
 * color background.
 */

export const BASE_BACKGROUND_IMAGES: {
    sky: ImageSourcePropType | undefined;
    ground: ImageSourcePropType | undefined;
    kingdomMap: ImageSourcePropType | undefined;
    tiledGround: ImageSourcePropType | undefined;
} = {
    sky: require("../../assets/base/backgrounds/sky.png"),
    ground: require("../../assets/base/backgrounds/ground.png"),
    kingdomMap: require("../../assets/base/backgrounds/kingdom-map.png"),
    tiledGround: require("../../assets/base/backgrounds/tiled-ground.png"),
};
