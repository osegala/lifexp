import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useMemo } from "react";
import { ActivityIndicator, FlatList, Image, Modal, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import type { Avatar, Cosmetic, CosmeticId, CosmeticType } from "../types/avatar";
import type { AvatarAppearance } from "../avatar/appearance";
import { getEquippedSceneSource } from "../avatar/assetRegistry";
import { uiTheme as ui } from "../theme/theme";
import AvatarRenderer from "./AvatarRenderer";
import AppearanceEditor from "./AppearanceEditor";
import WardrobeCard from "./WardrobeCard";
import LifeButton from "./LifeButton";
import { BadgePill } from "./ui/Indicators";
import { EmptyState, FilterChip, SectionHeader, SurfaceCard, UiPressable, UiText } from "./ui/Primitives";

export type WardrobeSection = { title: string; type: CosmeticType; icon: React.ComponentProps<typeof MaterialCommunityIcons>["name"] };
export const WARDROBE_SECTIONS: WardrobeSection[] = [
  { title: "Hair", type: "HAIR", icon: "face-man-shimmer" },
  { title: "Hats", type: "HAT", icon: "wizard-hat" },
  { title: "Tops & Dresses", type: "TOP", icon: "tshirt-crew" },
  { title: "Bottoms", type: "BOTTOM", icon: "human-male" },
  { title: "Boots", type: "BOOTS", icon: "shoe-formal" },
  { title: "Scenes", type: "BACKGROUND", icon: "image" },
  { title: "Pets", type: "PET", icon: "paw" },
  { title: "Auras", type: "AURA", icon: "star-four-points" },
];
type Props = {
  avatar: Avatar | null; cosmetics: Cosmetic[]; username?: string; level?: number;
  selectedType: CosmeticType; loading: boolean; loadingId: CosmeticId | null;
  loadError: string; equipmentError: string; premiumItemIds: string[];
  previewAllCosmetics: boolean; canPreview: boolean;
  editingAppearance: boolean; confirmDiscardAppearance: boolean;
  draftAppearance: AvatarAppearance | null; appearanceDirty: boolean; savingAppearance: boolean; appearanceSaveError: string;
  onType: (type: CosmeticType) => void; onEquip: (cosmetic: Cosmetic) => void; onRetry: () => void;
  onEditAppearance: () => void; onCloseAppearance: () => void; onKeepEditing: () => void; onDiscardAppearance: () => void;
  onChangeAppearance: (patch: Partial<AvatarAppearance>) => void; onSaveAppearance: () => void; onTogglePreview: () => void;
};

export default function AvatarContent(props: Props) {
  const { width } = useWindowDimensions();
  const stackedHero = width < 760;
  const activeSection = WARDROBE_SECTIONS.find(section => section.type === props.selectedType) ?? WARDROBE_SECTIONS[0];
  const activeCosmetics = useMemo(() => props.cosmetics.filter(cosmetic => cosmetic.type === props.selectedType), [props.cosmetics, props.selectedType]);
  const equippedCosmetics = props.cosmetics.filter(cosmetic => cosmetic.equipped);
  const backgroundImage = getEquippedSceneSource(props.cosmetics, props.avatar?.equippedBackgroundId, "BACKGROUND");
  const mobileGridWidth = width - ui.spacing.lg * 2;
  const cardWidth = width >= 900 ? 210 : width >= 620 ? 190
    : mobileGridWidth >= 300 + ui.spacing.md ? (mobileGridWidth - ui.spacing.md) / 2 : mobileGridWidth;
  const columns = Math.max(1, Math.floor((Math.min(width, 1160) - ui.spacing.lg * 2 + ui.spacing.md) / (cardWidth + ui.spacing.md)));
  const avatar = props.avatar, cosmetics = props.cosmetics;
  // The same existing renderer and props, mounted in only the visible preview location.
  const character = avatar && <AvatarRenderer showBackground={false}
    hairId={avatar.equippedHairId} hatId={avatar.equippedHatId} topId={avatar.equippedTopId}
    bottomId={avatar.equippedBottomId} bootsId={avatar.equippedBootsId} backgroundId={avatar.equippedBackgroundId}
    petId={avatar.equippedPetId} auraId={avatar.equippedAuraId} bodyType={avatar.bodyType}
    skinColorId={avatar.skinColorId} hairColorId={avatar.hairColorId} eyeColorId={avatar.eyeColorId} cosmetics={cosmetics} />;

  return <View style={styles.screen}>
    <FlatList key={`wardrobe-${columns}`} style={styles.screen} contentContainerStyle={styles.content}
      alwaysBounceVertical={false} bounces={false} overScrollMode="never"
      data={activeCosmetics} numColumns={columns} keyExtractor={cosmetic => String(cosmetic.id)}
      initialNumToRender={2} maxToRenderPerBatch={2} windowSize={3} removeClippedSubviews={false}
      extraData={props.loadingId} columnWrapperStyle={columns > 1 ? styles.grid : undefined}
      ItemSeparatorComponent={WardrobeSeparator}
      renderItem={({ item }) => <WardrobeCard cosmetic={item} width={cardWidth} loading={props.loadingId === item.id}
        previewMode={props.previewAllCosmetics} premiumOnly={props.premiumItemIds.includes(String(item.id))} onEquip={props.onEquip} />}
      ListHeaderComponent={<View style={styles.header}>
        <View style={styles.titleCopy}><UiText variant="display" accessibilityRole="header" aria-level={1}>Avatar</UiText>
          <UiText variant="caption" style={styles.secondary}>Make it yours.</UiText></View>
        {props.avatar && <SurfaceCard style={[styles.hero, stackedHero && styles.stackedHero]}>
          <View style={[styles.stage, stackedHero && styles.stackedStage]}>
            {backgroundImage && <Image source={backgroundImage} style={styles.background} resizeMode="stretch" accessible={false} aria-hidden />}
            {!props.editingAppearance && character}
          </View>
          <View style={[styles.heroCopy, stackedHero && styles.stackedCopy]}>
            <UiText variant="section">{props.username ?? "Adventurer"}</UiText>
            <BadgePill label={`Hero Level ${props.level ?? "—"}`} />
            <UiText variant="caption" style={styles.secondary}>Every outfit and hairstyle fits both characters. Mix pieces to build your hero; dresses cover your saved bottoms while worn.</UiText>
            <LifeButton tone="parchment" title="Edit Appearance" onPress={props.onEditAppearance} />
            {props.appearanceDirty && <BadgePill label="Unsaved appearance choices" tone="warning" />}
            {props.canPreview && <UiPressable accessibilityRole="switch" accessibilityLabel="Preview All Cosmetics"
              accessibilityState={{ checked: props.previewAllCosmetics }} aria-checked={props.previewAllCosmetics}
              onPress={props.onTogglePreview} style={styles.previewControl}>
              <UiText variant="label">{props.previewAllCosmetics ? "Exit Cosmetic Preview" : "Preview All Cosmetics"}</UiText>
              <UiText variant="caption" style={styles.secondary}>DEV only · changes are not saved</UiText>
            </UiPressable>}
            <View style={styles.badges}>{equippedCosmetics.slice(0, 6).map(cosmetic => <BadgePill key={cosmetic.id} label={cosmetic.name} tone="success" />)}</View>
          </View>
        </SurfaceCard>}
        {!!props.loadError && <SurfaceCard style={styles.notice}><UiText accessibilityRole="alert" style={styles.error}>{props.loadError}</UiText>
          <LifeButton tone="parchment" title="Retry wardrobe" variant="secondary" disabled={props.loading} onPress={props.onRetry} /></SurfaceCard>}
        {!!props.equipmentError && <UiText accessibilityRole="alert" style={styles.error}>{props.equipmentError}</UiText>}
        {props.loading && <View style={styles.loading} accessibilityLiveRegion="polite"><ActivityIndicator color={ui.colors.primary} accessibilityLabel="Loading wardrobe" />
          <UiText variant="caption" style={styles.secondary}>{props.avatar ? "Refreshing your wardrobe…" : "Opening your wardrobe…"}</UiText></View>}
        <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={styles.tabs} accessibilityLabel="Wardrobe categories">
          {WARDROBE_SECTIONS.map(section => {
            const count = props.cosmetics.filter(cosmetic => cosmetic.type === section.type).length;
            return <FilterChip key={section.type} label={section.title + (count ? ` · ${count}` : "")}
              selected={section.type === props.selectedType} onPress={() => props.onType(section.type)} />;
          })}
        </ScrollView>
        <SectionHeader title={activeSection.title} subtitle={`${activeCosmetics.length} option${activeCosmetics.length === 1 ? "" : "s"} in this collection`} />
        {props.selectedType === "HAIR" && <UiText variant="caption" style={styles.secondary}>Hair choices are saved with Edit Appearance.</UiText>}
      </View>}
      ListEmptyComponent={!props.loading && props.avatar ? <EmptyState title="More gear is on the way"
        description="This wardrobe shelf is ready for future rewards." /> : null} />
    <Modal animationType="slide" transparent statusBarTranslucent visible={props.editingAppearance} onRequestClose={props.onCloseAppearance}>
      {props.editingAppearance && <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.modalHeader}>
            <UiText variant="section" accessibilityRole="header" aria-level={1} style={styles.modalTitle}>Edit Appearance</UiText>
            <UiPressable accessibilityRole="button" accessibilityLabel="Close appearance editor" accessibilityState={{ disabled: props.savingAppearance }}
              disabled={props.savingAppearance} hitSlop={8} onPress={props.onCloseAppearance} style={styles.close}>
              <MaterialCommunityIcons name="close" size={ui.size.icon} color={ui.colors.text} accessible={false} aria-hidden />
            </UiPressable>
          </View>
          <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
            {props.confirmDiscardAppearance ? <SurfaceCard style={styles.notice}>
              <UiText variant="section" accessibilityRole="alert">Discard appearance changes?</UiText>
              <UiText style={styles.secondary}>Your unsaved appearance choices will be reset.</UiText>
              <LifeButton tone="parchment" title="Keep Editing" onPress={props.onKeepEditing} />
              <LifeButton tone="parchment" title="Discard Changes" variant="danger" onPress={props.onDiscardAppearance} />
            </SurfaceCard> : <>
              <View style={styles.modalPreview}>{character}</View>
              {props.draftAppearance && <AppearanceEditor tone="parchment" appearance={props.draftAppearance} dirty={props.appearanceDirty}
                saving={props.savingAppearance} saveError={props.appearanceSaveError} onChange={props.onChangeAppearance} onSave={props.onSaveAppearance} />}
            </>}
          </ScrollView>
        </View>
      </View>}
    </Modal>
  </View>;
}

function WardrobeSeparator() { return <View style={{ height: ui.spacing.md }} />; }

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: ui.colors.background },
  // Keep horizontal bounds: they constrain the existing preview and card geometry.
  content: { width: "100%", maxWidth: 1160, alignSelf: "center", padding: ui.spacing.lg, paddingBottom: ui.spacing.xl },
  titleCopy: { gap: ui.spacing.xs },
  header: { gap: ui.spacing.lg, marginBottom: ui.spacing.lg },
  hero: { padding: ui.spacing.lg, flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "center", gap: ui.spacing.xl, overflow: "hidden" },
  stackedHero: { flexDirection: "column", flexWrap: "nowrap", justifyContent: "flex-start" },
  // Unchanged preview bounds, overflow and alignment; no renderer transforms or scaling added.
  stage: { width: 330, height: 440, maxWidth: "100%", alignItems: "center", justifyContent: "center", borderRadius: ui.radius.md,
    backgroundColor: ui.colors.stone, borderWidth: 1, borderColor: ui.colors.border, overflow: "hidden" },
  stackedStage: { width: "100%", maxWidth: 330, alignSelf: "center" },
  background: { ...StyleSheet.absoluteFill, width: "100%", height: "100%" },
  heroCopy: { flex: 1, minWidth: 260, maxWidth: 470, gap: ui.spacing.sm },
  stackedCopy: { flex: 0, flexBasis: "auto", flexShrink: 0, minWidth: 0, width: "100%", alignSelf: "center" },
  secondary: { color: ui.colors.secondaryText },
  error: { color: ui.colors.danger },
  notice: { gap: ui.spacing.md },
  previewControl: { gap: ui.spacing.xs, borderWidth: 1, borderColor: ui.colors.controlBorder, borderRadius: ui.radius.md, padding: ui.spacing.sm },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: ui.spacing.xs },
  loading: { flexDirection: "row", alignItems: "center", gap: ui.spacing.sm },
  tabs: { gap: ui.spacing.sm, padding: ui.spacing.sm },
  grid: { gap: ui.spacing.md },
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(4, 10, 8, 0.72)" },
  sheet: { width: "100%", maxWidth: 760, alignSelf: "center", maxHeight: "92%", borderTopLeftRadius: ui.radius.md, borderTopRightRadius: ui.radius.md,
    borderWidth: 1, borderColor: ui.colors.border, backgroundColor: ui.colors.background, overflow: "hidden" },
  modalHeader: { minHeight: 70, flexShrink: 0, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: ui.spacing.sm,
    borderBottomWidth: 1, borderBottomColor: ui.colors.border, paddingHorizontal: ui.spacing.lg },
  modalTitle: { flex: 1, minWidth: 0 },
  close: { width: ui.size.target, height: ui.size.target, alignItems: "center", borderRadius: ui.radius.md, backgroundColor: ui.colors.surface },
  modalContent: { width: "100%", maxWidth: 760, alignSelf: "center", gap: ui.spacing.md, padding: ui.spacing.lg, paddingBottom: 48 },
  modalPreview: { height: 350, alignItems: "center", justifyContent: "center", borderRadius: ui.radius.md, backgroundColor: ui.colors.stone, overflow: "hidden" },
});
