import GameNotice from "./ui/GameNotice";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Image, Modal, ScrollView, StyleSheet, View, useWindowDimensions, type ViewToken } from "react-native";
import type { Avatar, Cosmetic, CosmeticId, CosmeticType } from "../types/avatar";
import type { AvatarAppearance } from "../avatar/appearance";
import { getAvatarSceneSource } from "../avatar/scene";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { wardrobeTrayStops } from "../avatar/tray";
import ExpandableTray from "./ui/ExpandableTray";
import PageBackground from "./ui/PageBackground";
import { uiTheme as ui } from "../theme/theme";
import AvatarRenderer from "./AvatarRenderer";
import AppearanceEditor from "./AppearanceEditor";
import WardrobeCard from "./WardrobeCard";
import { DestructiveButton, IconUtilityButton, PrimaryButton, SecondaryButton } from "./ui/Buttons";
import PaperTexture from "./ui/PaperTexture";
import { BadgePill } from "./ui/Indicators";
import { EmptyState, FilterChip, SectionHeader, SurfaceCard, UiPressable, UiText } from "./ui/Primitives";

import { prefetchWardrobeThumbnails } from "../avatar/prefetch";

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
  selectedType: CosmeticType; loading: boolean; refreshing?: boolean; loadingId: CosmeticId | null;
  loadError: string; equipmentError: string; premiumItemIds: string[];
  previewAllCosmetics: boolean; canPreview: boolean;
  premiumAvailable?: boolean; onPremium?: () => void;
  editingAppearance: boolean; confirmDiscardAppearance: boolean;
  draftAppearance: AvatarAppearance | null; appearanceDirty: boolean; savingAppearance: boolean; appearanceSaveError: string;
  onType: (type: CosmeticType) => void; onEquip: (cosmetic: Cosmetic) => void; onRetry: () => void;
  onEditAppearance: () => void; onCloseAppearance: () => void; onKeepEditing: () => void; onDiscardAppearance: () => void;
  onChangeAppearance: (patch: Partial<AvatarAppearance>) => void; onSaveAppearance: () => void; onTogglePreview: () => void;
};

export default function AvatarContent(props: Props) {
  const { width, height, fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [frameHeight, setFrameHeight] = useState(height - 80);
  const [trayIndex, setTrayIndex] = useState(1);
  const [headerHeight, setHeaderHeight] = useState(insets.top + 88);
  const availableHeight = Math.max(220, frameHeight - headerHeight);
  const stops = useMemo(() => wardrobeTrayStops(availableHeight, fontScale), [availableHeight, fontScale]);
  const activeSection = WARDROBE_SECTIONS.find(section => section.type === props.selectedType) ?? WARDROBE_SECTIONS[0];
  const activeCosmetics = useMemo(() => props.cosmetics.filter(cosmetic => cosmetic.type === props.selectedType), [props.cosmetics, props.selectedType]);
  const backgroundImage = getAvatarSceneSource(props.cosmetics, props.avatar?.equippedBackgroundId);
  const gridWidth = Math.min(width, 900) - ui.spacing.sm * 2;
  const columns = fontScale >= 1.5 ? (width < 390 ? 1 : width < 620 ? 2 : 3)
    : width < 360 ? 2 : width < 900 ? 4 : 5;
  const cardWidth = (gridWidth - ui.spacing.sm * (columns - 1)) / columns;
  useEffect(() => { void prefetchWardrobeThumbnails(activeCosmetics.slice(0, columns * 2)); }, [activeCosmetics, columns]);
  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken<Cosmetic>[] }) => {
    void prefetchWardrobeThumbnails(viewableItems.filter(token => token.isViewable).map(token => token.item));
  }).current;
  const characterWidth = Math.max(160, Math.min(390, width, availableHeight * 0.86));
  const avatar = props.avatar, cosmetics = props.cosmetics;
  // The same existing renderer and props, mounted in only the visible preview location.
  const character = avatar && <AvatarRenderer showBackground={false}
    hairId={avatar.equippedHairId} hatId={avatar.equippedHatId} topId={avatar.equippedTopId}
    bottomId={avatar.equippedBottomId} bootsId={avatar.equippedBootsId} backgroundId={avatar.equippedBackgroundId}
    petId={avatar.equippedPetId} auraId={avatar.equippedAuraId} bodyType={avatar.bodyType}
    skinColorId={avatar.skinColorId} hairColorId={avatar.hairColorId} eyeColorId={avatar.eyeColorId} cosmetics={cosmetics} />;

  return <PageBackground illustrated={!backgroundImage} onLayout={event => setFrameHeight(event.nativeEvent.layout.height)}>
    {backgroundImage && <Image source={backgroundImage} style={styles.background} resizeMode="cover" accessible={false} aria-hidden />}
    <View onLayout={event => setHeaderHeight(event.nativeEvent.layout.height)} style={[styles.sceneHeader, { paddingTop: insets.top + ui.spacing.sm }]}>
      <View style={styles.titleCopy}><UiText variant="display" accessibilityRole="header" aria-level={1} style={styles.sceneTitle}>Avatar</UiText>
        <UiText variant="caption" style={styles.sceneSubtitle}>Make it yours.</UiText></View>
      <IconUtilityButton icon="account-edit-outline" accessibilityLabel="Edit Appearance" onPress={props.onEditAppearance} disabled={!props.avatar} />
    </View>
    <View pointerEvents="box-none" style={[styles.stage, { paddingTop: headerHeight, paddingBottom: stops[1] * 0.6 }]} testID="avatar-scene">
      <View style={[styles.character, { width: characterWidth }]}>
        {!props.editingAppearance && character}
      </View>
      {!props.avatar && <UiText accessibilityLiveRegion="polite" style={styles.sceneNotice}>{props.loading ? "Opening your wardrobe…" : "Character preview unavailable."}</UiText>}
    </View>
    <ExpandableTray stops={stops} index={trayIndex} onChange={setTrayIndex}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll} contentContainerStyle={styles.tabs} accessibilityLabel="Wardrobe categories">
        {WARDROBE_SECTIONS.map(section => <FilterChip key={section.type} label={section.title}
          leading={<MaterialCommunityIcons name={section.icon} size={18} color={section.type === props.selectedType ? ui.colors.onPrimary : ui.colors.secondaryText} accessible={false} />}
          selected={section.type === props.selectedType} onPress={() => props.onType(section.type)} />)}
      </ScrollView>
      <FlatList key={`wardrobe-${columns}`} style={[styles.list, trayIndex === 0 && styles.hiddenList]} contentContainerStyle={styles.content}
        onViewableItemsChanged={onViewableItemsChanged} data={activeCosmetics} numColumns={columns} keyExtractor={cosmetic => String(cosmetic.id)}
        initialNumToRender={2} maxToRenderPerBatch={2} windowSize={3} removeClippedSubviews={false}
        extraData={props.loadingId} columnWrapperStyle={columns > 1 ? styles.grid : undefined}
        ItemSeparatorComponent={WardrobeSeparator}
        renderItem={({ item }) => <WardrobeCard cosmetic={item} width={cardWidth} loading={props.loadingId === item.id}
          previewMode={props.previewAllCosmetics} premiumOnly={props.premiumItemIds.includes(String(item.id))} onEquip={props.onEquip}
          premiumAvailable={props.premiumAvailable} onPremium={props.onPremium} />}
        ListHeaderComponent={<View style={styles.collectionHeader}>
          <SectionHeader title={activeSection.title} trailing={props.avatar ? <UiText variant="caption" style={styles.secondary}>{activeCosmetics.length} looks</UiText> : undefined} />
          {props.appearanceDirty && <BadgePill label="Unsaved appearance choices" tone="warning" />}
          {props.selectedType === "HAIR" && <UiText variant="caption" style={styles.secondary}>Save hair choices in Appearance.</UiText>}
          {!!props.loadError && <GameNotice title="Wardrobe unavailable" message={props.loadError} variant="error" style={styles.notice}>
            <SecondaryButton title="Retry wardrobe" disabled={props.loading} onPress={props.onRetry} /></GameNotice>}
          {!!props.equipmentError && <GameNotice title="Equipment unchanged" message={props.equipmentError} variant="error" />}
          {(props.loading || props.refreshing) && <View style={styles.loading} accessibilityLiveRegion="polite"><ActivityIndicator color={ui.colors.primary} accessibilityLabel="Loading wardrobe" />
            <UiText variant="caption" style={styles.secondary}>{props.avatar ? "Refreshing your wardrobe…" : "Loading your wardrobe…"}</UiText></View>}
          {props.canPreview && <UiPressable accessibilityRole="switch" accessibilityLabel="Preview All Cosmetics"
            accessibilityState={{ checked: props.previewAllCosmetics }} aria-checked={props.previewAllCosmetics}
            onPress={props.onTogglePreview} style={styles.previewControl}>
            <UiText variant="caption">{props.previewAllCosmetics ? "Exit Cosmetic Preview" : "Preview All Cosmetics"} · DEV only · changes are not saved</UiText>
          </UiPressable>}
        </View>}
        ListEmptyComponent={!props.loading && props.avatar ? <EmptyState title="More gear is on the way"
          description="This wardrobe shelf is ready for future rewards." /> : null} />
    </ExpandableTray>
    <Modal animationType="slide" transparent statusBarTranslucent visible={props.editingAppearance} onRequestClose={props.onCloseAppearance}>
      {props.editingAppearance && <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <PaperTexture />
          <View style={styles.modalHeader}>
            <UiText variant="section" accessibilityRole="header" aria-level={1} style={styles.modalTitle}>Edit Appearance</UiText>
            <IconUtilityButton icon="close" accessibilityLabel="Close appearance editor" accessibilityState={{ disabled: props.savingAppearance }}
              disabled={props.savingAppearance} hitSlop={8} onPress={props.onCloseAppearance} />
          </View>
          <ScrollView key={props.confirmDiscardAppearance ? "discard" : "editor"}
            contentContainerStyle={[styles.modalContent, { paddingBottom: insets.bottom + ui.spacing.lg }]} keyboardShouldPersistTaps="handled">
            {props.confirmDiscardAppearance ? <SurfaceCard framed style={styles.notice}>
              <UiText variant="section" accessibilityRole="alert">Discard appearance changes?</UiText>
              <UiText style={styles.secondary}>Your unsaved appearance choices will be reset.</UiText>
              <PrimaryButton title="Keep Editing" onPress={props.onKeepEditing} />
              <DestructiveButton title="Discard Changes" onPress={props.onDiscardAppearance} />
            </SurfaceCard> : <>
              <View style={styles.modalPreview}>
                {backgroundImage && <Image source={backgroundImage} style={styles.background} resizeMode="cover" accessible={false} aria-hidden />}
                {character}
              </View>
              {props.draftAppearance && <AppearanceEditor tone="parchment" appearance={props.draftAppearance} dirty={props.appearanceDirty}
                saving={props.savingAppearance} saveError={props.appearanceSaveError} onChange={props.onChangeAppearance} onSave={props.onSaveAppearance} />}
            </>}
          </ScrollView>
        </View>
      </View>}
    </Modal>
  </PageBackground>;
}

function WardrobeSeparator() { return <View style={{ height: ui.spacing.sm }} />; }

const styles = StyleSheet.create({
  sceneHeader: { position: "absolute", top: 0, left: 0, right: 0, zIndex: 2, paddingHorizontal: ui.spacing.md, paddingBottom: ui.spacing.sm, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: ui.spacing.sm },
  titleCopy: { flex: 1, gap: ui.spacing.xs },
  sceneTitle: { fontSize: 32, lineHeight: 36, letterSpacing: 0.4, color: ui.colors.primaryPressed,
    textShadowColor: "rgba(255,248,233,0.9)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },
  sceneSubtitle: { color: ui.colors.text, textShadowColor: "rgba(255,248,233,0.9)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },
  stage: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  character: { maxWidth: "100%", alignItems: "center", justifyContent: "center" },
  background: { ...StyleSheet.absoluteFill, width: "100%", height: "100%" },
  sceneNotice: { position: "absolute", alignSelf: "center", backgroundColor: ui.colors.surface, padding: ui.spacing.sm },
  list: { flex: 1 },
  hiddenList: { display: "none" },
  content: { padding: ui.spacing.sm, paddingBottom: ui.spacing.lg },
  collectionHeader: { gap: ui.spacing.sm, marginBottom: ui.spacing.sm },
  secondary: { color: ui.colors.secondaryText },
  error: { color: ui.colors.danger },
  notice: { gap: ui.spacing.sm },
  previewControl: { padding: ui.spacing.sm, borderWidth: 1, borderColor: ui.colors.controlBorder, borderRadius: ui.radius.md },
  loading: { flexDirection: "row", alignItems: "center", gap: ui.spacing.sm },
  categoryScroll: { flexGrow: 0, flexShrink: 0 },
  tabs: { gap: ui.spacing.xs, paddingHorizontal: ui.spacing.sm, paddingBottom: ui.spacing.sm },
  grid: { gap: ui.spacing.sm },
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: ui.colors.scrim },
  sheet: { width: "100%", maxWidth: 760, alignSelf: "center", maxHeight: "92%", borderTopLeftRadius: ui.radius.md, borderTopRightRadius: ui.radius.md,
    borderWidth: 1, borderColor: ui.colors.gold, backgroundColor: ui.colors.background, overflow: "hidden" },
  modalHeader: { minHeight: 70, flexShrink: 0, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: ui.spacing.sm,
    borderBottomWidth: 1, borderBottomColor: ui.colors.border, paddingHorizontal: ui.spacing.lg },
  modalTitle: { flex: 1, minWidth: 0 },
  modalContent: { width: "100%", maxWidth: 760, alignSelf: "center", gap: ui.spacing.md, padding: ui.spacing.lg, paddingBottom: 48 },
  modalPreview: { height: 350, alignItems: "center", justifyContent: "center", borderRadius: ui.radius.md,
    borderWidth: 1, borderColor: ui.colors.controlBorder, backgroundColor: ui.colors.paperInset, overflow: "hidden" },
});
