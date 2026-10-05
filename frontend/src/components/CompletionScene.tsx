import { memo, useEffect, useState } from "react";
import { Animated, Image, StyleSheet, View } from "react-native";
import { api } from "../api/client";
import { apiRoutes } from "../api/routes";
import { normalizeAppearance } from "../avatar/appearance";
import type { AvatarAppearance } from "../avatar/appearance";
import { avatarFromInventory, catalogCosmeticReference } from "../avatar/inventory";
import { BASE_BACKGROUND_IMAGES } from "../base/buildingAssetRegistry";
import type { Avatar, Cosmetic, InventoryResponse } from "../types/avatar";
import { colors, radius } from "../theme/theme";
import AvatarRenderer from "./AvatarRenderer";

/** A UI-only reaction: artwork, equipment, and world state never change. */
export default memo(function CompletionScene({ progress, reducedMotion }: {
  progress: Animated.Value;
  reducedMotion: boolean;
}) {
  const [scene, setScene] = useState<{ avatar: Avatar; cosmetics: Cosmetic[] } | null>(null);
  useEffect(() => {
    let active = true;
    void Promise.all([
      api.get<AvatarAppearance>(apiRoutes.me), api.get<InventoryResponse>(apiRoutes.inventory),
    ]).then(([profile, inventory]) => {
      if (!active) return;
      setScene({
        avatar: avatarFromInventory(inventory.data, normalizeAppearance(profile.data)),
        cosmetics: inventory.data.items.flatMap(item => {
          const reference = catalogCosmeticReference(item);
          return reference ? [{ ...reference, name: item.name, requiredLevel: 1,
            owned: true, unlocked: true, equipped: item.equipped }] : [];
        }),
      });
    }).catch(() => { /* Reward feedback must not depend on this decorative read. */ });
    return () => { active = false; };
  }, []);
  const avatar = scene?.avatar;
  return (
    <View pointerEvents="none" aria-hidden accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.scene}>
      <Image source={BASE_BACKGROUND_IMAGES.kingdomMap} style={styles.world} resizeMode="cover" />
      <Animated.View style={[StyleSheet.absoluteFill, styles.glow, {
        opacity: reducedMotion ? 0 : progress.interpolate({ inputRange: [0, 0.3, 0.65, 1], outputRange: [0, 0.3, 0, 0] }),
      }]} />
      {avatar && <Animated.View style={[styles.avatar, {
        transform: [{ translateY: reducedMotion ? 0 : progress.interpolate({ inputRange: [0, 0.15, 0.35, 1], outputRange: [0, -5, 0, 0] }) }],
      }]}>
        <View style={styles.avatarScale}>
          <AvatarRenderer showBackground={false} bodyType={avatar.bodyType}
            hairId={avatar.equippedHairId} hatId={avatar.equippedHatId}
            topId={avatar.equippedTopId} bottomId={avatar.equippedBottomId} bootsId={avatar.equippedBootsId}
            skinColorId={avatar.skinColorId} hairColorId={avatar.hairColorId} eyeColorId={avatar.eyeColorId}
            cosmetics={scene.cosmetics} />
        </View>
      </Animated.View>}
    </View>
  );
});

const styles = StyleSheet.create({
  scene: { width: 88, height: 96, overflow: "hidden", borderRadius: radius.md, backgroundColor: colors.cardLight },
  world: { width: "100%", height: "100%", opacity: 0.65 },
  glow: { backgroundColor: colors.primary },
  avatar: { position: "absolute", bottom: 0, left: 0, width: 88, height: 96 },
  avatarScale: { width: 320, height: 320, position: "absolute", left: -116, top: -112, transform: [{ scale: 0.28 }] },
});
