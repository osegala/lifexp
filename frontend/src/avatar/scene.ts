import type { Cosmetic, CosmeticId } from "../types/avatar";
import type { ImageSourcePropType } from "react-native";
import { getEquippedSceneSource } from "./assetRegistry";

export const DEFAULT_AVATAR_SCENE: ImageSourcePropType = require("../../assets/avatar/v2/backgrounds/castle-garden.png");

// Display-only fallback. An equipped ID always retains the existing resolver,
// including its unavailable-asset behavior; no ownership or equipment is added.
export function getAvatarSceneSource(cosmetics: Cosmetic[] | undefined, backgroundId: CosmeticId | null | undefined): ImageSourcePropType | undefined {
  return backgroundId ? getEquippedSceneSource(cosmetics, backgroundId, "BACKGROUND") : DEFAULT_AVATAR_SCENE;
}
