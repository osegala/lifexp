export type Avatar = {
  id: number;
  baseStyle: string;
  equippedHatId: number | null;
  equippedOutfitId: number | null;
  equippedBackgroundId: number | null;
  equippedPetId: number | null;
  equippedAuraId: number | null;
};

export type Cosmetic = {
  id: number;
  name: string;
  type: "HAT" | "OUTFIT" | "BACKGROUND" | "PET" | "AURA";
  requiredLevel: number;
  imageUrl: string;
  unlocked: boolean;
  equipped: boolean;
};