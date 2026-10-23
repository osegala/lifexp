import premiumCollection from "../../assets/avatar/v2/premium-collection.json";
import { useMemo, useState } from "react";
import { Platform, View, useWindowDimensions } from "react-native";
import { NavigationContainer } from "expo-router/react-navigation";
import { createBottomTabNavigator } from "expo-router/js-tabs";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import AvatarContent from "../components/AvatarContent";
import { FilterChip, ScreenShell, UiText } from "../components/ui/Primitives";
import { DEFAULT_APPEARANCE, normalizeAppearance, type AvatarAppearance } from "../avatar/appearance";
import { avatarFromInventory, wardrobeCosmetics } from "../avatar/inventory";
import { getCosmeticAssetIds, getCosmeticAssetMetadata } from "../avatar/assetRegistry";
import { uiTheme as ui } from "../theme/theme";
import { tabAppearance, TabIcon, tabIcons } from "../navigation/tabAppearance";
import type { ShopItem, ShopResponse } from "../types";
import type { Cosmetic, CosmeticType, InventoryEquipment, InventoryResponse } from "../types/avatar";

// Actual catalog art with explicit review fixtures; no API/auth/billing/ad requests.
const gear = (itemId: string, name: string, category: string, assetKey: string): ShopItem => ({
  itemId, name, category, assetKey, price: 0, effectivePrice: 0, requiredLevel: 1, effectiveRequiredLevel: 1,
  requiredAchievement: null, achievementRequirement: null, requirementSatisfied: true,
  owned: true, unlocked: true, canAfford: true, canPurchase: false, status: "OWNED",
});
const shop: ShopResponse = { player: { coins: 284, level: 6 }, items: [
  gear("starweaver_tunic", "Starweaver Tunic", "tunic", "avatar-v2/tops/forest-ranger"),
  gear("forest_ranger_trousers", "Forest Ranger Trousers", "pants", "avatar-v2/bottoms/forest-ranger-trousers"),
  gear("forest_ranger_boots", "Forest Ranger Boots", "boots", "avatar-v2/boots/forest-ranger-boots"),
  gear("forestbound_dress", "Forestbound Dress", "tunic", "avatar-v2/dresses/forest-ranger"),
  gear("castle_garden", "Castle Garden", "background", "avatar-v2/backgrounds/castle-garden"),
  gear("grand_library", "Grand Library", "background", "avatar-v2/backgrounds/grand-library"),
  gear("ember_drake", "Ember Drake", "pet", "avatar-v2/pets/ember-drake"),
  gear("verdant_wisps", "Verdant Wisps", "aura", "avatar-v2/auras/verdant-wisps"),
  { ...gear("forestbound_cap", "Forestbound Cap", "hat", "avatar-v2/hats/forest-ranger-hat"), owned: false, unlocked: false,
    status: "LOCKED", effectiveRequiredLevel: 9, canPurchase: false },
  ...premiumCollection.map(item => ({ ...gear(item.itemId, item.name, item.category, item.assetKey), requiresPremium: true })),
] };
const equipment: InventoryEquipment = { tunic: "starweaver_tunic", pants: "forest_ranger_trousers", boots: "forest_ranger_boots",
  background: "castle_garden", hair: null, hat: null, pet: "ember_drake", aura: "verdant_wisps" };
const initial: InventoryResponse = { equipped: equipment, items: shop.items.filter(item => item.owned).map(item => ({
  itemId: item.itemId, name: item.name, category: item.category, assetKey: item.assetKey, purchasedAt: null, purchasePrice: 0,
  equipped: Object.values(equipment).includes(item.itemId),
})) };
function premiumInventory(set: string, dress: boolean, scene = "premium_starwatch_terrace", aura: string | null = "premium_lunar_veil", pet: string | null = "premium_mooncrystal_fawn") {
  const find = (kind: string) => premiumCollection.find(item => item.set === set && item.kind === kind)?.itemId;
  if (!find("tops")) return initial;
  const equipped: InventoryEquipment = { ...equipment, tunic: find(dress ? "dresses" : "tops")!, pants: find("bottoms")!, hat: find("hats")!, boots: find("boots")!, background: scene, aura, pet };
  return { ...initial, equipped, items: initial.items.map(item => ({ ...item, equipped: Object.values(equipped).includes(item.itemId) })) };
}
const params = () => new URLSearchParams(Platform.OS === "web" ? window.location.search : "");
const slots: Record<CosmeticType, keyof InventoryEquipment> = { HAIR: "hair", HAT: "hat", TOP: "tunic", BOTTOM: "pants", BOOTS: "boots", BACKGROUND: "background", PET: "pet", AURA: "aura" };
function PreviewAvatar() {
  const [mode, setMode] = useState("Normal"), [controls, setControls] = useState(true);
  const [inventory, setInventory] = useState(() => params().has("look") ? premiumInventory(params().get("look")!, params().get("outfit") === "dress",
    params().get("scene") ?? undefined, params().get("aura") === "none" ? null : params().get("aura") ?? undefined,
    params().get("pet") === "none" ? null : params().get("pet") ?? undefined) : initial);
  const [appearance, setAppearance] = useState<AvatarAppearance>(() => ({ ...DEFAULT_APPEARANCE, bodyType: params().get("body") === "GIRL" ? "GIRL" : "BOY" }));
  const [saved, setSaved] = useState(appearance), [editing, setEditing] = useState(false), [discard, setDiscard] = useState(false);
  const [selectedType, setSelectedType] = useState<CosmeticType>("HAIR"), [previewAll, setPreviewAll] = useState(false);
  const [loadingId, setLoadingId] = useState<string | number | null>(null), [saving, setSaving] = useState(false);
  const [error, setError] = useState(""), [equipmentError, setEquipmentError] = useState("");
  const cosmetics = useMemo(() => wardrobeCosmetics(shop, inventory, getCosmeticAssetIds("hair"), appearance.hairId, getCosmeticAssetMetadata), [inventory, appearance]);
  const avatar = avatarFromInventory(inventory, appearance);
  const dirty = JSON.stringify(appearance) !== JSON.stringify(saved);
  function premiumLook(set: string, dress: boolean) { setInventory(premiumInventory(set, dress)); setSelectedType("TOP"); }
  function change(patch: Partial<AvatarAppearance>) { setAppearance(value => normalizeAppearance({ ...value, ...patch })); setError(""); }
  function equip(cosmetic: Cosmetic) {
    if (!previewAll && !cosmetic.unlocked) return;
    if (mode === "Equipment failure") { setEquipmentError("Could not update that item. Your equipped look has not changed."); return; }
    if (cosmetic.type === "HAIR") { change({ hairId: String(cosmetic.id) }); return; }
    setLoadingId(cosmetic.id); setEquipmentError("");
    setTimeout(() => {
      const next = cosmetic.equipped ? null : String(cosmetic.id);
      setInventory(value => ({ ...value, equipped: { ...value.equipped, [slots[cosmetic.type]]: next },
        items: value.items.map(item => item.category === shop.items.find(row => row.itemId === cosmetic.id)?.category
          ? { ...item, equipped: item.itemId === next } : item) }));
      setLoadingId(null);
    }, 500);
  }
  function save() {
    if (mode === "Save failure") { setError("Could not save your appearance. Please try again."); return; }
    setSaving(true);
    setTimeout(() => { setSaved(appearance); setSaving(false); setEditing(false); }, 500);
  }
  function close() { if (!saving) { if (dirty) setDiscard(true); else setEditing(false); } }
  return <View style={{ flex: 1, backgroundColor: ui.colors.background }}>
    <View testID="avatar-review-controls" style={{ padding: ui.spacing.sm, gap: ui.spacing.sm, borderBottomWidth: 1, borderBottomColor: ui.colors.border }}>
      <UiText variant="caption">DEV Avatar shell review · fixture inventory · no account or network</UiText>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: ui.spacing.xs }}>
        {controls && ["Normal", "Loading", "Error", "Empty hats", "Equipment failure", "Save failure", "Long name"].map(label =>
          <FilterChip key={label} label={label} selected={mode === label} onPress={() => { setMode(label); if (label === "Empty hats") setSelectedType("HAT"); }} />)}
        {controls && ["rose_bard", "verdant_sovereign", "celestial_regent", "dawnfire_sovereign", "royal_wayfinder"].map(set =>
          <View key={set} style={{ flexDirection: "row", gap: 4 }}><FilterChip label={`${set} tunic`} onPress={() => premiumLook(set, false)} />
            <FilterChip label={`${set} dress`} onPress={() => premiumLook(set, true)} /></View>)}
        <FilterChip label={controls ? "Hide review controls" : "Show review controls"} onPress={() => setControls(value => !value)} />
      </View>
    </View>
    <View testID="avatar-review" style={{ flex: 1 }}><AvatarContent avatar={mode === "Loading" ? null : avatar}
      cosmetics={mode === "Empty hats" ? cosmetics.filter(item => item.type !== "HAT") : cosmetics}
      username={mode === "Long name" ? "Rowan the patient adventurer with a longer name" : "Rowan"} level={6}
      selectedType={selectedType} loading={mode === "Loading"} loadingId={loadingId}
      loadError={mode === "Error" ? "Could not refresh your wardrobe. Showing your last confirmed look." : ""}
      equipmentError={equipmentError} premiumItemIds={premiumCollection.map(item => item.itemId)} premiumAvailable previewAllCosmetics={previewAll} canPreview
      editingAppearance={editing} confirmDiscardAppearance={discard} draftAppearance={appearance}
      appearanceDirty={dirty} savingAppearance={saving} appearanceSaveError={error}
      onType={setSelectedType} onEquip={equip} onRetry={() => setMode("Normal")}
      onEditAppearance={() => setEditing(true)} onCloseAppearance={close} onKeepEditing={() => setDiscard(false)}
      onDiscardAppearance={() => { setAppearance(saved); setDiscard(false); setEditing(false); }}
      onChangeAppearance={change} onSaveAppearance={save} onTogglePreview={() => { setPreviewAll(value => !value); if (previewAll) setInventory(initial); }} />
    </View>
  </View>;
}
const Tabs = createBottomTabNavigator();
const titles = { dashboard: "Home", tasks: "Tasks", base: "Base", avatar: "Avatar", shop: "Shop" };
function OtherTab() { return <ScreenShell><UiText>This screen is unchanged. Return to Avatar to review.</UiText></ScreenShell>; }
function PreviewTabs() {
  const { bottom } = useSafeAreaInsets(), { fontScale } = useWindowDimensions();
  return <Tabs.Navigator initialRouteName="avatar" screenOptions={{ headerShown: false, ...tabAppearance(bottom, fontScale) }}>
    {(Object.keys(titles) as (keyof typeof tabIcons)[]).map(name => <Tabs.Screen key={name} name={name}
      component={name === "avatar" ? PreviewAvatar : OtherTab}
      options={{ title: titles[name], tabBarIcon: props => <TabIcon tab={name} {...props} /> }} />)}
  </Tabs.Navigator>;
}
export default function AvatarPreview() {
  return __DEV__ ? <SafeAreaProvider><NavigationContainer><PreviewTabs /></NavigationContainer></SafeAreaProvider> : null;
}
