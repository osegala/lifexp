import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useState, type ReactNode } from "react";
import { Image, Platform, StyleSheet, View, type ImageSourcePropType } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { getAvatarSceneSource } from "../avatar/scene";
import type { HomeAvatar } from "../home/avatar";
import { tasksForView } from "../tasks/scheduling";
import { formatDate, formatTime } from "../utils/dateFormat";
import { uiTheme as ui } from "../theme/theme";
import type { AchievementsResponse, GoalsResponse, TasksResponse, User } from "../types";
import AvatarRenderer from "./AvatarRenderer";
import { IconUtilityButton, SecondaryButton } from "./ui/Buttons";
import QuestProgress from "./QuestProgress";
import XPBar from "./XPBar";
import GameNotice from "./ui/GameNotice";
import { BadgePill, ResourceCluster, ResourcePill } from "./ui/Indicators";
import { EmptyState, ListRowCard, ScreenShell, SectionHeader, SurfaceCard, UiText } from "./ui/Primitives";

type Props = {
  user: User | null;
  goals: GoalsResponse | null;
  achievements: AchievementsResponse | null;
  tasks: TasksResponse | null;
  scene: HomeAvatar | null;
  loading: boolean;
  achievementsLoading?: boolean;
  tasksLoading: boolean;
  avatarLoading: boolean;
  questError: boolean;
  progressError: string;
  taskError: string;
  avatarError: string;
  onRetry: () => void;
  onProfile: () => void;
  onTasks: () => void;
  ad: ReactNode;
};

function HomeScene({ scene, loading, error, children }: { scene: HomeAvatar | null; loading: boolean; error: string; children: ReactNode }) {
  const [failedSource, setFailedSource] = useState<ImageSourcePropType | null>(null);
  const avatar = scene?.avatar;
  const background = getAvatarSceneSource(scene?.cosmetics, avatar?.equippedBackgroundId);
  const unavailable = !!avatar?.equippedBackgroundId && (!background || background === failedSource);
  return <View style={styles.scene} testID="home-scene">
    {background && !unavailable && <Image source={background} style={styles.background}
      resizeMode="cover" accessible={false} aria-hidden onError={() => setFailedSource(background)} />}
    {children}
    <View style={styles.characterStage}>
      {scene && avatar ? <View pointerEvents="none" accessible accessibilityLabel="Your equipped character" style={styles.character}>
        <View style={styles.characterInner} aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <AvatarRenderer showBackground={false} cosmetics={scene.cosmetics} bodyType={avatar.bodyType}
            hairId={avatar.equippedHairId} hatId={avatar.equippedHatId} topId={avatar.equippedTopId}
            bottomId={avatar.equippedBottomId} bootsId={avatar.equippedBootsId} backgroundId={avatar.equippedBackgroundId}
            petId={avatar.equippedPetId} auraId={avatar.equippedAuraId} skinColorId={avatar.skinColorId}
            hairColorId={avatar.hairColorId} eyeColorId={avatar.eyeColorId} />
        </View>
      </View> : <UiText style={styles.secondary} accessibilityLiveRegion="polite">
        {loading ? "Loading your character…" : "Character preview unavailable."}
      </UiText>}
    </View>
    {unavailable && !error && <UiText variant="caption" style={styles.sceneNotice}>Equipped background unavailable.</UiText>}
  </View>;
}

/** Presentation only. Mutations, rewards, routing and ad eligibility stay with their existing owners. */
export default function HomeContent(props: Props) {
  const { user, goals, achievements, tasks, scene, loading, questError, progressError, taskError, avatarError } = props;
  const insets = useSafeAreaInsets();
  const today = tasksForView(tasks?.tasks ?? [], "Today", tasks?.time.date ?? "");
  return <ScreenShell contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="never"
    overlay={<Svg pointerEvents="none" {...(Platform.OS === "web" ? { "aria-hidden": true } : { accessible: false })} style={styles.navBlend}>
      <Defs><LinearGradient id="home-nav-blend" x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0" stopColor={ui.colors.navigation} stopOpacity={0} />
        <Stop offset="1" stopColor={ui.colors.navigation} stopOpacity={0.32} />
      </LinearGradient></Defs>
      <Rect width="100%" height="100%" fill="url(#home-nav-blend)" />
    </Svg>}>
    <View style={styles.hero} testID="home-hero">
      <HomeScene scene={scene} loading={props.avatarLoading} error={avatarError}>
        <Svg pointerEvents="none" {...(Platform.OS === "web" ? { "aria-hidden": true } : { accessible: false })} style={[styles.sceneLight, { height: insets.top + 144 }]}>
          <Defs><LinearGradient id="home-top-light" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#FFF8E9" stopOpacity={0.65} />
            <Stop offset="0.5" stopColor="#FFF8E9" stopOpacity={0.4} />
            <Stop offset="1" stopColor="#FFF8E9" stopOpacity={0} />
          </LinearGradient></Defs>
          <Rect width="100%" height="100%" fill="url(#home-top-light)" />
        </Svg>
        <View style={[styles.sceneHeader, { paddingTop: insets.top + ui.spacing.md }]} testID="home-scene-header">
          <View style={styles.titleCopy}>
            <UiText variant="display" accessibilityRole="header" aria-level={1} style={[styles.sceneText, styles.wordmark]}>Evrenthia</UiText>
            <UiText variant="caption" style={[styles.sceneSubtitle, styles.sceneText]}>A more intentional you.</UiText>
          </View>
          <IconUtilityButton icon="account-cog-outline" onPress={props.onProfile} accessibilityLabel="Open Profile" hitSlop={6} />
        </View>

        <ResourceCluster style={styles.resources}>
          <ResourcePill tone="hud" resource="coins" value={user?.coins ?? "—"} style={styles.resourcePill} />
          <ResourcePill tone="hud" resource="worldPoints" value={goals?.player.worldPoints ?? "—"} style={styles.resourcePill} />
        </ResourceCluster>
      </HomeScene>
      <View style={styles.progress}>
        <View style={styles.levelBadge}><UiText variant="label" style={[styles.onDark, styles.levelText]}>Lv. {user?.level ?? "—"}</UiText></View>
        <View style={styles.xpCopy}>
          <View style={styles.progressHeading}>
            <UiText variant="caption" style={[styles.onDark, styles.progressText]}>{user?.username ?? "Your character"}</UiText>
            <UiText variant="caption" style={[styles.onDark, styles.progressText]}>{user?.xpIntoLevel ?? "—"} / {user?.xpForNextLevel ?? "—"} XP</UiText>
          </View>
          <XPBar tone="parchment" progress={(user?.progressPercent ?? 0) / 100} style={styles.xpBar} />
        </View>
      </View>
    </View>
    {[progressError, avatarError].filter(Boolean).map(error => <GameNotice key={error} title="Home status" message={error} variant="error" />)}
    {(progressError || avatarError || taskError || questError) && <SecondaryButton title="Refresh Home" onPress={props.onRetry} />}

    <SurfaceCard framed style={styles.today}>
      <SectionHeader title="Today" trailing={tasks ? <UiText variant="caption" style={styles.secondary}>{formatDate(tasks.time.date, { timeZone: tasks.time.timeZone })}</UiText> : undefined} />
      {tasks && <UiText variant="caption" style={styles.secondary}>{tasks.summary.dueToday} due · {tasks.summary.completedToday} completed</UiText>}
      {!!taskError && <GameNotice title="Tasks unavailable" message={taskError} variant="error" />}
      {props.tasksLoading && !tasks && <SurfaceCard><UiText accessibilityLiveRegion="polite">Loading your tasks…</UiText></SurfaceCard>}
      {!props.tasksLoading && !tasks && !taskError && <UiText style={styles.secondary}>Task preview unavailable. Open Tasks to view your schedule.</UiText>}
      {today.slice(0, 3).map(task => <ListRowCard key={task.taskId} title={task.title} style={styles.taskRow}
        detail={[task.completedToday ? "Completed" : "Due today", task.dueTime ? formatTime(task.dueTime) : null, `+${task.xpReward} XP`, `+${task.coinReward} coins`].filter(Boolean).join(" · ")}
        leading={<MaterialCommunityIcons name={task.completedToday ? "checkbox-marked" : "checkbox-blank-outline"}
          size={20} color={ui.colors.primary} accessible={false} aria-hidden />}
        trailing={<MaterialCommunityIcons name="chevron-right" size={20} color={ui.colors.secondaryText} accessible={false} aria-hidden />}
        onPress={props.onTasks} />)}
      {tasks && today.length === 0 && <SurfaceCard><EmptyState title="Nothing due right now"
        description={tasks.summary.completedToday > 0 ? "Your completed tasks are saved. Open Tasks to see your full schedule." : "Your schedule is clear for today. Open Tasks to plan your next step."} /></SurfaceCard>}
      <SecondaryButton title="View all tasks" onPress={props.onTasks} />
    </SurfaceCard>

    {loading && !goals && <SurfaceCard><UiText accessibilityLiveRegion="polite">Loading your progress…</UiText></SurfaceCard>}
    {questError && <GameNotice title="Quest status" variant="error"
      message={goals ? "Could not refresh quests. Showing last confirmed progress; retrying shortly." : "Could not load quests. Retrying shortly."} />}
    {goals ? <QuestProgress goals={goals} tone="parchment" /> : !loading && !questError
      ? <UiText style={styles.secondary}>Quest status is unavailable.</UiText> : null}

    <SurfaceCard compact framed style={styles.section}>
      <SectionHeader title="Achievements" trailing={<BadgePill label={achievements ? `${achievements.summary.earned}/${achievements.summary.total}` : "—"}
        style={styles.achievementCount} textStyle={styles.achievementCountText} />} />
      {(achievements?.achievements ?? []).slice(0, 3).map(achievement => <View key={achievement.achievementId} style={styles.achievement}>
        <View style={styles.achievementHeading}>
          <MaterialCommunityIcons name={achievement.earned ? "trophy-outline" : "lock-outline"}
            color={achievement.earned ? ui.colors.coin : ui.colors.locked} size={20} accessible={false} aria-hidden />
          <UiText variant="section" style={styles.achievementTitle}>{achievement.name}</UiText>
          <BadgePill label={achievement.earned ? "✓ Earned" : "Locked"} tone={achievement.earned ? "success" : "neutral"}
            style={[styles.achievementStatus, achievement.earned && styles.achievementEarned]} textStyle={styles.statusText} />
        </View>
        <UiText variant="caption" style={styles.secondary}>{achievement.description}</UiText>
        <View style={styles.achievementFooter}>
          <View style={styles.achievementProgress}>
            <UiText variant="caption" style={styles.achievementValue}>{achievement.currentValue}/{achievement.requiredValue}</UiText>
            <XPBar tone="parchment" label={`${achievement.name} progress`} progress={achievement.progressPercent / 100} style={styles.achievementBar} />
          </View>
          {(achievement.rewards ?? []).length ? <UiText variant="caption" style={styles.achievementReward}>
            <UiText style={styles.rewardLabel}>Rewards: </UiText>{(achievement.rewards ?? []).map(reward => reward.name).join(", ")}
          </UiText> : null}
        </View>
      </View>)}
      {!achievements && <UiText variant="caption" style={styles.secondary}>{(props.achievementsLoading ?? loading) ? "Loading achievements…" : "Achievements unavailable. Refresh Home to try again."}</UiText>}
      {achievements?.achievements.length === 0 && <UiText variant="caption" style={styles.secondary}>No achievements to display yet.</UiText>}
    </SurfaceCard>
    {props.ad}
  </ScreenShell>;
}

const styles = StyleSheet.create({
  content: { paddingTop: 0 },
  sceneHeader: { zIndex: 3, paddingHorizontal: 20, paddingBottom: ui.spacing.sm, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: ui.spacing.sm },
  sceneLight: { position: "absolute", top: 0, left: 0, width: "100%" },
  sceneText: { textShadowColor: "rgba(64,43,23,0.18)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 1 },
  wordmark: { fontSize: 32, lineHeight: 36, letterSpacing: 0.4, color: ui.colors.primaryPressed },
  sceneSubtitle: { color: ui.colors.text, fontWeight: "500" },
  titleCopy: { flex: 1, gap: 2 },
  secondary: { color: ui.colors.secondaryText },
  hero: { marginHorizontal: -ui.spacing.md, backgroundColor: ui.colors.sky, overflow: "hidden" },
  background: { position: "absolute", top: 0, left: 0, width: "100%", height: "112%" },
  resources: { position: "absolute", right: 20, bottom: 70, zIndex: 2, flexDirection: "column", maxWidth: "45%", gap: ui.spacing.xs },
  resourcePill: { minHeight: 26, paddingHorizontal: 10, paddingVertical: 2, gap: 3 },
  scene: { minHeight: 360, overflow: "hidden" },
  characterStage: { minHeight: 279, flexGrow: 1, alignItems: "center", justifyContent: "center" },
  character: { position: "absolute", top: 0, left: 0, right: 0, alignItems: "center", paddingRight: 100 },
  characterInner: { width: 320, transform: [{ scale: 1.4 }], transformOrigin: "top center" },
  sceneNotice: { position: "absolute", left: 12, bottom: 54, maxWidth: "55%", padding: ui.spacing.xs, backgroundColor: ui.colors.surface, color: ui.colors.secondaryText },
  progress: { position: "absolute", bottom: 8, left: 12, right: 12, zIndex: 2, flexDirection: "row", alignItems: "center", paddingHorizontal: ui.spacing.sm, paddingVertical: 6, gap: ui.spacing.sm, borderRadius: 6, backgroundColor: "rgba(25,39,31,0.86)" },
  progressHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: ui.spacing.xs, marginBottom: 2 },
  progressText: { fontSize: 12, lineHeight: 16 },
  levelBadge: { paddingHorizontal: 7, paddingVertical: 3, borderWidth: 1, borderColor: ui.colors.gold, borderRadius: ui.radius.md, backgroundColor: ui.colors.primary },
  levelText: { fontSize: 13, lineHeight: 18 },
  xpBar: { height: 5 },
  onDark: { color: ui.colors.onPrimary },
  xpCopy: { flex: 1, minWidth: 0 },
  navBlend: { position: "absolute", bottom: 0, left: 0, width: "100%", height: 14 },
  today: { gap: 3, padding: 10, backgroundColor: "transparent", shadowColor: "#634A30", shadowOpacity: 0.12, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  taskRow: { minHeight: 48, paddingVertical: 4, paddingHorizontal: 6, gap: 6 },
  section: { gap: ui.spacing.xs, marginTop: -ui.spacing.sm, padding: ui.spacing.sm + ui.spacing.xs, shadowOpacity: 0.04, shadowRadius: 2 },
  achievement: { gap: ui.spacing.xs, paddingTop: ui.spacing.xs, borderTopWidth: 1, borderTopColor: ui.colors.divider },
  achievementHeading: { flexDirection: "row", alignItems: "center", gap: ui.spacing.sm },
  achievementTitle: { flex: 1, fontSize: 18, lineHeight: 24 },
  achievementCount: { minHeight: 22, paddingVertical: 1, alignSelf: "center", borderWidth: 1, borderColor: ui.colors.gold, backgroundColor: ui.colors.paperInset },
  achievementCountText: { fontSize: 12, lineHeight: 16, color: ui.colors.coin, fontVariant: ["tabular-nums"] },
  achievementStatus: { minHeight: 22, paddingVertical: 1, borderWidth: 1, borderColor: ui.colors.border, backgroundColor: ui.colors.paperInset },
  achievementEarned: { borderColor: "rgba(49,92,64,0.18)", backgroundColor: "rgba(228,236,222,0.65)" },
  statusText: { fontSize: 12, lineHeight: 16 },
  achievementFooter: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: ui.spacing.sm },
  achievementProgress: { flexDirection: "row", alignItems: "center", gap: ui.spacing.sm, flexGrow: 1, flexBasis: 120 },
  achievementValue: { color: ui.colors.primary, fontWeight: "600", fontVariant: ["tabular-nums"] },
  achievementBar: { flex: 1, height: 9, borderColor: ui.colors.controlBorder },
  achievementReward: { color: ui.colors.primary, fontWeight: "600", maxWidth: "100%" },
  rewardLabel: { fontSize: 12, lineHeight: 17, color: ui.colors.secondaryText, fontWeight: "400" },
});
