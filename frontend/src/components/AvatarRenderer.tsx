import { Image, StyleSheet, Text, View } from "react-native";

import {
  BASE_BODY_SPRITES,
  DEFAULT_CHARACTER_SPRITES,
  getEquippedCharacterSprites,
  getEquippedSceneSource,
  resolveSpriteSet,
} from "../avatar/assetRegistry";
import type { ResolvedCharacterSprite } from "../avatar/assetRegistry";
import CharacterSpriteLayers from "./CharacterSpriteLayers";
import {
  CHARACTER_CANVAS,
  CHARACTER_LAYER_PRIORITY,
  SHOW_CHARACTER_LAYER_DEBUG,
} from "../avatar/cosmeticCatalog";
import { Cosmetic, CosmeticId } from "../types/avatar";
import { colors } from "../theme/theme";

type Props = {
  bodyType?: "BOY" | "GIRL";
  hairId?: CosmeticId | null;
  hatId?: CosmeticId | null;
  topId?: CosmeticId | null;
  bottomId?: CosmeticId | null;
  bootsId?: CosmeticId | null;
  capeId?: CosmeticId | null;
  weaponId?: CosmeticId | null;
  shieldId?: CosmeticId | null;
  backgroundId?: CosmeticId | null;
  petId?: CosmeticId | null;
  auraId?: CosmeticId | null;
  cosmetics?: Cosmetic[];
  showBackground?: boolean;
  size?: "compact" | "regular";
};

export default function AvatarRenderer({
  bodyType = "BOY",
  hairId,
  hatId,
  topId,
  bottomId,
  bootsId,
  capeId,
  weaponId,
  shieldId,
  backgroundId,
  petId,
  auraId,
  cosmetics,
  showBackground = true,
  size = "regular",
}: Props) {
  const backgroundImage = getEquippedSceneSource(
    cosmetics,
    backgroundId,
    "BACKGROUND",
  );
  const auraImage = getEquippedSceneSource(cosmetics, auraId, "AURA");
  const petImage = getEquippedSceneSource(cosmetics, petId, "PET");

  const equippedSprites = [
    ...getEquippedCharacterSprites(cosmetics, capeId, "CAPE"),
    ...getEquippedCharacterSprites(cosmetics, hairId, "HAIR"),
    ...getEquippedCharacterSprites(cosmetics, hatId, "HAT"),
    ...getEquippedCharacterSprites(cosmetics, weaponId, "WEAPON"),
    ...getEquippedCharacterSprites(cosmetics, shieldId, "SHIELD"),
    ...resolveSpriteSet(`base-body:${bodyType}`, BASE_BODY_SPRITES[bodyType]),
    ...(cosmetics === undefined
      ? resolveSpriteSet("registration-default", DEFAULT_CHARACTER_SPRITES)
      : []),
    ...getEquippedCharacterSprites(cosmetics, bottomId, "BOTTOM"),
    ...getEquippedCharacterSprites(cosmetics, bootsId, "BOOTS"),
    ...getEquippedCharacterSprites(cosmetics, topId, "TOP"),
  ];
  const coveredBodyRegions = new Set(
    equippedSprites.flatMap(({ covers }) => covers ?? []),
  );
  const characterSprites = sortCharacterSprites(
    equippedSprites.filter(
      ({ region }) => region === undefined || !coveredBodyRegions.has(region),
    ),
  );

  if (__DEV__ && SHOW_CHARACTER_LAYER_DEBUG) {
    console.info(
      [
        "Character render order:",
        ...characterSprites.map(
          ({ key, layer }) =>
            `${CHARACTER_LAYER_PRIORITY[layer]} ${layer} (${key})`,
        ),
      ].join("\n"),
    );
  }

  return (
    <View style={[styles.stage, size === "compact" && styles.compactStage]}>
      {showBackground && (backgroundImage ? (
        <Image
          source={backgroundImage}
          style={styles.backgroundImage}
          resizeMode="cover"
        />
      ) : (
        <View style={styles.backgroundLayer} />
      ))}

      {auraImage ? (
        <Image source={auraImage} style={styles.auraImage} resizeMode="contain" />
      ) : (
        <View style={styles.auraGlow} />
      )}

      <View style={styles.shadow} />

      <View
        style={styles.characterCanvas}
        accessibilityLabel={`Character render order: ${characterSprites
          .map(({ layer }) => layer)
          .join(", ")}`}
      >
        <CharacterSpriteLayers sprites={characterSprites} />
      </View>

      {petImage ? (
        <Image source={petImage} style={styles.petImage} resizeMode="contain" />
      ) : (
        petId && (
          <View style={styles.petFallback}>
            <Text style={styles.petFallbackText}>🐉</Text>
          </View>
        )
      )}
    </View>
  );
}

function sortCharacterSprites(sprites: ResolvedCharacterSprite[]) {
  return [...sprites].sort((left, right) => {
    const priorityDifference =
      CHARACTER_LAYER_PRIORITY[left.layer] -
      CHARACTER_LAYER_PRIORITY[right.layer];
    return priorityDifference || left.key.localeCompare(right.key);
  });
}

const styles = StyleSheet.create({
  stage: {
    width: 320,
    aspectRatio: CHARACTER_CANVAS.aspectRatio,
    maxWidth: "100%",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    overflow: "visible",
  },
  compactStage: {
    transform: [{ scale: 0.78 }],
    marginVertical: -48,
  },
  backgroundLayer: {
    position: "absolute",
    width: "100%",
    height: "100%",
    borderRadius: 42,
    backgroundColor: colors.cardLight,
    opacity: 0.34,
    borderWidth: 1,
    borderColor: colors.border,
  },
  backgroundImage: {
    position: "absolute",
    width: "100%",
    height: "100%",
    borderRadius: 42,
  },
  auraGlow: {
    position: "absolute",
    width: 230,
    height: 330,
    borderRadius: 999,
    backgroundColor: colors.primary,
    opacity: 0.08,
  },
  auraImage: {
    position: "absolute",
    width: "100%",
    height: "100%",
    opacity: 0.72,
  },
  shadow: {
    position: "absolute",
    bottom: 18,
    width: 132,
    height: 20,
    borderRadius: 999,
    backgroundColor: "#070B08",
    opacity: 0.24,
  },
  characterCanvas: {
    position: "relative",
    width: "100%",
    height: "100%",
    overflow: "visible",
  },
  petImage: {
    position: "absolute",
    right: 2,
    bottom: 28,
    width: 94,
    height: 94,
  },
  petFallback: {
    position: "absolute",
    right: 16,
    bottom: 34,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  petFallbackText: {
    fontSize: 32,
  },
});
