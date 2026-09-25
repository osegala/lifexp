import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";

import { api, apiError } from "../../src/api/client";
import { apiRoutes } from "../../src/api/routes";
import {
  getCosmeticAssetIds,
  getCosmeticAssetMetadata,
  getCosmeticPreviewCrop,
  getCosmeticPreviewSource,
  getEquippedSceneSource,
} from "../../src/avatar/assetRegistry";
import {
  avatarFromInventory,
  loadOptionalAppearance,
  wardrobeCosmetics,
} from "../../src/avatar/inventory";
import { getLocalBodyType, getLocalHairId, setLocalHairId } from "../../src/avatar/localAppearance";
import CosmeticImage from "../../src/components/CosmeticImage";
import AvatarRenderer from "../../src/components/AvatarRenderer";
import LifeCard from "../../src/components/LifeCard";
import { useAuth } from "../../src/context/AuthContext";
import { colors, radius, spacing } from "../../src/theme/theme";
import type { ShopResponse } from "../../src/types";
import { Avatar, Cosmetic, CosmeticId, CosmeticType, InventoryResponse } from "../../src/types/avatar";

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>["name"];

type WardrobeSection = {
  title: string;
  type: CosmeticType;
  icon: IconName;
};

const WARDROBE_SECTIONS: WardrobeSection[] = [
  { title: "Hair", type: "HAIR", icon: "face-man-shimmer" },
  { title: "Hats", type: "HAT", icon: "wizard-hat" },
  { title: "Tops & Dresses", type: "TOP", icon: "tshirt-crew" },
  { title: "Bottoms", type: "BOTTOM", icon: "human-male" },
  { title: "Boots", type: "BOOTS", icon: "shoe-formal" },
  { title: "Scenes", type: "BACKGROUND", icon: "image" },
  { title: "Pets", type: "PET", icon: "paw" },
  { title: "Auras", type: "AURA", icon: "star-four-points" },
];
const BUILT_IN_HAIR_IDS = getCosmeticAssetIds("hair");

export default function AvatarScreen() {
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const stackedHero = width < 760;
  const [avatar, setAvatar] = useState<Avatar | null>(null);
  const [cosmetics, setCosmetics] = useState<Cosmetic[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingId, setLoadingId] = useState<CosmeticId | null>(null);
  const [selectedType, setSelectedType] = useState<CosmeticType>("HAIR");

  const loadAvatarData = useCallback(async () => {
    try {
      setLoading(true);
      const [shopResponse, inventoryResponse, appearance] = await Promise.all([
        api.get<ShopResponse>(apiRoutes.shop),
        api.get<InventoryResponse>(apiRoutes.inventory),
        loadOptionalAppearance(getLocalBodyType, getLocalHairId),
      ]);
      const { bodyType, hairId } = appearance;
      setAvatar(avatarFromInventory(inventoryResponse.data, bodyType, hairId));
      setCosmetics(wardrobeCosmetics(
        shopResponse.data,
        inventoryResponse.data,
        BUILT_IN_HAIR_IDS,
        hairId,
        getCosmeticAssetMetadata,
        (itemId, assetKey) => {
          if (__DEV__) console.warn(`Unresolved wardrobe asset for ${itemId}: ${assetKey || "<missing>"}`);
        },
      ));
    } catch (error) {
      Alert.alert("Character", apiError(error, "Could not load your wardrobe.").message);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadAvatarData();
    }, [loadAvatarData]),
  );

  async function toggleCosmetic(cosmetic: Cosmetic) {
    if (!cosmetic.unlocked) {
      return;
    }

    try {
      setLoadingId(cosmetic.id);
      if (cosmetic.type === "HAIR") {
        const hairId = cosmetic.equipped ? null : String(cosmetic.id);
        setAvatar((current) => current
          ? { ...current, equippedHairId: hairId }
          : current);
        setCosmetics((current) => current.map((item) => item.type === "HAIR"
          ? { ...item, equipped: item.id === hairId }
          : item));
        await setLocalHairId(hairId);
        return;
      }
      await api.post(
        cosmetic.equipped ? apiRoutes.inventoryUnequip : apiRoutes.inventoryEquip,
        { itemId: String(cosmetic.id) },
      );
      await loadAvatarData();
    } catch (error) {
      Alert.alert("Character", apiError(error, "Could not update that item.").message);
    } finally {
      setLoadingId(null);
    }
  }

  const activeSection =
    WARDROBE_SECTIONS.find((section) => section.type === selectedType) ??
    WARDROBE_SECTIONS[0];
  const activeCosmetics = useMemo(
    () => cosmetics.filter((cosmetic) => cosmetic.type === selectedType),
    [cosmetics, selectedType],
  );
  const equippedCosmetics = cosmetics.filter((cosmetic) => cosmetic.equipped);
  const backgroundImage = getEquippedSceneSource(cosmetics, avatar?.equippedBackgroundId, "BACKGROUND");
  const mobileGridWidth = width - spacing.lg * 2;
  const cardWidth = width >= 900 ? 210 : width >= 620 ? 190
    : mobileGridWidth >= 300 + spacing.md
      ? (mobileGridWidth - spacing.md) / 2
      : mobileGridWidth;

  if (loading && !avatar) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={styles.loadingText}>Opening your wardrobe…</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      alwaysBounceVertical={false}
      bounces={false}
      overScrollMode="never"
    >
      <LifeCard style={[styles.heroCard, stackedHero && styles.stackedHeroCard]}>
        <View style={[styles.previewShell, stackedHero && styles.stackedPreviewShell]}>
          <View style={styles.previewGlow} />
          {backgroundImage && (
            <Image source={backgroundImage} style={styles.previewBackground} resizeMode="stretch" />
          )}
          <AvatarRenderer
            showBackground={false}
            hairId={avatar?.equippedHairId}
            hatId={avatar?.equippedHatId}
            topId={avatar?.equippedTopId}
            bottomId={avatar?.equippedBottomId}
            bootsId={avatar?.equippedBootsId}
            backgroundId={avatar?.equippedBackgroundId}
            petId={avatar?.equippedPetId}
            auraId={avatar?.equippedAuraId}
            bodyType={avatar?.bodyType}
            cosmetics={cosmetics}
          />
        </View>

        <View style={[styles.heroCopy, stackedHero && styles.stackedHeroCopy]}>
          <Text style={styles.eyebrow}>CHARACTER WARDROBE</Text>
          <Text style={styles.heroTitle}>{user?.username ?? "Adventurer"}</Text>
          <Text style={styles.heroLevel}>Hero Level {user?.level ?? 1}</Text>
          <Text style={styles.heroDescription}>
            Every outfit and hairstyle fits both characters. Mix pieces to
            build your hero; dresses cover your saved bottoms while worn.
          </Text>

          <View style={styles.equippedList}>
            {equippedCosmetics.slice(0, 6).map((cosmetic) => (
              <View key={cosmetic.id} style={styles.equippedChip}>
                <View style={styles.equippedDot} />
                <Text numberOfLines={1} style={styles.equippedChipText}>
                  {cosmetic.name}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </LifeCard>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.sectionTabs}
      >
        {WARDROBE_SECTIONS.map((section) => {
          const selected = section.type === selectedType;
          const count = cosmetics.filter(
            (cosmetic) => cosmetic.type === section.type,
          ).length;

          return (
            <Pressable
              key={section.type}
              onPress={() => setSelectedType(section.type)}
              style={[styles.sectionTab, selected && styles.selectedSectionTab]}
            >
              <MaterialCommunityIcons
                name={section.icon}
                size={18}
                color={selected ? colors.background : colors.mutedText}
              />
              <Text
                style={[
                  styles.sectionTabText,
                  selected && styles.selectedSectionTabText,
                ]}
              >
                {section.title}
              </Text>
              {count > 0 && (
                <View
                  style={[
                    styles.countBadge,
                    selected && styles.selectedCountBadge,
                  ]}
                >
                  <Text
                    style={[
                      styles.countBadgeText,
                      selected && styles.selectedCountBadgeText,
                    ]}
                  >
                    {count}
                  </Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.sectionHeading}>
        <View>
          <Text style={styles.sectionTitle}>{activeSection.title}</Text>
          <Text style={styles.sectionSubtitle}>
            {activeCosmetics.length} option
            {activeCosmetics.length === 1 ? "" : "s"} in this collection
          </Text>
        </View>
        {loading && <ActivityIndicator color={colors.accent} />}
      </View>

      <View style={styles.cosmeticGrid}>
        {activeCosmetics.length === 0 ? (
          <LifeCard compact style={styles.emptyCard}>
            <MaterialCommunityIcons
              name={activeSection.icon}
              size={34}
              color={colors.mutedText}
            />
            <Text style={styles.emptyTitle}>More gear is on the way</Text>
            <Text style={styles.emptyText}>
              This wardrobe shelf is ready for future rewards.
            </Text>
          </LifeCard>
        ) : (
          activeCosmetics.map((cosmetic) => (
            <CosmeticCard
              key={cosmetic.id}
              cosmetic={cosmetic}
              width={cardWidth}
              loading={loadingId === cosmetic.id}
              onEquip={toggleCosmetic}
            />
          ))
        )}
      </View>
    </ScrollView>
  );
}

function CosmeticCard({
  cosmetic,
  width,
  loading,
  onEquip,
}: {
  cosmetic: Cosmetic;
  width: number;
  loading: boolean;
  onEquip: (cosmetic: Cosmetic) => void;
}) {
  const previewSource = getCosmeticPreviewSource(cosmetic);

  return (
    <View
      style={[
        styles.cosmeticCard,
        { width },
        cosmetic.equipped && styles.equippedCard,
      ]}
    >
      <View style={styles.itemPreview}>
        {previewSource ? (
          <CosmeticImage
            source={previewSource}
            crop={getCosmeticPreviewCrop(cosmetic)}
            style={styles.previewImage}
          />
        ) : (
          <MaterialCommunityIcons name="hanger" size={34} color={colors.mutedText} />
        )}

        {cosmetic.equipped && (
          <View style={styles.equippedBadge}>
            <MaterialCommunityIcons name="check" size={14} color={colors.background} />
            <Text style={styles.equippedBadgeText}>Equipped</Text>
          </View>
        )}

        {!cosmetic.unlocked && (
          <View style={styles.lockBadge}>
            <MaterialCommunityIcons name="lock" size={14} color={colors.text} />
          </View>
        )}
      </View>

      <Text numberOfLines={1} style={styles.cosmeticName}>
        {cosmetic.name}
      </Text>
      <Text style={styles.cosmeticMeta}>
        {cosmetic.unlocked
          ? "In your collection"
          : cosmetic.requirementText ?? "Available in the Shop"}
      </Text>

      <Pressable
        onPress={() => onEquip(cosmetic)}
        disabled={!cosmetic.unlocked || loading}
        style={({ pressed }) => [
          styles.equipButton,
          cosmetic.equipped && styles.unequipButton,
          !cosmetic.unlocked && styles.lockedButton,
          pressed && styles.pressedButton,
        ]}
      >
        {loading ? (
          <ActivityIndicator size="small" color={colors.background} />
        ) : (
          <Text
            style={[
              styles.equipButtonText,
              !cosmetic.unlocked &&
                styles.disabledButtonText,
            ]}
          >
            {cosmetic.equipped
              ? "Unequip"
              : cosmetic.unlocked
                ? "Equip"
                : "Locked"}
          </Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
    backgroundColor: colors.background,
  },
  loadingText: {
    color: colors.mutedText,
    fontWeight: "600",
  },
  content: {
    width: "100%",
    maxWidth: 1160,
    alignSelf: "center",
    padding: spacing.lg,
    paddingBottom: 120,
    gap: spacing.lg,
  },
  heroCard: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xl,
    overflow: "hidden",
  },
  stackedHeroCard: {
    flexDirection: "column",
    flexWrap: "nowrap",
    justifyContent: "flex-start",
  },
  previewShell: {
    width: 330,
    height: 440,
    maxWidth: "100%",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.lg,
    backgroundColor: "#101D2B",
    borderWidth: 1,
    borderColor: "#35516A",
    overflow: "hidden",
  },
  stackedPreviewShell: {
    width: "100%",
    maxWidth: 330,
    alignSelf: "center",
  },
  previewGlow: {
    position: "absolute",
    top: 70,
    width: 220,
    height: 260,
    borderRadius: 999,
    backgroundColor: "#2A67A8",
    opacity: 0.2,
  },
  previewBackground: {
    ...StyleSheet.absoluteFill,
    width: "100%",
    height: "100%",
  },
  heroCopy: {
    flex: 1,
    minWidth: 260,
    maxWidth: 470,
  },
  stackedHeroCopy: {
    flex: 0,
    flexBasis: "auto",
    flexShrink: 0,
    minWidth: 0,
    width: "100%",
    alignSelf: "center",
  },
  eyebrow: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.8,
  },
  heroTitle: {
    color: colors.text,
    fontSize: 34,
    fontWeight: "800",
    marginTop: spacing.xs,
  },
  heroLevel: {
    color: colors.primary,
    fontSize: 17,
    fontWeight: "700",
    marginTop: 2,
  },
  heroDescription: {
    color: colors.mutedText,
    fontSize: 15,
    lineHeight: 22,
    marginTop: spacing.md,
  },
  equippedList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
    marginTop: spacing.lg,
  },
  equippedChip: {
    maxWidth: 170,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.cardLight,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
    paddingVertical: 7,
  },
  equippedDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.accent,
  },
  equippedChipText: {
    flexShrink: 1,
    color: colors.text,
    fontSize: 11,
    fontWeight: "700",
  },
  sectionTabs: {
    gap: spacing.sm,
    paddingRight: spacing.lg,
  },
  sectionTab: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    backgroundColor: colors.cardLight,
    paddingHorizontal: spacing.md,
  },
  selectedSectionTab: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  sectionTabText: {
    color: colors.mutedText,
    fontSize: 13,
    fontWeight: "700",
  },
  selectedSectionTabText: {
    color: colors.background,
  },
  countBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
    paddingHorizontal: 5,
  },
  selectedCountBadge: {
    backgroundColor: "rgba(10, 18, 14, 0.18)",
  },
  countBadgeText: {
    color: colors.mutedText,
    fontSize: 10,
    fontWeight: "800",
  },
  selectedCountBadgeText: {
    color: colors.background,
  },
  sectionHeading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 24,
    fontWeight: "800",
  },
  sectionSubtitle: {
    color: colors.mutedText,
    fontSize: 13,
    marginTop: 3,
  },
  cosmeticGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
  },
  cosmeticCard: {
    minWidth: 150,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: spacing.sm,
  },
  equippedCard: {
    borderColor: colors.accent,
    backgroundColor: "#172820",
  },
  itemPreview: {
    width: "100%",
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.md,
    backgroundColor: "#101A23",
    overflow: "hidden",
  },
  previewImage: {
    width: "96%",
    height: "96%",
  },
  equippedBadge: {
    position: "absolute",
    left: 8,
    top: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    paddingHorizontal: 7,
    paddingVertical: 4,
  },
  equippedBadgeText: {
    color: colors.background,
    fontSize: 9,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  lockBadge: {
    position: "absolute",
    right: 8,
    top: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(10, 18, 14, 0.8)",
  },
  cosmeticName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "800",
    marginTop: spacing.sm,
  },
  cosmeticMeta: {
    minHeight: 34,
    color: colors.mutedText,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 2,
  },
  equipButton: {
    minHeight: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.md,
    backgroundColor: colors.accent,
    marginTop: spacing.sm,
  },
  unequipButton: {
    backgroundColor: "#7A3E46",
  },
  lockedButton: {
    backgroundColor: colors.cardLight,
  },
  pressedButton: {
    opacity: 0.78,
  },
  equipButtonText: {
    color: colors.background,
    fontSize: 12,
    fontWeight: "800",
  },
  disabledButtonText: {
    color: colors.mutedText,
  },
  emptyCard: {
    width: "100%",
    minHeight: 180,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "800",
    marginTop: spacing.sm,
  },
  emptyText: {
    color: colors.mutedText,
    textAlign: "center",
    marginTop: 4,
  },
});
