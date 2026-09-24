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

export type CosmeticId = string | number;

export type Avatar = {
  id: string;
  baseStyle: string;
  bodyType: "BOY" | "GIRL";
  equippedHairId: CosmeticId | null;
  equippedHatId: CosmeticId | null;
  equippedTopId: CosmeticId | null;
  equippedBottomId: CosmeticId | null;
  equippedBootsId: CosmeticId | null;
  equippedCapeId: CosmeticId | null;
  equippedWeaponId: CosmeticId | null;
  equippedShieldId: CosmeticId | null;
  equippedBackgroundId: CosmeticId | null;
  equippedPetId: CosmeticId | null;
  equippedAuraId: CosmeticId | null;
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

export type EquipmentState = Partial<Record<EquipmentSlot, CosmeticId | null>>;

export type Cosmetic = {
  id: CosmeticId;
  name: string;
  type: CosmeticType;
  requiredLevel: number;
  imageUrl: string;
  unlocked: boolean;
  equipped: boolean;
};

export type InventoryEquipment = {
  tunic: string | null;
  pants: string | null;
  boots: string | null;
  hat: string | null;
  hair: string | null;
  pet: string | null;
  aura: string | null;
  background: string | null;
};

export type InventoryItem = {
  itemId: string;
  name: string;
  category: string;
  assetKey: string | null;
  purchasedAt: string | null;
  purchasePrice: number;
  equipped: boolean;
};

export type InventoryResponse = {
  equipped: InventoryEquipment;
  items: InventoryItem[];
};
