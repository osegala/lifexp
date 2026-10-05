import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, Image, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { getBuildingImageSource } from "../base/buildingAssetRegistry";
import { buildingUpgradeAnnouncement } from "../base/buildingProgress";
import type { BuildingUpgrade, BuildingUpgradeBatch } from "../base/buildingProgress";
import type { BuildingType } from "../types/progression";
import { colors, radius, spacing } from "../theme/theme";

/** Only pass a batch while World is focused and its confirmed new artwork is loaded. */
export function useBuildingUpgradePresentation(batch: BuildingUpgradeBatch | undefined, onDone: (id: string) => void) {
  const progress = useRef(new Animated.Value(0)).current;
  const [reducedMotion, setReducedMotion] = useState<boolean | null>(null);
  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(value => { if (active) setReducedMotion(value); })
      .catch(() => { if (active) setReducedMotion(true); });
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReducedMotion);
    return () => { active = false; subscription.remove(); };
  }, []);
  useEffect(() => {
    if (!batch || reducedMotion === null) return;
    progress.setValue(reducedMotion ? 1 : 0);
    if (Platform.OS !== "web") AccessibilityInfo.announceForAccessibility(buildingUpgradeAnnouncement(batch));
    const animation = Animated.timing(progress, {
      toValue: 1, duration: 1800, easing: Easing.inOut(Easing.quad), useNativeDriver: true,
    });
    if (!reducedMotion) animation.start();
    const timer = setTimeout(() => onDone(batch.id), 2800);
    return () => { clearTimeout(timer); animation.stop(); progress.setValue(0); };
  }, [batch, onDone, progress, reducedMotion]);
  return { progress, reducedMotion: reducedMotion !== false };
}

type Motion = ReturnType<typeof useBuildingUpgradePresentation>;

/** Same source, dimensions and contain mode as the normal map node; no lasting transform. */
export function BuildingTierArtwork({ type, tier, upgrade, motion }: {
  type: BuildingType;
  tier: number;
  upgrade?: BuildingUpgrade;
  motion: Motion;
}) {
  const source = getBuildingImageSource(type, tier);
  if (!upgrade || motion.reducedMotion) return <Image source={source} style={styles.art} resizeMode="contain" />;
  const fade = motion.progress.interpolate({ inputRange: [0, 0.7, 1], outputRange: [0, 1, 1] });
  return <View style={styles.art}>
    <Animated.View style={[styles.glow, { opacity: motion.progress.interpolate({
      inputRange: [0, 0.25, 0.7, 1], outputRange: [0, 0.3, 0.12, 0],
    }) }]} />
    <Animated.Image source={getBuildingImageSource(type, upgrade.previousTier)} resizeMode="contain"
      style={[styles.art, styles.layer, { opacity: motion.progress.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 0, 0] }) }]} />
    <Animated.Image source={source} resizeMode="contain" style={[styles.art, { opacity: fade }]} />
  </View>;
}

export default function BuildingUpgradeFeedback({ batch, motion, onDone }: {
  batch: BuildingUpgradeBatch; motion: Motion; onDone: (id: string) => void;
}) {
  return <View pointerEvents="box-none" style={styles.overlay}>
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>✦ KINGDOM UPGRADED</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Dismiss building upgrade" style={styles.dismiss}
          onPress={() => onDone(batch.id)}><Text style={styles.dismissText}>×</Text></Pressable>
      </View>
      {batch.upgrades.map(upgrade => <View key={upgrade.buildingId} style={styles.row}>
        <View style={styles.thumbnail} accessible={false}>
          <BuildingTierArtwork type={upgrade.buildingName} tier={upgrade.newTier} upgrade={upgrade} motion={motion} />
        </View>
        <Text style={styles.message}>{upgrade.buildingName} reached Tier {upgrade.newTier}</Text>
      </View>)}
    </View>
  </View>;
}

const styles = StyleSheet.create({
  art: { width: "100%", height: "100%" },
  layer: { position: "absolute", inset: 0 },
  glow: { position: "absolute", inset: "10%", borderRadius: radius.pill, backgroundColor: colors.primary },
  overlay: { position: "absolute", bottom: spacing.lg, left: spacing.md, right: spacing.md, alignItems: "center", zIndex: 1100 },
  card: { width: "100%", maxWidth: 420, padding: spacing.md, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.primary, backgroundColor: colors.card, gap: spacing.xs },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  eyebrow: { color: colors.text, fontSize: 12, fontWeight: "800", letterSpacing: 1 },
  dismiss: { width: 44, height: 44, margin: -spacing.sm, alignItems: "center", justifyContent: "center" },
  dismissText: { color: colors.mutedText, fontSize: 26 },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  thumbnail: { width: 48, height: 48 },
  message: { flex: 1, color: colors.text, fontSize: 15, fontWeight: "700" },
});
