import { CosmeticType, EquipmentSlot } from "../types/avatar";

export const CHARACTER_CANVAS = {
  width: 1254,
  height: 1254,
  aspectRatio: 1,
} as const;

export type BodyRegion =
  | "bodyBack" | "torso" | "upperArmLeft" | "upperArmRight"
  | "forearmLeft" | "forearmRight" | "handLeft" | "handRight"
  | "upperLegLeft" | "upperLegRight" | "lowerLegLeft" | "lowerLegRight"
  | "footLeft" | "footRight" | "neck" | "head";

/**
 * The single source of truth for paper-doll ordering. Scene artwork is kept out
 * of this list because it is rendered by AvatarScene, not CharacterCanvas.
 */
export const CHARACTER_LAYER_PRIORITY = {
  hairBack: 30,
  backAccessory: 35,
  bodyBack: 38,
  baseBody: 40,
  bottoms: 60,
  boots: 70,
  upperBody: 90,
  armor: 110,
  belt: 120,
  hairDrape: 125, // Over clothing and shoulders, behind the head and ears.
  bodyFront: 130,
  clothingFront: 135,
  face: 150,
  hairFront: 160,
  headwear: 170,
} as const;

export type CharacterLayer = keyof typeof CHARACTER_LAYER_PRIORITY;

export const CHARACTER_LAYER_ORDER = (
  Object.keys(CHARACTER_LAYER_PRIORITY) as CharacterLayer[]
).sort(
  (left, right) =>
    CHARACTER_LAYER_PRIORITY[left] - CHARACTER_LAYER_PRIORITY[right],
);

/** Toggle locally while developing; the logger is also guarded by __DEV__. */
export const SHOW_CHARACTER_LAYER_DEBUG = false;

export const COSMETIC_TYPE_TO_SLOT: Partial<Record<CosmeticType, EquipmentSlot>> = {
  HAIR: "hair",
  HAT: "head",
  TOP: "upperBody",
  BOTTOM: "bottoms",
  BOOTS: "boots",
  BACKGROUND: "scene",
  PET: "pet",
  AURA: "aura",
};
