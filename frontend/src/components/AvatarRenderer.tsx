import { View, StyleSheet, Text } from "react-native";
import { colors } from "../theme/theme";

type Props = {
  hatId?: number | null;
  outfitId?: number | null;
  backgroundId?: number | null;
  petId?: number | null;
  auraId?: number | null;
};

export default function AvatarRenderer({
  hatId,
  outfitId,
  backgroundId,
  petId,
  auraId,
}: Props) {
  return (
    <View style={styles.wrapper}>
      {backgroundId && <View style={styles.backgroundGlow} />}

      <View style={[styles.container, auraId ? styles.aura : undefined]}>
        {hatId === 1 && <View style={styles.starterCap} />}
        {hatId === 2 && <View style={styles.headband} />}

        <View style={styles.head}>
          <View style={styles.eye} />
          <View style={styles.eye} />
        </View>

        <View
          style={[
            styles.body,
            outfitId === 3 && styles.scholarRobe,
            outfitId === 4 && styles.goldOutfit,
          ]}
        >
          {outfitId === 3 && <View style={styles.robeGem} />}
          {outfitId === 4 && <View style={styles.goldGem} />}
        </View>

        <View style={styles.legs} />

        {petId && (
          <View style={styles.pet}>
            <Text style={styles.petText}>🐉</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: 240,
    height: 320,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },

  backgroundGlow: {
    position: "absolute",
    width: 220,
    height: 260,
    borderRadius: 40,
    backgroundColor: "#1E3A8A",
    opacity: 0.35,
  },

  container: {
    width: 220,
    height: 300,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },

  aura: {
    shadowColor: "#FACC15",
    shadowOpacity: 0.9,
    shadowRadius: 24,
  },

  starterCap: {
    width: 100,
    height: 26,
    backgroundColor: colors.primary,
    borderRadius: 999,
    marginBottom: -4,
    zIndex: 5,
  },

  headband: {
    width: 105,
    height: 16,
    backgroundColor: "#22C55E",
    borderRadius: 999,
    marginBottom: -2,
    zIndex: 5,
  },

  head: {
    width: 105,
    height: 105,
    backgroundColor: "#F2C19B",
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 22,
    zIndex: 3,
  },

  eye: {
    width: 12,
    height: 12,
    backgroundColor: "#020617",
    borderRadius: 999,
  },

  body: {
    width: 125,
    height: 105,
    backgroundColor: "#475569",
    borderRadius: 28,
    marginTop: -6,
    borderWidth: 5,
    borderColor: "#64748B",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },

  scholarRobe: {
    backgroundColor: "#7C3AED",
    borderColor: "#C4B5FD",
  },

  goldOutfit: {
    backgroundColor: "#FACC15",
    borderColor: "#FEF08A",
  },

  robeGem: {
    width: 22,
    height: 22,
    borderRadius: 999,
    backgroundColor: "#C4B5FD",
  },

  goldGem: {
    width: 22,
    height: 22,
    borderRadius: 999,
    backgroundColor: "#22C55E",
  },

  legs: {
    width: 86,
    height: 54,
    backgroundColor: "#334155",
    borderBottomLeftRadius: 22,
    borderBottomRightRadius: 22,
    marginTop: -4,
    zIndex: 1,
  },

  pet: {
    position: "absolute",
    right: 18,
    bottom: 42,
    zIndex: 6,
  },

  petText: {
    fontSize: 32,
  },
});
