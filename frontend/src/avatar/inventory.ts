import type {
  Avatar,
  Cosmetic,
  CosmeticType,
  EquipmentSlot,
  InventoryResponse,
} from "../types/avatar";
import type { ShopItem, ShopResponse } from "../types";

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

export function catalogCosmeticReference(
  item: Pick<ShopItem, "itemId" | "category" | "assetKey">,
) {
  const type = CATEGORY_TYPES[item.category.toLowerCase()];
  return type ? {
    id: item.itemId,
    type,
    imageUrl: avatarAssetKey(item.assetKey),
  } : null;
}

export function wardrobeCosmetics(
  shop: ShopResponse,
  inventory: InventoryResponse,
  builtInHairIds: readonly string[],
  selectedHairId: string | null,
  assetMetadata: (assetKey: string) => {
    slot: EquipmentSlot;
    fullOutfit: boolean;
  } | null,
  reportUnresolved?: (itemId: string, assetKey: string) => void,
): Cosmetic[] {
  const hair = builtInHairIds.map((id) => ({
    id,
    name: titleFromAssetId(id),
    type: "HAIR" as const,
    requiredLevel: 1,
    imageUrl: id,
    owned: true,
    unlocked: true,
    equipped: id === selectedHairId,
    slot: "hair" as const,
    fullOutfit: false,
    shopStatus: "OWNED" as const,
    requirementText: null,
  }));
  const ownedById = new Map(inventory.items.map((item) => [item.itemId, item]));
  const catalog = shop.items.flatMap((item) => {
    const reference = catalogCosmeticReference(item);
    if (!reference || reference.type === "HAIR") return [];
    const metadata = assetMetadata(reference.imageUrl);
    if (!metadata) reportUnresolved?.(item.itemId, reference.imageUrl);
    const owned = ownedById.get(item.itemId);
    return [{
      ...reference,
      name: item.name,
      requiredLevel: item.effectiveRequiredLevel,
      owned: Boolean(owned),
      unlocked: Boolean(owned),
      equipped: owned?.equipped === true,
      slot: metadata?.slot,
      fullOutfit: metadata?.fullOutfit ?? false,
      shopStatus: item.status,
      requirementText: wardrobeRequirement(item, shop.player.level, Boolean(owned)),
    }];
  });
  return [
    ...hair,
    ...catalog,
  ];
}

function wardrobeRequirement(item: ShopItem, playerLevel: number, owned: boolean) {
  if (owned) return null;
  const requirements = [];
  if (playerLevel < item.effectiveRequiredLevel) {
    requirements.push(`Reach level ${item.effectiveRequiredLevel}`);
  }
  if (item.requiredAchievement && !item.requirementSatisfied) {
    requirements.push(`Complete "${item.achievementRequirement?.name ?? item.requiredAchievement}"`);
  }
  return requirements.join(" · ") || `Available in the Shop · ${item.effectivePrice} coins`;
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
