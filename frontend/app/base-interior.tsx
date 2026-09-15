import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { api } from "../src/api/client";
import { getBuildingImageSource } from "../src/base/buildingAssetRegistry";
import LifeButton from "../src/components/LifeButton";
import LifeCard from "../src/components/LifeCard";
import { colors, radius, spacing } from "../src/theme/theme";
import { BuildingType } from "../src/types/progression";

type Interior = {
  buildingType: BuildingType;
  unlocked: boolean;
  visualTier: number;
  wallStyle: string;
  floorStyle: string;
  centerItem: string;
  leftItem: string;
  rightItem: string;
};

const OPTION_GROUPS = [
  {
    key: "wallStyle",
    title: "Walls",
    options: ["Stone Hearth", "Warm Timber", "Scholar Blue", "Garden Moss"],
  },
  {
    key: "floorStyle",
    title: "Floors",
    options: ["Flagstone", "Oak Planks", "Woven Rush", "Polished Slate"],
  },
  {
    key: "centerItem",
    title: "Center",
    options: ["Planning Table", "Training Dummy", "Reading Desk", "Herb Bench"],
  },
  {
    key: "leftItem",
    title: "Left",
    options: ["Banner Rack", "Supply Crates", "Bookshelf", "Lantern Stand"],
  },
  {
    key: "rightItem",
    title: "Right",
    options: ["Armor Stand", "Tool Chest", "Map Board", "Flower Pot"],
  },
] as const;

export default function BaseInteriorScreen() {
  const params = useLocalSearchParams<{ type?: string }>();
  const buildingType = String(params.type ?? "Home Base") as BuildingType;
  const [interior, setInterior] = useState<Interior | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadInterior = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get<Interior>(
        `/base/interiors/${encodeURIComponent(buildingType)}`,
      );
      setInterior(response.data);
    } catch (error) {
      console.log("Interior load error:", error);
      Alert.alert("Error", "Could not load this building interior.");
    } finally {
      setLoading(false);
    }
  }, [buildingType]);

  useEffect(() => {
    loadInterior();
  }, [loadInterior]);

  const roomPalette = useMemo(() => getRoomPalette(interior), [interior]);
  const buildingImage = interior
    ? getBuildingImageSource(interior.buildingType, interior.visualTier)
    : undefined;

  async function updateChoice(
    key: keyof Pick<
      Interior,
      "wallStyle" | "floorStyle" | "centerItem" | "leftItem" | "rightItem"
    >,
    value: string,
  ) {
    if (!interior || !interior.unlocked) {
      return;
    }

    const nextInterior = { ...interior, [key]: value };
    setInterior(nextInterior);

    try {
      setSaving(true);
      const response = await api.put<Interior>(
        `/base/interiors/${encodeURIComponent(buildingType)}`,
        {
          wallStyle: nextInterior.wallStyle,
          floorStyle: nextInterior.floorStyle,
          centerItem: nextInterior.centerItem,
          leftItem: nextInterior.leftItem,
          rightItem: nextInterior.rightItem,
        },
      );
      setInterior(response.data);
    } catch (error) {
      console.log("Interior save error:", error);
      Alert.alert("Error", "Could not save this room.");
      await loadInterior();
    } finally {
      setSaving(false);
    }
  }

  if (loading && !interior) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Opening the room...</Text>
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
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <MaterialCommunityIcons name="arrow-left" size={22} color={colors.text} />
        </Pressable>
      </View>

      <LifeCard compact style={styles.roomCard}>
        <View
          style={[
            styles.room,
            {
              backgroundColor: roomPalette.wall,
              borderColor: roomPalette.trim,
            },
          ]}
        >
          <View style={[styles.floor, { backgroundColor: roomPalette.floor }]} />
          <View style={[styles.window, { borderColor: roomPalette.trim }]} />
          <View style={[styles.leftItem, { backgroundColor: roomPalette.item }]}>
            <Text style={styles.itemLabel}>{interior?.leftItem ?? "Left"}</Text>
          </View>
          <View style={[styles.centerItem, { backgroundColor: roomPalette.center }]}>
            <Text style={styles.itemLabel}>{interior?.centerItem ?? "Center"}</Text>
          </View>
          <View style={[styles.rightItem, { backgroundColor: roomPalette.item }]}>
            <Text style={styles.itemLabel}>{interior?.rightItem ?? "Right"}</Text>
          </View>
          {buildingImage && (
            <Image source={buildingImage} style={styles.buildingBadge} resizeMode="contain" />
          )}
          {!interior?.unlocked && (
            <View style={styles.lockOverlay}>
              <MaterialCommunityIcons name="lock" size={28} color={colors.text} />
              <Text style={styles.lockText}>Reach tier 5 to decorate inside.</Text>
            </View>
          )}
        </View>
      </LifeCard>

      {interior?.unlocked ? (
        <>
          <Text style={styles.statusText}>
            {saving ? "Saving room..." : "Choose the room pieces that fit this building."}
          </Text>
          {OPTION_GROUPS.map((group) => (
            <LifeCard key={group.key} compact>
              <Text style={styles.sectionTitle}>{group.title}</Text>
              <View style={styles.optionGrid}>
                {group.options.map((option) => {
                  const selected = interior[group.key] === option;
                  return (
                    <Pressable
                      key={option}
                      onPress={() => updateChoice(group.key, option)}
                      style={[styles.optionChip, selected && styles.selectedOption]}
                    >
                      <Text
                        style={[
                          styles.optionText,
                          selected && styles.selectedOptionText,
                        ]}
                      >
                        {option}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </LifeCard>
          ))}
        </>
      ) : (
        <LifeButton title="Back to Base" onPress={() => router.back()} />
      )}
    </ScrollView>
  );
}

function getRoomPalette(interior: Interior | null) {
  const wall = interior?.wallStyle ?? "";
  const floor = interior?.floorStyle ?? "";
  return {
    wall:
      wall === "Scholar Blue"
        ? "#293C48"
        : wall === "Garden Moss"
          ? "#314333"
          : wall === "Warm Timber"
            ? "#4A3528"
            : "#3D3D38",
    floor:
      floor === "Oak Planks"
        ? "#5A3F2D"
        : floor === "Woven Rush"
          ? "#6F6845"
          : floor === "Polished Slate"
            ? "#30363B"
            : "#4A4840",
    trim: "#89714A",
    item: "#2B352C",
    center: "#6F5E3E",
  };
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.cardLight,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCopy: { flex: 1 },
  title: { color: colors.text, fontSize: 28, fontWeight: "700" },
  subtitle: { color: colors.mutedText, fontSize: 15, marginTop: 2 },
  roomCard: { padding: 0, overflow: "hidden" },
  room: {
    height: 380,
    borderWidth: 1,
    position: "relative",
    overflow: "hidden",
  },
  floor: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "42%",
    transform: [{ skewY: "-7deg" }, { translateY: 22 }],
  },
  window: {
    position: "absolute",
    top: 44,
    alignSelf: "center",
    width: 92,
    height: 76,
    borderRadius: radius.md,
    borderWidth: 3,
    backgroundColor: "#7BA3A5",
  },
  leftItem: {
    position: "absolute",
    left: 22,
    bottom: 72,
    width: 94,
    minHeight: 72,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.sm,
  },
  centerItem: {
    position: "absolute",
    alignSelf: "center",
    bottom: 72,
    width: 132,
    minHeight: 92,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.sm,
  },
  rightItem: {
    position: "absolute",
    right: 22,
    bottom: 72,
    width: 94,
    minHeight: 72,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.sm,
  },
  itemLabel: {
    color: colors.text,
    textAlign: "center",
    fontSize: 12,
    fontWeight: "700",
  },
  buildingBadge: {
    position: "absolute",
    right: 12,
    top: 12,
    width: 92,
    height: 82,
    transform: [{ rotate: "180deg" }],
  },
  lockOverlay: {
    position: "absolute",
    inset: 0,
    backgroundColor: "rgba(17, 23, 19, 0.78)",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    padding: spacing.lg,
  },
  lockText: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "700",
    textAlign: "center",
  },
  statusText: { color: colors.mutedText, fontWeight: "600" },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "700",
    marginBottom: spacing.md,
  },
  optionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  optionChip: {
    minHeight: 42,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.cardLight,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.md,
  },
  selectedOption: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryDark,
  },
  optionText: {
    color: colors.mutedText,
    fontWeight: "700",
  },
  selectedOptionText: {
    color: colors.text,
  },
});
