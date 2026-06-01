import { Image, ImageSourcePropType, StyleSheet, Text, View } from "react-native";
import {
  ACCESSORY_IMAGES,
  AURA_IMAGES,
  BACKGROUND_IMAGES,
  BASE_BODY_LAYERS,
  HAT_IMAGES,
  HAT_LAYER_IMAGES,
  OUTFIT_LAYER_IMAGES,
  PARTICLE_IMAGES,
  PET_BEHIND_IMAGES,
  PET_FRONT_IMAGES,
} from "../avatar/assetRegistry";
import { colors } from "../theme/theme";

type Props = {
  hatId?: number | null;
  outfitId?: number | null;
  backgroundId?: number | null;
  petId?: number | null;
  auraId?: number | null;
  accessoryId?: number | null;
  particleId?: number | null;
};

export default function AvatarRenderer({
  hatId,
  outfitId,
  backgroundId,
  petId,
  auraId,
  accessoryId,
  particleId,
}: Props) {
  const backgroundImage = backgroundId
    ? BACKGROUND_IMAGES[backgroundId]
    : undefined;
  const hatImage = hatId ? HAT_IMAGES[hatId] : undefined;
  const hatLayerImage = hatId ? HAT_LAYER_IMAGES[hatId] : undefined;
  const outfitLayers = outfitId ? OUTFIT_LAYER_IMAGES[outfitId] : undefined;
  const petBehindImage = petId ? PET_BEHIND_IMAGES[petId] : undefined;
  const petFrontImage = petId ? PET_FRONT_IMAGES[petId] : undefined;
  const auraImage = auraId ? AURA_IMAGES[auraId] : undefined;
  const accessoryImage = accessoryId
    ? ACCESSORY_IMAGES[accessoryId]
    : undefined;
  const particleImage = particleId ? PARTICLE_IMAGES[particleId] : undefined;
  const hasBoots = Boolean(outfitLayers?.boots);

  return (
    <View style={styles.stage}>
      {backgroundImage ? (
        <Image source={backgroundImage} style={styles.backgroundImage} />
      ) : (
        backgroundId && <View style={styles.backgroundLayer} />
      )}

      {auraImage ? (
        <Image source={auraImage} style={styles.auraImage} />
      ) : (
        auraId && <View style={styles.auraGlow} />
      )}

      {petBehindImage && (
        <Image source={petBehindImage} style={styles.petBehindImage} />
      )}

      <View style={styles.character}>
        <View style={styles.shadow} />

        {outfitLayers?.capeBack && (
          <AvatarLayer source={outfitLayers.capeBack} />
        )}
        <AvatarLayer source={BASE_BODY_LAYERS.hairBack} />

        <AvatarLayer source={BASE_BODY_LAYERS.torso} />
        <AvatarLayer source={BASE_BODY_LAYERS.arms} />
        <AvatarLayer source={BASE_BODY_LAYERS.legs} />
        {!hasBoots && <AvatarLayer source={BASE_BODY_LAYERS.feet} />}
        <AvatarLayer source={BASE_BODY_LAYERS.head} />

        {outfitLayers?.outfit && <AvatarLayer source={outfitLayers.outfit} />}
        {outfitLayers?.boots && <AvatarLayer source={outfitLayers.boots} />}
        {outfitLayers?.gloves && <AvatarLayer source={outfitLayers.gloves} />}
        {outfitLayers?.belt && <AvatarLayer source={outfitLayers.belt} />}
        {outfitLayers?.capeFront && (
          <AvatarLayer source={outfitLayers.capeFront} />
        )}

        {!outfitLayers && <FallbackOutfit outfitId={outfitId} />}

        <AvatarLayer source={BASE_BODY_LAYERS.hairFront} />

        {hatImage ? (
          <Image source={hatImage} style={styles.hatImage} />
        ) : hatLayerImage ? (
          <AvatarLayer source={hatLayerImage} />
        ) : (
          <FallbackHat hatId={hatId} />
        )}

        {outfitLayers?.accessories && (
          <AvatarLayer source={outfitLayers.accessories} />
        )}

        {accessoryImage && <AvatarLayer source={accessoryImage} />}
      </View>

      {petFrontImage ? (
        <Image source={petFrontImage} style={styles.petImage} />
      ) : (
        petId && (
          <View style={styles.pet}>
            <Text style={styles.petText}>🐉</Text>
          </View>
        )
      )}

      {particleImage && (
        <Image source={particleImage} style={styles.particleImage} />
      )}
    </View>
  );
}

function AvatarLayer({ source }: { source: ImageSourcePropType }) {
  return <Image source={source} style={styles.avatarLayer} />;
}

function FallbackOutfit({ outfitId }: { outfitId?: number | null }) {
  if (!outfitId) {
    return null;
  }

  return (
    <>
      <View style={styles.fallbackLegs}>
        <View style={styles.fallbackLeg} />
        <View style={styles.fallbackLeg} />
      </View>

      <View
        style={[
          styles.fallbackBody,
          outfitId === 3 && styles.scholarRobe,
          outfitId === 4 && styles.goldOutfit,
        ]}
      >
        {outfitId === 3 && <View style={styles.robeGem} />}
        {outfitId === 4 && <View style={styles.goldGem} />}
      </View>
    </>
  );
}

function FallbackHat({ hatId }: { hatId?: number | null }) {
  if (hatId === 1) {
    return <View style={styles.starterCap} />;
  }

  if (hatId === 2) {
    return <View style={styles.headband} />;
  }

  return null;
}

const styles = StyleSheet.create({
  stage: {
    width: 260,
    height: 340,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },

  backgroundLayer: {
    position: "absolute",
    width: 235,
    height: 290,
    borderRadius: 38,
    backgroundColor: "#1E3A8A",
    opacity: 0.35,
    borderWidth: 2,
    borderColor: "#38BDF8",
  },

  backgroundImage: {
    position: "absolute",
    width: 245,
    height: 300,
    borderRadius: 38,
    resizeMode: "cover",
  },

  auraGlow: {
    position: "absolute",
    width: 210,
    height: 260,
    borderRadius: 999,
    backgroundColor: "#FACC15",
    opacity: 0.16,
    shadowColor: "#FACC15",
    shadowOpacity: 1,
    shadowRadius: 28,
  },

  auraImage: {
    position: "absolute",
    width: 245,
    height: 245,
    resizeMode: "contain",
    opacity: 0.78,
  },

  character: {
    width: 210,
    height: 290,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    transform: [{ translateY: 18 }],
  },

  shadow: {
    position: "absolute",
    bottom: 58,
    width: 112,
    height: 22,
    borderRadius: 999,
    backgroundColor: "#020617",
    opacity: 0.24,
  },

  avatarLayer: {
    position: "absolute",
    width: 210,
    height: 290,
    resizeMode: "contain",
    zIndex: 3,
  },

  hatImage: {
    position: "absolute",
    top: 18,
    width: 150,
    height: 96,
    resizeMode: "contain",
    zIndex: 6,
  },

  fallbackBody: {
    position: "absolute",
    bottom: 72,
    width: 128,
    height: 112,
    backgroundColor: "#475569",
    borderRadius: 30,
    borderWidth: 5,
    borderColor: "#64748B",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 4,
  },

  scholarRobe: {
    backgroundColor: "#6D28D9",
    borderColor: "#C4B5FD",
  },

  goldOutfit: {
    backgroundColor: "#FACC15",
    borderColor: "#FEF08A",
  },

  robeGem: {
    width: 24,
    height: 24,
    borderRadius: 999,
    backgroundColor: "#C4B5FD",
  },

  goldGem: {
    width: 24,
    height: 24,
    borderRadius: 999,
    backgroundColor: "#22C55E",
  },

  fallbackLegs: {
    position: "absolute",
    bottom: 46,
    flexDirection: "row",
    gap: 14,
    zIndex: 2,
  },

  fallbackLeg: {
    width: 34,
    height: 58,
    backgroundColor: "#334155",
    borderRadius: 16,
  },

  starterCap: {
    position: "absolute",
    top: 46,
    width: 108,
    height: 28,
    backgroundColor: colors.primary,
    borderRadius: 999,
    zIndex: 8,
    borderWidth: 3,
    borderColor: "#C4B5FD",
  },

  headband: {
    position: "absolute",
    top: 70,
    width: 114,
    height: 16,
    backgroundColor: "#22C55E",
    borderRadius: 999,
    zIndex: 8,
  },

  pet: {
    position: "absolute",
    right: 18,
    bottom: 44,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#1E293B",
    borderWidth: 2,
    borderColor: "#8B5CF6",
    alignItems: "center",
    justifyContent: "center",
  },

  petText: {
    fontSize: 32,
  },

  petImage: {
    position: "absolute",
    right: 12,
    bottom: 28,
    width: 86,
    height: 86,
    resizeMode: "contain",
  },

  petBehindImage: {
    position: "absolute",
    left: 14,
    bottom: 38,
    width: 72,
    height: 72,
    resizeMode: "contain",
  },

  particleImage: {
    position: "absolute",
    width: 260,
    height: 340,
    resizeMode: "contain",
  },
});
