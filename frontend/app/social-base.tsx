import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
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

import { api } from "../src/api/client";
import {
  BASE_BACKGROUND_IMAGES,
  getBuildingImageSource,
} from "../src/base/buildingAssetRegistry";
import LifeCard from "../src/components/LifeCard";
import XPBar from "../src/components/XPBar";
import { colors, radius, spacing } from "../src/theme/theme";
import { BuildingProgress, BuildingType } from "../src/types/progression";

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>["name"];

const BUILDING_META: Record<BuildingType, { icon: IconName; color: string }> = {
  "Home Base": { icon: "home-variant", color: "#B8904E" },
  Workshop: { icon: "hammer-wrench", color: "#6CA6A0" },
  Library: { icon: "bookshelf", color: "#9B8352" },
  "Training Grounds": { icon: "dumbbell", color: "#C77A70" },
  Garden: { icon: "flower", color: "#8DAA78" },
  "Hall of Achievements": { icon: "trophy", color: "#C9A96A" },
};

const BUILDING_MAP_POSITIONS: Record<BuildingType, ViewStyle> = {
  "Hall of Achievements": { left: "31%", top: "10%", width: "38%", height: 160 },
  Library: { left: "10%", top: "31%", width: "33%", height: 132 },
  "Training Grounds": { right: "8%", top: "30%", width: "38%", height: 154 },
  Garden: { left: "32%", top: "49%", width: "34%", height: 128 },
  "Home Base": { left: "13%", bottom: "8%", width: "35%", height: 146 },
  Workshop: { right: "13%", bottom: "8%", width: "35%", height: 144 },
};

const BASE_MAP_CAMERA = {
  zoom: 1.18,
  x: -28,
  y: -82,
};

export default function SocialBaseScreen() {
  const params = useLocalSearchParams<{ userId?: string; username?: string }>();
  const userId = Number(params.userId);
  const username = String(params.username ?? "Friend");
  const [buildings, setBuildings] = useState<BuildingProgress[]>([]);
  const [selectedBuilding, setSelectedBuilding] =
    useState<BuildingProgress | null>(null);
  const [loading, setLoading] = useState(true);

  const loadBase = useCallback(async () => {
    if (!userId) {
      return;
    }

    try {
      setLoading(true);
      const response = await api.get<BuildingProgress[]>(
        `/social/users/${userId}/base`,
      );
      setBuildings(response.data);
      setSelectedBuilding((current) => {
        if (!current) {
          return response.data[0] ?? null;
        }

        return (
          response.data.find((building) => building.type === current.type) ??
          response.data[0] ??
          null
        );
      });
    } catch (error) {
      console.log("Social base load error:", error);
      Alert.alert("Error", "Could not load this base.");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadBase();
  }, [loadBase]);

  if (loading && buildings.length === 0) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Traveling to base...</Text>
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
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.back()} style={styles.iconButton}>
          <MaterialCommunityIcons name="arrow-left" size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>{username} Base</Text>
      </View>

      <LifeCard compact style={styles.mapCard}>
        <MapViewport image={BASE_BACKGROUND_IMAGES.kingdomMap}>
          <View style={styles.mapStage}>
            {buildings.map((building) => (
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
        <LifeCard compact style={styles.detailCard}>
          <Text style={styles.detailName}>{selectedBuilding.type}</Text>
          <Text style={styles.detailMeta}>
            Level {selectedBuilding.level} / Tier {selectedBuilding.visualTier}
          </Text>
          <XPBar progress={selectedBuilding.progressPercent / 100} />
        </LifeCard>
      )}
    </ScrollView>
  );
}

function MapViewport({
  image,
  children,
}: {
  image: ImageSourcePropType | undefined;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.mapGround}>
      {image && (
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
      )}
      <View style={styles.mapVignette} />
      {children}
    </View>
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
      <View style={[styles.buildingNode, selected && styles.selectedBuildingNode]}>
        {imageSource ? (
          <Image source={imageSource} style={styles.buildingImage} resizeMode="contain" />
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loadingScreen: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
  },
  loadingText: { color: colors.mutedText, fontWeight: "600" },
  content: {
    padding: spacing.lg,
    paddingBottom: 110,
    gap: spacing.lg,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.cardLight,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "700",
  },
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
    inset: 0,
    backgroundColor: "rgba(17, 23, 19, 0.08)",
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
    height: "84%",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  selectedBuildingNode: {
    transform: [{ translateY: -4 }, { scale: 1.05 }],
  },
  buildingImage: {
    width: "100%",
    height: "100%",
    transform: [{ rotate: "180deg" }],
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
  detailName: { color: colors.text, fontSize: 20, fontWeight: "700" },
  detailMeta: { color: colors.mutedText, fontWeight: "600" },
});
