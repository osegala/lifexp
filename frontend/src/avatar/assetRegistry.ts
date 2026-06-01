import { ImageSourcePropType } from "react-native";
import { Cosmetic } from "../types/avatar";

export type OutfitLayerSlot =
  | "capeBack"
  | "capeFront"
  | "outfit"
  | "boots"
  | "gloves"
  | "belt"
  | "accessories";

export const BASE_BODY_LAYERS: Record<string, ImageSourcePropType> = {
  hairBack: require("../../assets/avatar/base-layers/hair-back.png"),
  torso: require("../../assets/avatar/base-layers/torso.png"),
  arms: require("../../assets/avatar/base-layers/arms.png"),
  legs: require("../../assets/avatar/base-layers/legs.png"),
  feet: require("../../assets/avatar/base-layers/feet.png"),
  head: require("../../assets/avatar/base-layers/head.png"),
  hairFront: require("../../assets/avatar/base-layers/hair-front.png"),
};

export const BACKGROUND_IMAGES: Record<number, ImageSourcePropType> = {
  4: require("../../assets/avatar/backgrounds/forest-transparent.png"),
};

export const HAT_IMAGES: Record<number, ImageSourcePropType> = {
  1: require("../../assets/avatar/hats/starter-transparent.png"),
};

export const HAT_LAYER_IMAGES: Record<number, ImageSourcePropType> = {
  2: require("../../assets/avatar/hats/gym-headband.png"),
};

export const OUTFIT_LAYER_IMAGES: Record<
  number,
  Partial<Record<OutfitLayerSlot, ImageSourcePropType>>
> = {
  3: {
    capeBack: require("../../assets/avatar/outfit-layers/starter/cape-back.png"),
    capeFront: require("../../assets/avatar/outfit-layers/starter/cape-front.png"),
    outfit: require("../../assets/avatar/outfit-layers/starter/outfit.png"),
    boots: require("../../assets/avatar/outfit-layers/starter/boots.png"),
    gloves: require("../../assets/avatar/outfit-layers/starter/gloves.png"),
    belt: require("../../assets/avatar/outfit-layers/starter/belt.png"),
    accessories: require("../../assets/avatar/outfit-layers/starter/accessories.png"),
  },
};

export const PET_BEHIND_IMAGES: Record<number, ImageSourcePropType> = {};

export const PET_FRONT_IMAGES: Record<number, ImageSourcePropType> = {
  5: require("../../assets/avatar/pets/starter.png"),
};

export const AURA_IMAGES: Record<number, ImageSourcePropType> = {
  6: require("../../assets/avatar/auras/starter.png"),
};

export const ACCESSORY_IMAGES: Record<number, ImageSourcePropType> = {};

export const PARTICLE_IMAGES: Record<number, ImageSourcePropType> = {};

export function getCosmeticPreviewSource(
  cosmetic: Pick<Cosmetic, "id" | "type">,
) {
  switch (cosmetic.type) {
    case "HAT":
      return HAT_IMAGES[cosmetic.id] ?? HAT_LAYER_IMAGES[cosmetic.id];
    case "OUTFIT":
      return OUTFIT_LAYER_IMAGES[cosmetic.id]?.outfit;
    case "BACKGROUND":
      return BACKGROUND_IMAGES[cosmetic.id];
    case "PET":
      return PET_FRONT_IMAGES[cosmetic.id] ?? PET_BEHIND_IMAGES[cosmetic.id];
    case "AURA":
      return AURA_IMAGES[cosmetic.id];
    default:
      return undefined;
  }
}
