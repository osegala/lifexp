export type CosmeticType =
  | "HAIR"
  | "HAT"
  | "TOP"
  | "BOTTOM"
  | "BOOTS"
  | "CAPE"
  | "WEAPON"
  | "SHIELD"
  | "BACKGROUND"
  | "PET"
  | "AURA";

export type Avatar = {
  id: number;
  baseStyle: string;
  bodyType: "BOY" | "GIRL";
  equippedHairId: number | null;
  equippedHatId: number | null;
  equippedTopId: number | null;
  equippedBottomId: number | null;
  equippedBootsId: number | null;
  equippedCapeId: number | null;
  equippedWeaponId: number | null;
  equippedShieldId: number | null;
  equippedBackgroundId: number | null;
  equippedPetId: number | null;
  equippedAuraId: number | null;
};

export type EquipmentSlot =
  | "hair"
  | "head"
  | "upperBody"
  | "bottoms"
  | "boots"
  | "cape"
  | "weapon"
  | "shield"
  | "scene"
  | "pet"
  | "aura";

export type EquipmentState = Partial<Record<EquipmentSlot, number | null>>;

export type Cosmetic = {
  id: number;
  name: string;
  type: CosmeticType;
  requiredLevel: number;
  imageUrl: string;
  unlocked: boolean;
  equipped: boolean;
};
