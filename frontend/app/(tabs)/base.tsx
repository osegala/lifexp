import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { api } from "../../src/api/client";
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
    color: "#F59E0B",
    description: "A comfortable heart for your growing kingdom.",
  },
  Workshop: {
    icon: "hammer-wrench",
    category: "Work",
    color: "#38BDF8",
    description: "Where focused work turns into ambitious creations.",
  },
  Library: {
    icon: "bookshelf",
    category: "School",
    color: "#A78BFA",
    description: "A growing archive of everything you learn.",
  },
  "Training Grounds": {
    icon: "dumbbell",
    category: "Fitness",
    color: "#F87171",
    description: "A place built by every workout and active choice.",
  },
  Garden: {
    icon: "flower",
    category: "Health",
    color: "#4ADE80",
    description: "A living reminder to care for your health.",
  },
  "Hall of Achievements": {
    icon: "trophy",
    category: "Personal Growth",
    color: "#FACC15",
    description: "A monument to the person you are becoming.",
  },
};

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
          ) ?? response.data.buildings[0] ?? null
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
      <View style={styles.titleRow}>
        <View>
          <Text style={styles.title}>My Base</Text>
          <Text style={styles.subtitle}>Every task leaves its mark.</Text>
        </View>

        <View style={styles.baseLevelBadge}>
          <MaterialCommunityIcons name="castle" size={22} color="#FACC15" />
          <Text style={styles.baseLevelText}>Base {base?.baseLevel ?? 1}</Text>
        </View>
      </View>

      <LifeCard style={styles.mapCard}>
        <View style={styles.mapSky}>
          <MaterialCommunityIcons
            name="weather-sunny"
            size={34}
            color="#FACC15"
          />
          <Text style={styles.mapTitle}>LifeXP Kingdom</Text>
          <Text style={styles.mapSubtitle}>
            Select a building to inspect its progress
          </Text>
        </View>

        <View style={styles.mapGround}>
          <View style={styles.pathVertical} />
          <View style={styles.pathHorizontal} />

          <View style={styles.buildingGrid}>
            {base?.buildings.map((building) => (
              <BuildingNode
                key={building.type}
                building={building}
                selected={selectedBuilding?.type === building.type}
                onPress={() => setSelectedBuilding(building)}
              />
            ))}
          </View>
        </View>
      </LifeCard>

      {selectedBuilding && <BuildingDetails building={selectedBuilding} />}

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

  return (
    <Pressable onPress={onPress} style={styles.buildingSlot}>
      <View
        style={[
          styles.buildingNode,
          { borderColor: meta.color },
          selected && styles.selectedBuildingNode,
        ]}
      >
        <MaterialCommunityIcons
          name={meta.icon}
          size={32 + building.visualTier * 2}
          color={meta.color}
        />
        <View style={styles.nodeLevelBadge}>
          <Text style={styles.nodeLevelText}>{building.level}</Text>
        </View>
      </View>
      <Text style={styles.nodeName} numberOfLines={2}>
        {building.type}
      </Text>
    </Pressable>
  );
}

function BuildingDetails({ building }: { building: BuildingProgress }) {
  const meta = BUILDING_META[building.type];

  return (
    <LifeCard style={styles.detailCard}>
      <View style={styles.detailHeader}>
        <View
          style={[styles.detailIcon, { backgroundColor: `${meta.color}22` }]}
        >
          <MaterialCommunityIcons
            name={meta.icon}
            size={38}
            color={meta.color}
          />
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
    </LifeCard>
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
  loadingText: { color: colors.mutedText, fontWeight: "800" },
  content: {
    padding: spacing.lg,
    paddingBottom: 120,
    gap: spacing.lg,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  title: { color: colors.text, fontSize: 36, fontWeight: "900" },
  subtitle: { color: colors.mutedText, fontSize: 16, marginTop: 2 },
  baseLevelBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: "#A16207",
    backgroundColor: "#422006",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
  },
  baseLevelText: { color: "#FEF3C7", fontWeight: "900" },
  mapCard: { padding: 0, overflow: "hidden" },
  mapSky: {
    backgroundColor: "#164E63",
    padding: spacing.lg,
    alignItems: "center",
  },
  mapTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "900",
    marginTop: spacing.xs,
  },
  mapSubtitle: { color: "#BAE6FD", marginTop: 2, fontWeight: "700" },
  mapGround: {
    minHeight: 410,
    backgroundColor: "#14532D",
    padding: spacing.lg,
    justifyContent: "center",
    overflow: "hidden",
  },
  pathVertical: {
    position: "absolute",
    width: 26,
    top: 0,
    bottom: 0,
    left: "47%",
    backgroundColor: "#A16207",
    opacity: 0.7,
  },
  pathHorizontal: {
    position: "absolute",
    height: 26,
    left: 0,
    right: 0,
    top: "47%",
    backgroundColor: "#A16207",
    opacity: 0.7,
  },
  buildingGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: spacing.xl,
  },
  buildingSlot: {
    width: "31%",
    minHeight: 140,
    alignItems: "center",
    justifyContent: "center",
  },
  buildingNode: {
    width: 86,
    height: 86,
    borderRadius: radius.md,
    borderWidth: 3,
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  selectedBuildingNode: {
    backgroundColor: "#0F172A",
    transform: [{ scale: 1.08 }],
  },
  nodeLevelBadge: {
    position: "absolute",
    right: -8,
    top: -8,
    minWidth: 28,
    height: 28,
    paddingHorizontal: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.text,
    alignItems: "center",
    justifyContent: "center",
  },
  nodeLevelText: { color: colors.text, fontSize: 12, fontWeight: "900" },
  nodeName: {
    color: colors.text,
    textAlign: "center",
    fontSize: 12,
    fontWeight: "900",
    marginTop: spacing.sm,
  },
  detailCard: { gap: spacing.md },
  detailHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  detailIcon: {
    width: 62,
    height: 62,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  detailHeading: { flex: 1 },
  detailName: { color: colors.text, fontSize: 22, fontWeight: "900" },
  detailCategory: { color: colors.mutedText, marginTop: 3, fontWeight: "700" },
  tierBadge: {
    backgroundColor: colors.cardLight,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  tierText: { color: colors.text, fontWeight: "900" },
  detailDescription: { color: colors.mutedText, fontSize: 16, lineHeight: 23 },
  detailStats: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  statLabel: { color: colors.mutedText, fontSize: 11, fontWeight: "800" },
  statValue: { color: colors.text, fontSize: 18, fontWeight: "900", marginTop: 4 },
  detailBar: { marginTop: spacing.xs },
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
  progressName: { color: colors.text, fontWeight: "900", flex: 1 },
  progressLevel: { color: colors.accent, fontWeight: "900" },
  progressMeta: { color: colors.mutedText, fontSize: 12, fontWeight: "700" },
});
