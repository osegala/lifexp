import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  ImageSourcePropType,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";

import { api } from "../../src/api/client";
import {
  BASE_BACKGROUND_IMAGES,
  getBuildingImageSource,
} from "../../src/base/buildingAssetRegistry";
import LifeCard from "../../src/components/LifeCard";
import XPBar from "../../src/components/XPBar";
import { colors, radius, spacing } from "../../src/theme/theme";
import {
  BaseProgress,
  BuildingProgress,
  BuildingType,
} from "../../src/types/progression";

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>["name"];

const BUILDING_META: Record<
  BuildingType,
  { icon: IconName; category: string; color: string; description: string }
> = {
  "Home Base": {
    icon: "home-variant",
    category: "Cleaning",
    color: "#B8904E",
    description: "A comfortable heart for your growing kingdom.",
  },
  Workshop: {
    icon: "hammer-wrench",
    category: "Work",
    color: "#6CA6A0",
    description: "Where focused work turns into ambitious creations.",
  },
  Library: {
    icon: "bookshelf",
    category: "School",
    color: "#9B8352",
    description: "A growing archive of everything you learn.",
  },
  "Training Grounds": {
    icon: "dumbbell",
    category: "Fitness",
    color: "#C77A70",
    description: "A place built by every workout and active choice.",
  },
  Garden: {
    icon: "flower",
    category: "Health",
    color: "#8DAA78",
    description: "A living reminder to care for your health.",
  },
  "Hall of Achievements": {
    icon: "trophy",
    category: "Personal Growth",
    color: "#C9A96A",
    description: "A monument to the person you are becoming.",
  },
};

const BUILDING_MAP_POSITIONS: Record<BuildingType, ViewStyle> = {
  "Hall of Achievements": {
    left: "31%",
    top: "14%",
    width: "38%",
    height: 148,
  },
  Library: {
    left: "8%",
    top: "29%",
    width: "32%",
    height: 126,
  },
  "Training Grounds": {
    right: "7%",
    top: "27%",
    width: "38%",
    height: 148,
  },
  Garden: {
    left: "31%",
    top: "47%",
    width: "34%",
    height: 122,
  },
  "Home Base": {
    left: "9%",
    bottom: "10%",
    width: "34%",
    height: 138,
  },
  Workshop: {
    right: "9%",
    bottom: "9%",
    width: "34%",
    height: 136,
  },
};

const BASE_MAP_CAMERA = {
  zoom: 1.18,
  x: -28,
  y: -82,
};

function MapViewport({
  image,
  children,
}: {
  image: ImageSourcePropType | undefined;
  children: React.ReactNode;
}) {
  if (!image) {
    return (
      <View style={styles.mapGround}>
        <View style={styles.pathVertical} />
        <View style={styles.pathHorizontal} />
        {children}
      </View>
    );
  }

  return (
    <View style={styles.mapGround}>
      <Image
        source={image}
        resizeMode="cover"
        style={[
          styles.mapBackgroundImage,
          {
            transform: [
              { translateX: BASE_MAP_CAMERA.x },
              { translateY: BASE_MAP_CAMERA.y },
              { scale: BASE_MAP_CAMERA.zoom },
            ],
          },
        ]}
      />
      <View style={styles.mapVignette} />
      {children}
    </View>
  );
}

export default function BaseScreen() {
  const [base, setBase] = useState<BaseProgress | null>(null);
  const [selectedBuilding, setSelectedBuilding] =
    useState<BuildingProgress | null>(null);
  const [loading, setLoading] = useState(true);

  const loadBase = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get<BaseProgress>("/base");
      setBase(response.data);
      setSelectedBuilding((current) => {
        if (!current) {
          return response.data.buildings[0] ?? null;
        }

        return (
          response.data.buildings.find(
            (building) => building.type === current.type,
          ) ??
          response.data.buildings[0] ??
          null
        );
      });
    } catch (error) {
      console.log("Base load error:", error);
      Alert.alert("Error", "Could not load your base.");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadBase();
    }, [loadBase]),
  );

  if (loading && !base) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Building your kingdom...</Text>
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
      <LifeCard compact style={styles.mapCard}>
        <MapViewport image={BASE_BACKGROUND_IMAGES.kingdomMap}>
          <View style={styles.mapStage}>
            {base?.buildings.map((building) => (
              <BuildingNode
                key={building.type}
                building={building}
                selected={selectedBuilding?.type === building.type}
                onPress={() => setSelectedBuilding(building)}
              />
            ))}
          </View>
        </MapViewport>
      </LifeCard>

      {selectedBuilding && (
        <BuildingDetails
          building={selectedBuilding}
          onEnterInterior={() =>
            router.push({
              pathname: "/base-interior" as never,
              params: { type: selectedBuilding.type },
            })
          }
        />
      )}

      <View style={styles.progressList}>
        {base?.buildings.map((building) => (
          <Pressable
            key={building.type}
            onPress={() => setSelectedBuilding(building)}
            style={styles.progressRow}
          >
            <View
              style={[
                styles.smallIcon,
                { backgroundColor: `${BUILDING_META[building.type].color}22` },
              ]}
            >
              <MaterialCommunityIcons
                name={BUILDING_META[building.type].icon}
                size={22}
                color={BUILDING_META[building.type].color}
              />
            </View>

            <View style={styles.progressInfo}>
              <View style={styles.progressTitleRow}>
                <Text style={styles.progressName}>{building.type}</Text>
                <Text style={styles.progressLevel}>Lv. {building.level}</Text>
              </View>
              <XPBar progress={building.progressPercent / 100} />
              <Text style={styles.progressMeta}>
                {building.xpToNextLevel} XP until next level
              </Text>
            </View>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

function BuildingNode({
  building,
  selected,
  onPress,
}: {
  building: BuildingProgress;
  selected: boolean;
  onPress: () => void;
}) {
  const meta = BUILDING_META[building.type];
  const imageSource = getBuildingImageSource(
    building.type,
    building.visualTier,
  );

  return (
    <Pressable
      onPress={onPress}
      style={[styles.buildingSlot, BUILDING_MAP_POSITIONS[building.type]]}
    >
      <View
        style={[
          styles.buildingNode,
          imageSource ? styles.buildingNodeArt : { borderColor: meta.color },
          selected && styles.selectedBuildingNode,
        ]}
      >
        {imageSource ? (
          <Image
            source={imageSource}
            style={styles.buildingImage}
            resizeMode="contain"
          />
        ) : (
          <MaterialCommunityIcons
            name={meta.icon}
            size={32 + building.visualTier * 2}
            color={meta.color}
          />
        )}
      </View>
      {selected && (
        <Text style={styles.nodeName} numberOfLines={2}>
          {building.type} Lv. {building.level}
        </Text>
      )}
    </Pressable>
  );
}

function BuildingDetails({
  building,
  onEnterInterior,
}: {
  building: BuildingProgress;
  onEnterInterior: () => void;
}) {
  const meta = BUILDING_META[building.type];
  const imageSource = getBuildingImageSource(
    building.type,
    building.visualTier,
  );
  const interiorsUnlocked = building.visualTier >= 5;

  return (
    <LifeCard compact style={styles.detailCard}>
      <View style={styles.detailHeader}>
        <View
          style={[
            styles.detailIcon,
            imageSource ? styles.detailIconArt : undefined,
            !imageSource && { backgroundColor: `${meta.color}22` },
          ]}
        >
          {imageSource ? (
            <Image
              source={imageSource}
              style={styles.buildingImage}
              resizeMode="contain"
            />
          ) : (
            <MaterialCommunityIcons
              name={meta.icon}
              size={38}
              color={meta.color}
            />
          )}
        </View>

        <View style={styles.detailHeading}>
          <Text style={styles.detailName}>{building.type}</Text>
          <Text style={styles.detailCategory}>
            Upgraded by {meta.category} tasks
          </Text>
        </View>

        <View style={styles.tierBadge}>
          <Text style={styles.tierText}>Tier {building.visualTier}</Text>
        </View>
      </View>

      <Text style={styles.detailDescription}>{meta.description}</Text>

      <View style={styles.nextUpgradePanel}>
        <MaterialCommunityIcons
          name="arrow-up-bold-hexagon-outline"
          size={22}
          color={meta.color}
        />
        <View style={styles.nextUpgradeCopy}>
          <Text style={styles.nextUpgradeTitle}>Next visible upgrade</Text>
          <Text style={styles.nextUpgradeText}>
            {nextTierCopy(building)} Keep completing {meta.category} tasks to
            push this building forward.
          </Text>
        </View>
      </View>

      <View style={styles.detailStats}>
        <View>
          <Text style={styles.statLabel}>Building Level</Text>
          <Text style={styles.statValue}>{building.level}</Text>
        </View>
        <View>
          <Text style={styles.statLabel}>Total XP</Text>
          <Text style={styles.statValue}>{building.totalXp}</Text>
        </View>
        <View>
          <Text style={styles.statLabel}>Next Upgrade</Text>
          <Text style={styles.statValue}>{building.xpToNextLevel} XP</Text>
        </View>
      </View>

      <View style={styles.detailBar}>
        <XPBar progress={building.progressPercent / 100} />
      </View>

      <View style={styles.interiorPanel}>
        <View style={styles.interiorCopy}>
          <Text style={styles.interiorTitle}>Interior Workshop</Text>
          <Text style={styles.interiorText}>
            {interiorsUnlocked
              ? "Tier 5 unlocked. Decorate this building with room cosmetics."
              : "Interiors unlock when this building reaches tier 5."}
          </Text>
        </View>
        <Pressable
          onPress={onEnterInterior}
          disabled={!interiorsUnlocked}
          style={[
            styles.interiorButton,
            !interiorsUnlocked && styles.interiorButtonDisabled,
          ]}
        >
          <Text
            style={[
              styles.interiorButtonText,
              !interiorsUnlocked && styles.interiorButtonTextDisabled,
            ]}
          >
            Enter
          </Text>
        </Pressable>
      </View>
    </LifeCard>
  );
}

function nextTierCopy(building: BuildingProgress) {
  const nextTierLevel = nextVisualTierLevel(building.visualTier);

  if (building.visualTier >= 5) {
    return "This building is at its highest visual tier.";
  }

  return `Tier ${building.visualTier + 1} begins around level ${nextTierLevel}.`;
}

function nextVisualTierLevel(visualTier: number) {
  if (visualTier <= 1) {
    return 8;
  }
  if (visualTier === 2) {
    return 14;
  }
  if (visualTier === 3) {
    return 22;
  }
  return 35;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loadingScreen: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
  },
  loadingText: { color: colors.mutedText, fontWeight: "500" },
  content: {
    padding: spacing.lg,
    paddingBottom: 120,
    gap: spacing.lg,
  },
  title: { color: colors.text, fontSize: 30, fontWeight: "700" },
  subtitle: { color: colors.mutedText, fontSize: 16, marginTop: 2 },
  mapCard: { padding: 0, overflow: "hidden" },
  mapGround: {
    height: 560,
    backgroundColor: "#223226",
    padding: 0,
    overflow: "hidden",
    position: "relative",
  },
  mapBackgroundImage: {
    position: "absolute",
    left: "-8%",
    top: "-10%",
    width: "116%",
    height: "122%",
  },
  mapVignette: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: "rgba(17, 23, 19, 0.08)",
  },
  pathVertical: {
    position: "absolute",
    width: 26,
    top: 0,
    bottom: 0,
    left: "47%",
    backgroundColor: colors.primaryDark,
    opacity: 0.42,
  },
  pathHorizontal: {
    position: "absolute",
    height: 26,
    left: 0,
    right: 0,
    top: "47%",
    backgroundColor: colors.primaryDark,
    opacity: 0.42,
  },
  mapStage: {
    height: 560,
    position: "relative",
  },
  buildingSlot: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "flex-end",
  },
  buildingNode: {
    width: "100%",
    height: "78%",
    borderRadius: radius.md,
    borderWidth: 0,
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  selectedBuildingNode: {
    transform: [{ translateY: -4 }, { scale: 1.05 }],
  },
  buildingNodeArt: {
    borderColor: "transparent",
    backgroundColor: "transparent",
  },
  buildingImage: {
    width: "100%",
    height: "100%",
  },
  nodeName: {
    color: colors.text,
    textAlign: "center",
    fontSize: 12,
    fontWeight: "600",
    marginTop: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: `${colors.background}CC`,
    overflow: "hidden",
  },
  detailCard: { gap: spacing.md },
  detailHeader: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: spacing.md,
  },
  detailIcon: {
    width: 74,
    height: 74,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  detailIconArt: {
    width: 96,
    height: 86,
  },
  detailHeading: { flex: 1, minWidth: 160 },
  detailName: { color: colors.text, fontSize: 20, fontWeight: "700" },
  detailCategory: { color: colors.mutedText, marginTop: 3, fontWeight: "500" },
  tierBadge: {
    alignSelf: "flex-start",
    backgroundColor: colors.cardLight,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  tierText: { color: colors.text, fontWeight: "600" },
  detailDescription: { color: colors.mutedText, fontSize: 16, lineHeight: 23 },
  nextUpgradePanel: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    backgroundColor: colors.cardLight,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  nextUpgradeCopy: {
    flex: 1,
  },
  nextUpgradeTitle: {
    color: colors.text,
    fontWeight: "700",
    marginBottom: 2,
  },
  nextUpgradeText: {
    color: colors.mutedText,
    fontWeight: "500",
    lineHeight: 20,
  },
  detailStats: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  statLabel: { color: colors.mutedText, fontSize: 11, fontWeight: "600" },
  statValue: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "700",
    marginTop: 4,
  },
  detailBar: { marginTop: spacing.xs },
  interiorPanel: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.cardLight,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  interiorCopy: {
    flex: 1,
  },
  interiorTitle: {
    color: colors.text,
    fontWeight: "700",
    marginBottom: 3,
  },
  interiorText: {
    color: colors.mutedText,
    lineHeight: 20,
  },
  interiorButton: {
    minWidth: 72,
    minHeight: 42,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.md,
  },
  interiorButtonDisabled: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  interiorButtonText: {
    color: colors.text,
    fontWeight: "700",
  },
  interiorButtonTextDisabled: {
    color: colors.mutedText,
  },
  progressList: { gap: spacing.sm },
  progressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  smallIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  progressInfo: { flex: 1, gap: spacing.xs },
  progressTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  progressName: { color: colors.text, fontWeight: "600", flex: 1 },
  progressLevel: { color: colors.accent, fontWeight: "600" },
  progressMeta: { color: colors.mutedText, fontSize: 12, fontWeight: "500" },
});
