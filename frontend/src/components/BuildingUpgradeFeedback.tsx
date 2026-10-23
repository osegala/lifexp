import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, Image, Platform, StyleSheet, Text, View } from "react-native";
import type { StyleProp, ViewStyle } from "react-native";
import { getBuildingImageSource } from "../base/buildingAssetRegistry";
import { buildingUpgradeAnnouncement } from "../base/buildingProgress";
import type { BuildingUpgrade, BuildingUpgradeBatch } from "../base/buildingProgress";
import type { BuildingType } from "../types/progression";
import { colors, radius } from "../theme/theme";
import { setGameFeedbackActive } from "../feedback/notices";
import GameNotice, { GameNoticeOverlay } from "./ui/GameNotice";

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
    setGameFeedbackActive("building-upgrade", true);
    progress.setValue(reducedMotion ? 1 : 0);
    if (Platform.OS !== "web") AccessibilityInfo.announceForAccessibility(buildingUpgradeAnnouncement(batch));
    const animation = Animated.timing(progress, {
      toValue: 1, duration: 1800, easing: Easing.inOut(Easing.quad), useNativeDriver: true,
    });
    if (!reducedMotion) animation.start();
    const timer = setTimeout(() => onDone(batch.id), 2800);
    return () => { clearTimeout(timer); animation.stop(); progress.setValue(0); setGameFeedbackActive("building-upgrade", false); };
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

export default function BuildingUpgradeFeedback({ batch, motion, onDone, style }: {
  batch: BuildingUpgradeBatch; motion: Motion; onDone: (id: string) => void;
  tone?: "legacy" | "parchment"; style?: StyleProp<ViewStyle>;
}) {
  return <GameNoticeOverlay style={style}>
    <GameNotice title="Kingdom Upgraded" variant="success" icon="castle" announce={false} duration={2800}
      dismissLabel="Dismiss building upgrade" onDismiss={() => onDone(batch.id)}>
      {batch.upgrades.map(upgrade => <View key={upgrade.buildingId} style={styles.row}>
        <View style={styles.thumbnail} accessible={false}>
          <BuildingTierArtwork type={upgrade.buildingName} tier={upgrade.newTier} upgrade={upgrade} motion={motion} />
        </View>
        <Text style={styles.message}>{upgrade.buildingName} reached Tier {upgrade.newTier}</Text>
      </View>)}
    </GameNotice>
  </GameNoticeOverlay>;
}

const styles = StyleSheet.create({
  art: { width: "100%", height: "100%" },
  layer: { position: "absolute", inset: 0 },
  glow: { position: "absolute", inset: "10%", borderRadius: radius.pill, backgroundColor: colors.primary },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  thumbnail: { width: 36, height: 36 },
  message: { flex: 1, color: "#F0E7D4", fontSize: 13, lineHeight: 19 },
});
