import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Alert } from "react-native";
import { api, apiError } from "../../src/api/client";
import { apiRoutes } from "../../src/api/routes";
import { getCosmeticAssetIds, getCosmeticAssetMetadata } from "../../src/avatar/assetRegistry";
import { avatarFromInventory, wardrobeCosmetics } from "../../src/avatar/inventory";
import { getLocalAppearance, setLocalAppearance } from "../../src/avatar/localAppearance";
import { loadPreferredAppearance, normalizeAppearance } from "../../src/avatar/appearance";
import type { AvatarAppearance } from "../../src/avatar/appearance";
import AvatarContent from "../../src/components/AvatarContent";
import { useAuth } from "../../src/context/AuthContext";
import { environment } from "../../src/config/environment";
import type { ShopResponse } from "../../src/types";
import type { Avatar, Cosmetic, CosmeticId, CosmeticType, InventoryResponse } from "../../src/types/avatar";

const BUILT_IN_HAIR_IDS = getCosmeticAssetIds("hair");
const CAN_PREVIEW_ALL_COSMETICS = __DEV__ && environment.environment === "dev";
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
  const { user } = useAuth();
  const [avatar, setAvatar] = useState<Avatar | null>(null);
  const [cosmetics, setCosmetics] = useState<Cosmetic[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingId, setLoadingId] = useState<CosmeticId | null>(null);
  const [savingAppearance, setSavingAppearance] = useState(false);
  const [appearanceSaveError, setAppearanceSaveError] = useState("");
  const [savedAppearance, setSavedAppearance] = useState<AvatarAppearance | null>(null);
  const [editingAppearance, setEditingAppearance] = useState(false);
  const [confirmDiscardAppearance, setConfirmDiscardAppearance] = useState(false);
  const [previewAllCosmetics, setPreviewAllCosmetics] = useState(false);
  const [selectedType, setSelectedType] = useState<CosmeticType>("HAIR");
  const [loadError, setLoadError] = useState("");
  const [equipmentError, setEquipmentError] = useState("");
  const [premiumItemIds, setPremiumItemIds] = useState<string[]>([]);

  const loadAvatarData = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      const [shopResponse, inventoryResponse, appearance] = await Promise.all([
        api.get<ShopResponse>(apiRoutes.shop),
        api.get<InventoryResponse>(apiRoutes.inventory),
        loadPreferredAppearance(
          async () => (await api.get<AvatarAppearance>(apiRoutes.me)).data,
          () => getLocalAppearance(user.id),
          (serverAppearance) => setLocalAppearance(user.id, serverAppearance),
        ),
      ]);
      setLoadError("");
      setPremiumItemIds(shopResponse.data.items.filter(item => item.requiresPremium).map(item => item.itemId));
      setSavedAppearance(appearance);
      setAvatar(avatarFromInventory(inventoryResponse.data, appearance));
      setCosmetics(wardrobeCosmetics(
        shopResponse.data,
        inventoryResponse.data,
        BUILT_IN_HAIR_IDS,
        appearance.hairId,
        getCosmeticAssetMetadata,
        (itemId, assetKey) => {
          if (__DEV__) console.warn(`Unresolved wardrobe asset for ${itemId}: ${assetKey || "<missing>"}`);
        },
      ));
    } catch (error) {
      const message = apiError(error, "Could not load your wardrobe.").message;
      setLoadError(message);
      Alert.alert("Character", message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      loadAvatarData();
    }, [loadAvatarData]),
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
    setPreviewAllCosmetics(enabled);
    if (!enabled) void loadAvatarData();
  }

  const updateAppearance = useCallback((patch: Partial<AvatarAppearance>) => {
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
    if (!cosmetic.unlocked) {
      return;
    }

    try {
      setLoadingId(cosmetic.id);
      setEquipmentError("");
      if (cosmetic.type === "HAIR") {
        updateAppearance({ hairId: String(cosmetic.id) });
        return;
      }
      await api.post(
        cosmetic.equipped ? apiRoutes.inventoryUnequip : apiRoutes.inventoryEquip,
        { itemId: String(cosmetic.id) },
      );
      await loadAvatarData();
    } catch (error) {
      const message = apiError(error, "Could not update that item.").message;
      setEquipmentError(message);
      Alert.alert("Character", message);
    } finally {
      setLoadingId(null);
    }
  }, [previewAllCosmetics, previewCosmetic, updateAppearance, loadAvatarData]);

  async function saveAppearance() {
    if (!user || !draftAppearance || !appearanceDirty || savingAppearance) return;
    try {
      setSavingAppearance(true);
      setAppearanceSaveError("");
      const response = await api.patch<AvatarAppearance>(apiRoutes.me, draftAppearance);
      const persisted = normalizeAppearance(response.data);
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
      Alert.alert("Appearance", "Your appearance is saved.");
    } catch (error) {
      const failure = apiError(error, "Could not save your appearance. Please try again.");
      setAppearanceSaveError(failure.code === "INVALID_HAIR_ID"
        ? "The server does not support this hairstyle yet. Choose another hairstyle to save, or keep this draft until the server is updated."
        : failure.message);
    } finally {
      setSavingAppearance(false);
    }
  }

  function closeAppearanceEditor() {
    if (savingAppearance) return;
    if (!appearanceDirty) {
      setConfirmDiscardAppearance(false);
      setEditingAppearance(false);
      return;
    }
    // Alert.alert is a no-op on web. Keep the confirmation inside this sheet.
    setConfirmDiscardAppearance(true);
  }

  function discardAppearance() {
    if (savedAppearance) updateAppearance(savedAppearance);
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
    selectedType={selectedType} loading={loading} loadingId={loadingId} loadError={loadError} equipmentError={equipmentError}
    premiumItemIds={premiumItemIds} previewAllCosmetics={previewAllCosmetics} canPreview={CAN_PREVIEW_ALL_COSMETICS}
    editingAppearance={editingAppearance} confirmDiscardAppearance={confirmDiscardAppearance}
    draftAppearance={draftAppearance} appearanceDirty={appearanceDirty} savingAppearance={savingAppearance} appearanceSaveError={appearanceSaveError}
    onType={setSelectedType} onEquip={toggleCosmetic} onRetry={() => void loadAvatarData()}
    onEditAppearance={() => setEditingAppearance(true)} onCloseAppearance={closeAppearanceEditor}
    onKeepEditing={() => setConfirmDiscardAppearance(false)} onDiscardAppearance={discardAppearance}
    onChangeAppearance={updateAppearance} onSaveAppearance={() => void saveAppearance()} onTogglePreview={toggleCosmeticPreview} />;
}
