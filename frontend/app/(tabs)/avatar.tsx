import { useCallback, useState } from "react";
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect } from "expo-router";

import { api } from "../../src/api/client";
import { getCosmeticPreviewSource } from "../../src/avatar/assetRegistry";
import AvatarRenderer from "../../src/components/AvatarRenderer";
import LifeButton from "../../src/components/LifeButton";
import LifeCard from "../../src/components/LifeCard";
import { useAuth } from "../../src/context/AuthContext";
import { colors, radius, spacing } from "../../src/theme/theme";
import { Avatar, Cosmetic } from "../../src/types/avatar";

type CosmeticGroupTitle = "Hats" | "Outfits" | "Backgrounds" | "Pets" | "Auras";

export default function AvatarScreen() {
  const { user } = useAuth();
  const [avatar, setAvatar] = useState<Avatar | null>(null);
  const [cosmetics, setCosmetics] = useState<Cosmetic[]>([]);
  const [loadingId, setLoadingId] = useState<number | null>(null);
  const [selectedSection, setSelectedSection] =
    useState<CosmeticGroupTitle>("Hats");

  useFocusEffect(
    useCallback(() => {
      loadAvatarData();
    }, []),
  );

  async function loadAvatarData() {
    try {
      const avatarRes = await api.get<Avatar>("/avatar");
      const cosmeticsRes = await api.get<Cosmetic[]>("/avatar/cosmetics");

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
  const currentLevel = user?.level ?? 1;
  const nextUnlock = cosmetics
    .filter((cosmetic) => !cosmetic.unlocked)
    .sort((a, b) => a.requiredLevel - b.requiredLevel)[0];
  const sections: { title: CosmeticGroupTitle; cosmetics: Cosmetic[] }[] = [
    { title: "Hats", cosmetics: hats },
    { title: "Outfits", cosmetics: outfits },
    { title: "Backgrounds", cosmetics: backgrounds },
    { title: "Pets", cosmetics: pets },
    { title: "Auras", cosmetics: auras },
  ];
  const activeSection =
    sections.find((section) => section.title === selectedSection) ?? sections[0];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      alwaysBounceVertical={false}
      bounces={false}
      overScrollMode="never"
    >
      <LifeCard style={styles.avatarCard}>
        <AvatarRenderer
          hatId={avatar?.equippedHatId}
          outfitId={avatar?.equippedOutfitId}
          backgroundId={avatar?.equippedBackgroundId}
          petId={avatar?.equippedPetId}
          auraId={avatar?.equippedAuraId}
          bodyType={avatar?.bodyType}
          size="compact"
        />

        <Text style={styles.currentLevel}>Hero Level {currentLevel}</Text>
        {nextUnlock ? (
          <Text style={styles.unlockHint}>
            Next unlock: {nextUnlock.name} at level {nextUnlock.requiredLevel}.
          </Text>
        ) : (
          <Text style={styles.unlockHint}>All visible cosmetics unlocked.</Text>
        )}
      </LifeCard>

      <View style={styles.sectionTabs}>
        {sections.map((section) => (
          <Pressable
            key={section.title}
            onPress={() => setSelectedSection(section.title)}
            style={[
              styles.sectionTab,
              selectedSection === section.title && styles.selectedSectionTab,
            ]}
          >
            <Text
              style={[
                styles.sectionTabText,
                selectedSection === section.title &&
                  styles.selectedSectionTabText,
              ]}
            >
              {section.title}
            </Text>
          </Pressable>
        ))}
      </View>

      <CosmeticSection
        title={activeSection.title}
        cosmetics={activeSection.cosmetics}
        loadingId={loadingId}
        currentLevel={currentLevel}
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
  currentLevel,
}: {
  title: string;
  cosmetics: Cosmetic[];
  onEquip: (id: number) => void;
  loadingId: number | null;
  currentLevel: number;
}) {
  return (
    <LifeCard compact>
      <Text style={styles.sectionTitle}>{title}</Text>

      <View style={styles.cosmeticContainer}>
        {cosmetics.length === 0 && (
          <Text style={styles.emptyText}>No cosmetics found.</Text>
        )}

        {cosmetics.map((cosmetic) => (
          <CosmeticCard
            key={cosmetic.id}
            cosmetic={cosmetic}
            loading={loadingId === cosmetic.id}
            currentLevel={currentLevel}
            onEquip={onEquip}
          />
        ))}
      </View>
    </LifeCard>
  );
}

function CosmeticCard({
  cosmetic,
  loading,
  currentLevel,
  onEquip,
}: {
  cosmetic: Cosmetic;
  loading: boolean;
  currentLevel: number;
  onEquip: (id: number) => void;
}) {
  const previewSource = getCosmeticPreviewSource(cosmetic);
  const levelsAway = Math.max(0, cosmetic.requiredLevel - currentLevel);

  return (
    <View
      style={[
        styles.cosmeticCard,
        cosmetic.equipped && styles.equippedCard,
        !cosmetic.unlocked && styles.lockedCard,
      ]}
    >
      <View style={styles.previewBox}>
        {previewSource ? (
          <Image source={previewSource} style={styles.previewImage} />
        ) : (
          <Text style={styles.previewFallback}>{cosmetic.type[0]}</Text>
        )}
      </View>

      <View style={styles.cosmeticInfo}>
        <Text style={styles.cosmeticName}>{cosmetic.name}</Text>

        <Text style={styles.cosmeticMeta}>
          {cosmetic.unlocked
            ? `Unlocked at level ${cosmetic.requiredLevel}`
            : `${levelsAway} level${levelsAway === 1 ? "" : "s"} away`}
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

      <View style={styles.cosmeticAction}>
        {cosmetic.unlocked && !cosmetic.equipped && (
          <LifeButton
            title={loading ? "Equipping..." : "Equip"}
            onPress={() => onEquip(cosmetic.id)}
            disabled={loading}
          />
        )}
      </View>
    </View>
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
    fontSize: 30,
    fontWeight: "700",
  },

  subtitle: {
    color: colors.mutedText,
    fontSize: 16,
    marginTop: 2,
  },

  avatarCard: {
    alignItems: "center",
  },

  currentLevel: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "700",
    marginTop: spacing.md,
  },

  unlockHint: {
    color: colors.mutedText,
    fontWeight: "500",
    marginTop: spacing.xs,
    textAlign: "center",
  },

  sectionTabs: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },

  sectionTab: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    backgroundColor: colors.cardLight,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.md,
  },

  selectedSectionTab: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },

  sectionTabText: {
    color: colors.mutedText,
    fontWeight: "600",
  },

  selectedSectionTabText: {
    color: colors.text,
  },

  sectionTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "700",
    marginBottom: spacing.md,
  },

  cosmeticContainer: {
    gap: spacing.md,
  },

  cosmeticCard: {
    backgroundColor: colors.cardLight,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: spacing.md,
  },

  previewBox: {
    width: 62,
    height: 62,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },

  previewImage: {
    width: 58,
    height: 58,
    resizeMode: "contain",
  },

  previewFallback: {
    color: colors.mutedText,
    fontSize: 20,
    fontWeight: "700",
  },

  cosmeticInfo: {
    flex: 1,
    minWidth: 145,
  },

  cosmeticAction: {
    minWidth: 96,
    alignItems: "flex-end",
  },

  equippedCard: {
    borderColor: colors.primary,
    borderWidth: 1,
  },

  lockedCard: {
    opacity: 0.72,
  },

  cosmeticName: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "700",
  },

  cosmeticMeta: {
    color: colors.mutedText,
    marginTop: 4,
    fontWeight: "500",
  },

  status: {
    color: colors.accent,
    marginTop: 6,
    fontWeight: "600",
  },

  equippedStatus: {
    color: colors.primary,
  },

  lockedStatus: {
    color: colors.mutedText,
  },

  emptyText: {
    color: colors.mutedText,
  },
});
