import { Image, type ImageSourcePropType } from "react-native";
import { Image as CachedImage } from "expo-image";
import type { Avatar, Cosmetic } from "../types/avatar";
import type { ShopItem } from "../types";
import { catalogCosmeticReference } from "./inventory";
import { getBaseBodySprites, getCosmeticPreviewSource, getEquippedCharacterSprites, getEquippedSceneSource, resolveSpriteSet } from "./assetRegistry";
import { getAvatarSceneSource } from "./scene";
import { homeAvatarFromInventory } from "../home/avatar";
import { normalizeAppearance } from "./appearance";
import type { PlayerCache } from "../cache/PlayerCache";

const pending = new Map<string, Promise<void>>();

/** Called during account hydration, before any tabs can mount. */
export async function prefetchCachedAvatar(cache: PlayerCache, userId: string) {
  const profile = cache.peek(userId, "profile"), inventory = cache.peek(userId, "inventory");
  if (!profile || !inventory) return;
  const { avatar, cosmetics } = homeAvatarFromInventory(inventory, normalizeAppearance(profile));
  await prefetchAvatarAssets(avatar, cosmetics);
}
// Bundled assets have stable URIs; failed requests remain retryable. No player data lives here.
function prefetch(source: ImageSourcePropType | undefined, thumbnail = false): Promise<void> {
  try {
    if (!source) return Promise.resolve();
    const uri = Image.resolveAssetSource(source)?.uri;
    if (!uri) return Promise.resolve();
    const key = `${thumbnail ? "thumbnail" : "sprite"}:${uri}`;
    const existing = pending.get(key);
    if (existing) return existing;
    const request = (thumbnail ? CachedImage.prefetch(uri, { cachePolicy: "memory-disk" }) : Image.prefetch(uri))
      .then(ok => { if (!ok) pending.delete(key); }, () => { pending.delete(key); });
    pending.set(key, request);
    return request;
  } catch { return Promise.resolve(); }
}

export function prefetchWardrobeThumbnails(items: readonly Cosmetic[]) {
  return Promise.all(items.map(item => prefetch(getCosmeticPreviewSource(item), true)));
}

export function prefetchShopThumbnails(items: readonly ShopItem[]) {
  return Promise.all(items.map(item => {
    const reference = catalogCosmeticReference(item);
    return reference ? prefetch(getCosmeticPreviewSource(reference), true) : Promise.resolve();
  }));
}

export function prefetchAvatarAssets(avatar: Avatar, cosmetics: Cosmetic[]) {
  const clothing = [
    ...getEquippedCharacterSprites(cosmetics, avatar.equippedBottomId, "BOTTOM"),
    ...getEquippedCharacterSprites(cosmetics, avatar.equippedBootsId, "BOOTS"),
    ...getEquippedCharacterSprites(cosmetics, avatar.equippedTopId, "TOP"),
  ];
  const sprites = [
    ...clothing,
    ...getEquippedCharacterSprites(cosmetics, avatar.equippedHairId, "HAIR"),
    ...getEquippedCharacterSprites(cosmetics, avatar.equippedHatId, "HAT"),
    ...resolveSpriteSet(`base-body:${avatar.bodyType}`, getBaseBodySprites(avatar.bodyType, clothing)),
  ];
  return Promise.all([
    ...sprites.map(sprite => prefetch(sprite.source)),
    prefetch(getAvatarSceneSource(cosmetics, avatar.equippedBackgroundId)),
    prefetch(getEquippedSceneSource(cosmetics, avatar.equippedPetId, "PET")),
    prefetch(getEquippedSceneSource(cosmetics, avatar.equippedAuraId, "AURA")),
  ]);
}
