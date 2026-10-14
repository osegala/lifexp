import { avatarFromInventory, catalogCosmeticReference } from "../avatar/inventory";
import type { AvatarAppearance } from "../avatar/appearance";
import type { Avatar, Cosmetic, InventoryResponse } from "../types/avatar";

export type HomeAvatar = { avatar: Avatar; cosmetics: Cosmetic[] };

// Same equipment/profile mapping as Avatar; inventory already supplies the asset
// references. Home does not need the Shop catalog or a second equipment selection.
export function homeAvatarFromInventory(inventory: InventoryResponse, appearance: AvatarAppearance): HomeAvatar {
  const equippedIds = new Set(Object.values(inventory.equipped));
  return {
    avatar: avatarFromInventory(inventory, appearance),
    cosmetics: inventory.items.filter(item => equippedIds.has(item.itemId)).flatMap(item => {
      const reference = catalogCosmeticReference(item);
      return reference ? [{ ...reference, name: item.name, requiredLevel: 1,
        owned: true, unlocked: true, equipped: true }] : [];
    }),
  };
}
