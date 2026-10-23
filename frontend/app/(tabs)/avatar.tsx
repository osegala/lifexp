import { showGameNotice } from "../../src/feedback/notices";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";
import type { AxiosRequestConfig } from "axios";
import { api, apiError } from "../../src/api/client";
import { apiRoutes } from "../../src/api/routes";
import { getCosmeticAssetIds, getCosmeticAssetMetadata } from "../../src/avatar/assetRegistry";
import { avatarFromInventory, catalogCosmeticReference, wardrobeCosmetics } from "../../src/avatar/inventory";
import { getLocalAppearance, setLocalAppearance } from "../../src/avatar/localAppearance";
import { normalizeAppearance } from "../../src/avatar/appearance";
import type { AvatarAppearance } from "../../src/avatar/appearance";
import AvatarContent from "../../src/components/AvatarContent";
import { useAuth } from "../../src/context/AuthContext";
import { environment } from "../../src/config/environment";
import type { ShopResponse } from "../../src/types";
import type { Avatar, Cosmetic, CosmeticId, CosmeticType, InventoryResponse } from "../../src/types/avatar";
import type { ProfileResponse } from "../../src/auth/session";
import { playerCache } from "../../src/cache/playerData";
import { SupersededCacheRead } from "../../src/cache/PlayerCache";
import { prefetchAvatarAssets } from "../../src/avatar/prefetch";
import { useEntitlements } from "../../src/entitlements/useEntitlements";

const BUILT_IN_HAIR_IDS = getCosmeticAssetIds("hair");
const CAN_PREVIEW_ALL_COSMETICS = __DEV__ && environment.environment === "dev";
function cachedWardrobe(userId: string | number, fallback?: AvatarAppearance) {
  const inventory = playerCache.peek(userId, "inventory"), profile = playerCache.peek(userId, "profile");
  if (!inventory || (!profile && !fallback)) return null;
  const appearance = normalizeAppearance(profile ?? fallback);
  const shop = playerCache.peek(userId, "shop");
  const cosmetics = wardrobeCosmetics(shop ?? { items: [], player: { level: 1, coins: 0 } }, inventory,
    BUILT_IN_HAIR_IDS, appearance.hairId, getCosmeticAssetMetadata);
  // An evicted catalog must not hide the actual owned/equipped inventory.
  for (const item of inventory.items) {
    const reference = catalogCosmeticReference(item);
    if (reference && reference.type !== "HAIR" && !cosmetics.some(cosmetic => cosmetic.id === item.itemId)) {
      const metadata = getCosmeticAssetMetadata(reference.imageUrl);
      cosmetics.push({ ...reference, name: item.name, requiredLevel: 1, slot: metadata?.slot, fullOutfit: metadata?.fullOutfit,
        owned: true, unlocked: true, equipped: item.equipped, shopStatus: "OWNED" });
    }
  }
  return { appearance, avatar: avatarFromInventory(inventory, appearance), cosmetics,
    premiumItemIds: shop?.items.filter(item => item.requiresPremium).map(item => item.itemId) ?? [] };
}
const AVATAR_SLOT: Record<CosmeticType, keyof Pick<Avatar,
  "equippedHairId" | "equippedHatId" | "equippedTopId" | "equippedBottomId"
  | "equippedBootsId" | "equippedBackgroundId" | "equippedPetId" | "equippedAuraId">> = {
  HAIR: "equippedHairId",
  HAT: "equippedHatId",
  TOP: "equippedTopId",
  BOTTOM: "equippedBottomId",
  BOOTS: "equippedBootsId",
  BACKGROUND: "equippedBackgroundId",
  PET: "equippedPetId",
  AURA: "equippedAuraId",
};

export default function AvatarScreen() {
  const { user, refreshEntitlements } = useAuth();
  const entitlement = useEntitlements();
  const userId = user?.id;
  const [initial] = useState(() => userId == null ? null : cachedWardrobe(userId));
  const [avatar, setAvatar] = useState<Avatar | null>(initial?.avatar ?? null);
  const [cosmetics, setCosmetics] = useState<Cosmetic[]>(initial?.cosmetics ?? []);
  const [loading, setLoading] = useState(!initial);
  const [refreshing, setRefreshing] = useState(false);
  const hasView = useRef(!!initial), loadVersion = useRef(0), keepDraft = useRef(false), preview = useRef(false);
  const [loadingId, setLoadingId] = useState<CosmeticId | null>(null);
  const [savingAppearance, setSavingAppearance] = useState(false);
  const [appearanceSaveError, setAppearanceSaveError] = useState("");
  const [savedAppearance, setSavedAppearance] = useState<AvatarAppearance | null>(initial?.appearance ?? null);
  const [editingAppearance, setEditingAppearance] = useState(false);
  const [confirmDiscardAppearance, setConfirmDiscardAppearance] = useState(false);
  const [previewAllCosmetics, setPreviewAllCosmetics] = useState(false);
  const [selectedType, setSelectedType] = useState<CosmeticType>("HAIR");
  const [loadError, setLoadError] = useState("");
  const [equipmentError, setEquipmentError] = useState("");
  const [premiumItemIds, setPremiumItemIds] = useState<string[]>(initial?.premiumItemIds ?? []);

  const applySnapshot = useCallback((data: NonNullable<ReturnType<typeof cachedWardrobe>>) => {
    hasView.current = true;
    void prefetchAvatarAssets(data.avatar, data.cosmetics);
    if (preview.current) return;
    setSavedAppearance(data.appearance);
    setPremiumItemIds(data.premiumItemIds);
    setAvatar(current => keepDraft.current && current ? { ...data.avatar, bodyType: current.bodyType,
      equippedHairId: current.equippedHairId, skinColorId: current.skinColorId, hairColorId: current.hairColorId, eyeColorId: current.eyeColorId } : data.avatar);
    setCosmetics(current => {
      const hair = current.find(item => item.type === "HAIR" && item.equipped)?.id;
      return keepDraft.current ? data.cosmetics.map(item => item.type === "HAIR" ? { ...item, equipped: item.id === hair } : item) : data.cosmetics;
    });
    setLoading(false);
  }, []);

  const loadAvatarData = useCallback(async () => {
    if (userId == null) return;
    const version = ++loadVersion.current;
    const config = { expectedUserId: String(userId) } as AxiosRequestConfig;
    setLoading(!hasView.current);
    setRefreshing(true);
    const hydration = playerCache.hydrateUser(userId);
    const showAvailableCache = () => {
      if (version !== loadVersion.current || hasView.current) return;
      const cached = cachedWardrobe(userId);
      if (cached) applySnapshot(cached);
    };
    void hydration.then(showAvailableCache);
    try {
      const reads = [
        playerCache.refresh(userId, "shop", async () => (await api.get<ShopResponse>(apiRoutes.shop, config)).data),
        playerCache.refresh(userId, "inventory", async () => (await api.get<InventoryResponse>(apiRoutes.inventory, config)).data),
        playerCache.refresh(userId, "profile", async () => (await api.get<ProfileResponse>(apiRoutes.me, config)).data),
      ];
      // The owned wardrobe/character can be usable before the catalog finishes.
      const results = await Promise.allSettled(reads.map(read => read.then(data => { showAvailableCache(); return data; })));
      await hydration;
      if (version !== loadVersion.current) return;
      const failure = results.find(result => result.status === "rejected" && !(result.reason instanceof SupersededCacheRead));
      const data = cachedWardrobe(userId) ?? cachedWardrobe(userId, await getLocalAppearance(userId));
      if (version !== loadVersion.current) return;
      if (data && (!failure || !hasView.current)) applySnapshot(data);
      if (failure?.status === "rejected") throw failure.reason;
      if (data) void setLocalAppearance(userId, data.appearance);
      setLoadError("");
    } catch (error) {
      const message = apiError(error, "Could not load your wardrobe.").message;
      if (version === loadVersion.current) { setLoadError(message); showGameNotice("Character", message, "error"); }
    } finally {
      if (version === loadVersion.current) { setLoading(false); setRefreshing(false); }
    }
  }, [userId, applySnapshot]);

  useFocusEffect(
    useCallback(() => {
      const cached = userId == null ? null : cachedWardrobe(userId);
      if (cached) applySnapshot(cached);
      void loadAvatarData();
      return () => { loadVersion.current++; };
    }, [loadAvatarData, userId, applySnapshot]),
  );

  const previewCosmetic = useCallback((cosmetic: Cosmetic) => {
    const slot = AVATAR_SLOT[cosmetic.type];
    const nextId = cosmetic.equipped ? null : cosmetic.id;
    setAvatar((current) => current ? { ...current, [slot]: nextId } : current);
    setCosmetics((current) => current.map((item) => item.type === cosmetic.type
      ? { ...item, equipped: nextId !== null && item.id === cosmetic.id }
      : item));
  }, []);

  function toggleCosmeticPreview() {
    const enabled = !previewAllCosmetics;
    preview.current = enabled;
    setPreviewAllCosmetics(enabled);
    if (!enabled) void loadAvatarData();
  }

  const updateAppearance = useCallback((patch: Partial<AvatarAppearance>) => {
    keepDraft.current = true;
    setAppearanceSaveError("");
    setAvatar((current) => current ? {
      ...current,
      ...(patch.bodyType ? { bodyType: patch.bodyType } : {}),
      ...(patch.hairId ? { equippedHairId: patch.hairId } : {}),
      ...(patch.skinColorId ? { skinColorId: patch.skinColorId } : {}),
      ...(patch.hairColorId ? { hairColorId: patch.hairColorId } : {}),
      ...(patch.eyeColorId ? { eyeColorId: patch.eyeColorId } : {}),
    } : current);
    if (patch.hairId) {
      setCosmetics((current) => current.map((item) => item.type === "HAIR"
        ? { ...item, equipped: item.id === patch.hairId }
        : item));
    }
  }, []);

  const toggleCosmetic = useCallback(async (cosmetic: Cosmetic) => {
    if (CAN_PREVIEW_ALL_COSMETICS && previewAllCosmetics) {
      previewCosmetic(cosmetic);
      return;
    }
    const claim = !cosmetic.unlocked && cosmetic.claimable && !entitlement.loading && entitlement.premium;
    if (!cosmetic.unlocked && !claim) {
      return;
    }

    try {
      setLoadingId(cosmetic.id);
      setEquipmentError("");
      if (cosmetic.type === "HAIR") {
        updateAppearance({ hairId: String(cosmetic.id) });
        return;
      }
      if (userId == null) return;
      loadVersion.current++;
      playerCache.invalidate(userId, claim ? undefined : ["inventory", "shop"]);
      const accountCurrent = playerCache.accountCurrent(userId);
      const config = { expectedUserId: String(userId) } as AxiosRequestConfig;
      if (claim) {
        // The existing zero-price purchase transaction verifies Premium and
        // writes permanent ownership. Equip still performs its own server check.
        await api.post(apiRoutes.shopPurchase, { itemId: String(cosmetic.id) }, config);
        if (!accountCurrent()) return;
      }
      await api.post(
        cosmetic.equipped ? apiRoutes.inventoryUnequip : apiRoutes.inventoryEquip,
        { itemId: String(cosmetic.id) },
        config,
      );
      if (!accountCurrent()) return;
      playerCache.invalidate(userId, claim ? undefined : ["inventory", "shop"]);
      await loadAvatarData();
    } catch (error) {
      const failure = apiError(error, "Could not update that item.");
      if (failure.code === "PREMIUM_REQUIRED") await refreshEntitlements?.();
      if (claim && userId != null) {
        // A claim can succeed even if the following equip fails. Reconcile the
        // actual ownership/entitlement flags before offering another action.
        playerCache.invalidate(userId);
        await loadAvatarData();
      }
      const message = failure.message;
      setEquipmentError(message);
      showGameNotice("Character", message, "error");
    } finally {
      setLoadingId(null); setRefreshing(false);
    }
  }, [previewAllCosmetics, previewCosmetic, updateAppearance, loadAvatarData, userId, entitlement.loading, entitlement.premium, refreshEntitlements]);

  async function saveAppearance() {
    if (!user || !draftAppearance || !appearanceDirty || savingAppearance) return;
    try {
      setSavingAppearance(true);
      setAppearanceSaveError("");
      loadVersion.current++;
      playerCache.invalidate(user.id, ["profile"]);
      const accountCurrent = playerCache.accountCurrent(user.id);
      const response = await api.patch<AvatarAppearance>(apiRoutes.me, draftAppearance, { expectedUserId: String(user.id) } as AxiosRequestConfig);
      if (!accountCurrent()) return;
      const persisted = normalizeAppearance(response.data);
      const profile = playerCache.peek(user.id, "profile");
      if (profile) playerCache.set(user.id, "profile", { ...profile, ...persisted });
      keepDraft.current = false;
      setSavedAppearance(persisted);
      setAvatar((current) => current ? {
        ...current,
        bodyType: persisted.bodyType,
        equippedHairId: persisted.hairId,
        skinColorId: persisted.skinColorId,
        hairColorId: persisted.hairColorId,
        eyeColorId: persisted.eyeColorId,
      } : current);
      await setLocalAppearance(user.id, persisted);
      setEditingAppearance(false);
      showGameNotice("Appearance saved", "Your appearance is saved.", "success");
    } catch (error) {
      const failure = apiError(error, "Could not save your appearance. Please try again.");
      setAppearanceSaveError(failure.code === "INVALID_HAIR_ID"
        ? "The server does not support this hairstyle yet. Choose another hairstyle to save, or keep this draft until the server is updated."
        : failure.message);
    } finally {
      setSavingAppearance(false); setRefreshing(false);
    }
  }

  function closeAppearanceEditor() {
    if (savingAppearance) return;
    if (!appearanceDirty) {
      keepDraft.current = false;
      setConfirmDiscardAppearance(false);
      setEditingAppearance(false);
      return;
    }
    // Alert.alert is a no-op on web. Keep the confirmation inside this sheet.
    setConfirmDiscardAppearance(true);
  }

  function discardAppearance() {
    if (savedAppearance) updateAppearance(savedAppearance);
    keepDraft.current = false;
    setConfirmDiscardAppearance(false);
    setEditingAppearance(false);
  }

  const draftAppearance = avatar ? normalizeAppearance({
    bodyType: avatar.bodyType,
    hairId: typeof avatar.equippedHairId === "string" ? avatar.equippedHairId : undefined,
    skinColorId: avatar.skinColorId,
    hairColorId: avatar.hairColorId,
    eyeColorId: avatar.eyeColorId,
  }) : null;
  const appearanceDirty = Boolean(draftAppearance && savedAppearance
    && JSON.stringify(draftAppearance) !== JSON.stringify(savedAppearance));

  return <AvatarContent avatar={avatar} cosmetics={cosmetics} username={user?.username} level={user?.level}
    selectedType={selectedType} loading={loading} refreshing={refreshing} loadingId={loadingId} loadError={loadError} equipmentError={equipmentError}
    premiumItemIds={premiumItemIds} previewAllCosmetics={previewAllCosmetics} canPreview={CAN_PREVIEW_ALL_COSMETICS}
    premiumAvailable={!entitlement.loading && entitlement.premium} onPremium={() => router.push("/premium")}
    editingAppearance={editingAppearance} confirmDiscardAppearance={confirmDiscardAppearance}
    draftAppearance={draftAppearance} appearanceDirty={appearanceDirty} savingAppearance={savingAppearance} appearanceSaveError={appearanceSaveError}
    onType={setSelectedType} onEquip={toggleCosmetic} onRetry={() => void loadAvatarData()}
    onEditAppearance={() => setEditingAppearance(true)} onCloseAppearance={closeAppearanceEditor}
    onKeepEditing={() => setConfirmDiscardAppearance(false)} onDiscardAppearance={discardAppearance}
    onChangeAppearance={updateAppearance} onSaveAppearance={() => void saveAppearance()} onTogglePreview={toggleCosmeticPreview} />;
}
