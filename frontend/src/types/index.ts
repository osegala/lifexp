export type User = {
  id: number;
  username: string;
  email: string;
  totalXp: number;
  level: number;
  xpToNextLevel: number;
  progressPercent: number;
};

export type AuthResponse = {
  token: string;
  user: User;
};

export type Task = {
  id: number;
  title: string;
  description: string;
  xpValue: number;
  dueDate: string;
  category: string;
  completed: boolean;
  unlockedCosmetics?: string[];
};

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
  type: string;
  requiredLevel: number;
  imageUrl: string;
  unlocked: boolean;
  equipped: boolean;
};