import type {
  Avatar,
  Cosmetic,
  CosmeticType,
  InventoryResponse,
} from "../types/avatar";

const CATEGORY_TYPES: Record<string, CosmeticType> = {
  tunic: "TOP",
  tunics: "TOP",
  pants: "BOTTOM",
  boot: "BOOTS",
  boots: "BOOTS",
  hat: "HAT",
  hats: "HAT",
  hair: "HAIR",
  hairstyle: "HAIR",
  hairstyles: "HAIR",
  pet: "PET",
  pets: "PET",
  aura: "AURA",
  auras: "AURA",
  background: "BACKGROUND",
  backgrounds: "BACKGROUND",
};

const LOCAL_ASSET_KEYS: Record<string, string> = {
  "starter-tunic.png": "avatar-v2/tops/guild-tunic",
  "forest-tunic.png": "avatar-v2/tops/forest-ranger",
};

export function avatarAssetKey(assetKey: string | null) {
  return assetKey ? LOCAL_ASSET_KEYS[assetKey] ?? assetKey : "";
}

export function inventoryCosmetics(inventory: InventoryResponse): Cosmetic[] {
  return inventory.items.flatMap((item) => {
    const type = CATEGORY_TYPES[item.category.toLowerCase()];
    return type
      ? [{
          id: item.itemId,
          name: item.name,
          type,
          requiredLevel: 1,
          imageUrl: avatarAssetKey(item.assetKey),
          unlocked: true,
          equipped: item.equipped,
        }]
      : [];
  });
}

export function avatarFromInventory(
  inventory: InventoryResponse,
  bodyType: "BOY" | "GIRL" = "BOY",
): Avatar {
  const equipment = inventory.equipped;
  return {
    id: "local-avatar",
    baseStyle: "default",
    bodyType,
    equippedHairId: equipment.hair,
    equippedHatId: equipment.hat,
    equippedTopId: equipment.tunic,
    equippedBottomId: equipment.pants,
    equippedBootsId: equipment.boots,
    equippedCapeId: null,
    equippedWeaponId: null,
    equippedShieldId: null,
    equippedBackgroundId: equipment.background,
    equippedPetId: equipment.pet,
    equippedAuraId: equipment.aura,
  };
}
