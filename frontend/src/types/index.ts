export type User = {
  id: string | number;
  username: string;
  email: string;
  totalXp: number;
  level: number;
  xpToNextLevel: number;
  progressPercent: number;
  currentStreak: number;
  longestStreak: number;
  coins: number;
  premiumActive: boolean;
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

export type Cosmetic = {
  id: number;
  name: string;
  type: string;
  requiredLevel: number;
  imageUrl: string;
  unlocked: boolean;
  equipped: boolean;
};

export type WeeklyQuest = {
  key: string;
  title: string;
  storyText: string;
  taskTitle: string;
  category: string;
  requiredCompletions: number;
  progress: number;
  xpReward: number;
  coinReward: number;
  startsAt: string;
  endsAt: string;
  completed: boolean;
  claimed: boolean;
};

export type Achievement = {
  key: string;
  title: string;
  description: string;
  progress: number;
  target: number;
  coinReward: number;
  cosmeticReward: string | null;
  completed: boolean;
  claimed: boolean;
};

export type ShopItem = {
  key: string;
  cosmeticId: number;
  name: string;
  type: string;
  imageUrl: string;
  priceCoins: number;
  premiumOnly: boolean;
  owned: boolean;
};

export type SocialUser = {
  id: number;
  username: string;
  level: number;
  currentStreak: number;
};

export type Friendship = {
  id: number;
  user: SocialUser;
  status: "PENDING" | "ACCEPTED" | "BLOCKED";
  incoming: boolean;
};

export type ChatMessage = {
  id: number;
  sender: SocialUser;
  recipientId?: number | null;
  realm: string;
  body: string;
  createdAt: string;
};
