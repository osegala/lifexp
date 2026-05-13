import { useCallback, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";

import { api } from "../../src/api/client";
import AvatarRenderer from "../../src/components/AvatarRenderer";
import LifeButton from "../../src/components/LifeButton";
import LifeCard from "../../src/components/LifeCard";
import { colors, radius, spacing } from "../../src/theme/theme";
import { Avatar, Cosmetic } from "../../src/types/avatar";

export default function AvatarScreen() {
  const [avatar, setAvatar] = useState<Avatar | null>(null);
  const [cosmetics, setCosmetics] = useState<Cosmetic[]>([]);
  const [loadingId, setLoadingId] = useState<number | null>(null);

  useFocusEffect(
    useCallback(() => {
      loadAvatarData();
    }, []),
  );

  async function loadAvatarData() {
    try {
      const avatarRes = await api.get<Avatar>("/avatar");
      const cosmeticsRes = await api.get<Cosmetic[]>("/avatar/cosmetics");

      console.log("Avatar response:", avatarRes.data);
      console.log("Cosmetics response:", cosmeticsRes.data);

      setAvatar(avatarRes.data);
      setCosmetics(cosmeticsRes.data);
    } catch (error) {
      console.log("Avatar load error:", error);
      Alert.alert("Error", "Could not load avatar.");
    }
  }

  async function equipCosmetic(cosmeticId: number) {
    try {
      setLoadingId(cosmeticId);

      await api.put("/avatar/equip", {
        cosmeticId,
      });

      await loadAvatarData();
    } catch (error) {
      console.log("Equip error:", error);
      Alert.alert("Error", "Could not equip cosmetic.");
    } finally {
      setLoadingId(null);
    }
  }

  const hats = cosmetics.filter((c) => c.type === "HAT");
  const outfits = cosmetics.filter((c) => c.type === "OUTFIT");
  const backgrounds = cosmetics.filter((c) => c.type === "BACKGROUND");
  const pets = cosmetics.filter((c) => c.type === "PET");
  const auras = cosmetics.filter((c) => c.type === "AURA");

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Avatar</Text>
      <Text style={styles.subtitle}>Customize your LifeXP character.</Text>

      <LifeCard style={styles.avatarCard}>
        <AvatarRenderer
          hatId={avatar?.equippedHatId}
          outfitId={avatar?.equippedOutfitId}
          backgroundId={avatar?.equippedBackgroundId}
          petId={avatar?.equippedPetId}
          auraId={avatar?.equippedAuraId}
        />
      </LifeCard>

      <CosmeticSection
        title="Hats"
        cosmetics={hats}
        loadingId={loadingId}
        onEquip={equipCosmetic}
      />

      <CosmeticSection
        title="Outfits"
        cosmetics={outfits}
        loadingId={loadingId}
        onEquip={equipCosmetic}
      />

      <CosmeticSection
        title="Backgrounds"
        cosmetics={backgrounds}
        loadingId={loadingId}
        onEquip={equipCosmetic}
      />

      <CosmeticSection
        title="Pets"
        cosmetics={pets}
        loadingId={loadingId}
        onEquip={equipCosmetic}
      />

      <CosmeticSection
        title="Auras"
        cosmetics={auras}
        loadingId={loadingId}
        onEquip={equipCosmetic}
      />
    </ScrollView>
  );
}

function CosmeticSection({
  title,
  cosmetics,
  onEquip,
  loadingId,
}: {
  title: string;
  cosmetics: Cosmetic[];
  onEquip: (id: number) => void;
  loadingId: number | null;
}) {
  return (
    <LifeCard>
      <Text style={styles.sectionTitle}>{title}</Text>

      <View style={styles.cosmeticContainer}>
        {cosmetics.length === 0 && (
          <Text style={styles.emptyText}>No cosmetics found.</Text>
        )}

        {cosmetics.map((cosmetic) => (
          <View
            key={cosmetic.id}
            style={[
              styles.cosmeticCard,
              cosmetic.equipped && styles.equippedCard,
              !cosmetic.unlocked && styles.lockedCard,
            ]}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.cosmeticName}>{cosmetic.name}</Text>

              <Text style={styles.cosmeticMeta}>
                Level {cosmetic.requiredLevel} Required
              </Text>

              <Text
                style={[
                  styles.status,
                  cosmetic.equipped && styles.equippedStatus,
                  !cosmetic.unlocked && styles.lockedStatus,
                ]}
              >
                {cosmetic.equipped
                  ? "Equipped"
                  : cosmetic.unlocked
                    ? "Unlocked"
                    : "Locked"}
              </Text>
            </View>

            {cosmetic.unlocked && !cosmetic.equipped && (
              <LifeButton
                title={loadingId === cosmetic.id ? "..." : "Equip"}
                onPress={() => onEquip(cosmetic.id)}
              />
            )}
          </View>
        ))}
      </View>
    </LifeCard>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  content: {
    padding: spacing.lg,
    paddingBottom: 120,
    gap: spacing.lg,
  },

  title: {
    color: colors.text,
    fontSize: 36,
    fontWeight: "900",
  },

  subtitle: {
    color: colors.mutedText,
    fontSize: 16,
    marginTop: -spacing.md,
  },

  avatarCard: {
    alignItems: "center",
  },

  sectionTitle: {
    color: colors.text,
    fontSize: 24,
    fontWeight: "900",
    marginBottom: spacing.md,
  },

  cosmeticContainer: {
    gap: spacing.md,
  },

  cosmeticCard: {
    backgroundColor: colors.cardLight,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },

  equippedCard: {
    borderColor: "#FACC15",
    borderWidth: 2,
  },

  lockedCard: {
    opacity: 0.55,
  },

  cosmeticName: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900",
  },

  cosmeticMeta: {
    color: colors.mutedText,
    marginTop: 4,
    fontWeight: "700",
  },

  status: {
    color: colors.accent,
    marginTop: 6,
    fontWeight: "900",
  },

  equippedStatus: {
    color: "#FACC15",
  },

  lockedStatus: {
    color: colors.mutedText,
  },

  emptyText: {
    color: colors.mutedText,
  },
});
