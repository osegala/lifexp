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

export function inventoryCosmetics(
  inventory: InventoryResponse,
  isAssetRegistered: (assetKey: string) => boolean = () => true,
  reportUnresolved?: (itemId: string, assetKey: string) => void,
): Cosmetic[] {
  return inventory.items.flatMap((item) => {
    const type = CATEGORY_TYPES[item.category.toLowerCase()];
    const imageUrl = avatarAssetKey(item.assetKey);
    if (!imageUrl || !isAssetRegistered(imageUrl)) {
      reportUnresolved?.(item.itemId, imageUrl);
    }
    return type
      ? [{
          id: item.itemId,
          name: item.name,
          type,
          requiredLevel: 1,
          imageUrl,
          unlocked: true,
          equipped: item.equipped,
        }]
      : [];
  });
}

export function wardrobeCosmetics(
  inventory: InventoryResponse,
  builtInHairIds: readonly string[],
  selectedHairId: string | null,
  isAssetRegistered?: (assetKey: string) => boolean,
  reportUnresolved?: (itemId: string, assetKey: string) => void,
): Cosmetic[] {
  const hair = builtInHairIds.map((id) => ({
    id,
    name: titleFromAssetId(id),
    type: "HAIR" as const,
    requiredLevel: 1,
    imageUrl: id,
    unlocked: true,
    equipped: id === selectedHairId,
  }));
  return [
    ...hair,
    ...inventoryCosmetics(inventory, isAssetRegistered, reportUnresolved)
      .filter((cosmetic) => cosmetic.type !== "HAIR"),
  ];
}

export async function loadOptionalAppearance(
  getBodyType: () => Promise<"BOY" | "GIRL">,
  getHairId: () => Promise<string | null>,
) {
  const [bodyType, hairId] = await Promise.allSettled([
    getBodyType(),
    getHairId(),
  ]);
  return {
    bodyType: bodyType.status === "fulfilled" ? bodyType.value : "BOY" as const,
    hairId: hairId.status === "fulfilled" ? hairId.value : null,
  };
}

function titleFromAssetId(assetId: string) {
  return assetId.split("/").at(-1)?.replace(/(^|-)([a-z])/g, (_, separator, letter) =>
    `${separator ? " " : ""}${letter.toUpperCase()}`) ?? assetId;
}

export function avatarFromInventory(
  inventory: InventoryResponse,
  bodyType: "BOY" | "GIRL" = "BOY",
  localHairId?: string | null,
): Avatar {
  const equipment = inventory.equipped;
  return {
    id: "local-avatar",
    baseStyle: "default",
    bodyType,
    equippedHairId: localHairId === undefined ? equipment.hair : localHairId,
    equippedHatId: equipment.hat,
    equippedTopId: equipment.tunic,
    equippedBottomId: equipment.pants,
    equippedBootsId: equipment.boots,
    equippedBackgroundId: equipment.background,
    equippedPetId: equipment.pet,
    equippedAuraId: equipment.aura,
  };
}
