import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useState, type ReactNode } from "react";
import { Image, StyleSheet, View, type ImageSourcePropType } from "react-native";
import { getEquippedSceneSource } from "../avatar/assetRegistry";
import type { HomeAvatar } from "../home/avatar";
import { tasksForView } from "../tasks/scheduling";
import { uiTheme as ui } from "../theme/theme";
import type { AchievementsResponse, GoalsResponse, TasksResponse, User } from "../types";
import AvatarRenderer from "./AvatarRenderer";
import LifeButton from "./LifeButton";
import QuestProgress from "./QuestProgress";
import XPBar from "./XPBar";
import { BadgePill, ResourceCluster, ResourcePill } from "./ui/Indicators";
import { EmptyState, ListRowCard, ScreenShell, SectionHeader, SurfaceCard, UiPressable, UiText } from "./ui/Primitives";

type Props = {
  user: User | null;
  goals: GoalsResponse | null;
  achievements: AchievementsResponse | null;
  tasks: TasksResponse | null;
  scene: HomeAvatar | null;
  loading: boolean;
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

function HomeScene({ scene, loading, error }: { scene: HomeAvatar | null; loading: boolean; error: string }) {
  const [failedSource, setFailedSource] = useState<ImageSourcePropType | null>(null);
  const avatar = scene?.avatar;
  const background = getEquippedSceneSource(scene?.cosmetics, avatar?.equippedBackgroundId, "BACKGROUND");
  const unavailable = !!avatar?.equippedBackgroundId && (!background || background === failedSource);
  return <View style={styles.scene}>
    {background && !unavailable && <Image source={background} style={StyleSheet.absoluteFill}
      resizeMode="cover" accessible={false} aria-hidden onError={() => setFailedSource(background)} />}
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
    {unavailable && !error && <UiText variant="caption" style={styles.sceneNotice}>Equipped background unavailable.</UiText>}
  </View>;
}

/** Presentation only. Mutations, rewards, routing and ad eligibility stay with their existing owners. */
export default function HomeContent(props: Props) {
  const { user, goals, achievements, tasks, scene, loading, questError, progressError, taskError, avatarError } = props;
  const today = tasksForView(tasks?.tasks ?? [], "Today", tasks?.time.date ?? "");
  return <ScreenShell>
    <View style={styles.header}>
      <View style={styles.titleCopy}>
        <UiText variant="display" accessibilityRole="header" aria-level={1}>Evrenthia</UiText>
        <UiText variant="caption" style={styles.secondary}>A more intentional you.</UiText>
      </View>
      <UiPressable onPress={props.onProfile} accessibilityRole="button" accessibilityLabel="Open Profile" style={styles.profile}>
        <MaterialCommunityIcons name="account-cog-outline" color={ui.colors.primary} size={ui.size.icon} accessible={false} aria-hidden />
        <UiText variant="caption">Profile</UiText>
      </UiPressable>
    </View>

    <View style={styles.hero}>
      <ResourceCluster style={styles.resources}>
        <ResourcePill resource="coins" value={user?.coins ?? "—"} />
        <ResourcePill resource="worldPoints" value={goals?.player.worldPoints ?? "—"} />
      </ResourceCluster>
      <HomeScene scene={scene} loading={props.avatarLoading} error={avatarError} />
      <View style={styles.progress}>
        <View style={styles.progressHeading}>
          <UiText variant="label" style={styles.name}>{user?.username ?? "Your character"}</UiText>
          <BadgePill label={`Level ${user?.level ?? "—"}`} />
        </View>
        <XPBar tone="parchment" progress={(user?.progressPercent ?? 0) / 100} />
        <UiText variant="caption" style={styles.secondary}>{user?.xpIntoLevel ?? "—"} / {user?.xpForNextLevel ?? "—"} XP</UiText>
      </View>
    </View>
    {[progressError, avatarError].filter(Boolean).map(error => <UiText key={error} accessibilityRole="alert" style={styles.error}>{error}</UiText>)}
    {(progressError || avatarError || taskError || questError) && <LifeButton tone="parchment" variant="secondary" title="Refresh Home" onPress={props.onRetry} />}

    <View style={styles.section}>
      <SectionHeader title="Today" subtitle={tasks ? `${tasks.time.weekday}, ${tasks.time.date} · ${tasks.time.timeZone}` : undefined} />
      {tasks && <UiText variant="caption" style={styles.secondary}>{tasks.summary.dueToday} due · {tasks.summary.completedToday} completed</UiText>}
      {!!taskError && <UiText accessibilityRole="alert" style={styles.error}>{taskError}</UiText>}
      {props.tasksLoading && !tasks && <SurfaceCard><UiText accessibilityLiveRegion="polite">Loading your tasks…</UiText></SurfaceCard>}
      {!props.tasksLoading && !tasks && !taskError && <UiText style={styles.secondary}>Task preview unavailable. Open Tasks to view your schedule.</UiText>}
      {today.slice(0, 3).map(task => <ListRowCard key={task.taskId} title={task.title}
        detail={[task.completedToday ? "Completed" : "Due today", task.dueTime, `+${task.xpReward} XP`, `+${task.coinReward} coins`].filter(Boolean).join(" · ")}
        leading={<MaterialCommunityIcons name={task.completedToday ? "check-circle" : "checkbox-blank-circle-outline"}
          size={ui.size.icon} color={ui.colors.primary} accessible={false} aria-hidden />}
        trailing={<MaterialCommunityIcons name="chevron-right" size={ui.size.icon} color={ui.colors.secondaryText} accessible={false} aria-hidden />}
        onPress={props.onTasks} />)}
      {tasks && today.length === 0 && <SurfaceCard><EmptyState title="Nothing due right now"
        description={tasks.summary.completedToday > 0 ? "Your completed tasks are saved. Open Tasks to see your full schedule." : "Your schedule is clear for today. Open Tasks to plan your next step."} /></SurfaceCard>}
      <LifeButton tone="parchment" variant="secondary" title="View all tasks" onPress={props.onTasks} />
    </View>

    {loading && !goals && <SurfaceCard><UiText accessibilityLiveRegion="polite">Loading your progress…</UiText></SurfaceCard>}
    {questError && <UiText accessibilityRole="alert" style={styles.error}>
      {goals ? "Could not refresh quests. Showing last confirmed progress; retrying shortly." : "Could not load quests. Retrying shortly."}
    </UiText>}
    {goals ? <QuestProgress goals={goals} tone="parchment" /> : !loading && !questError
      ? <UiText style={styles.secondary}>Quest status is unavailable.</UiText> : null}
    <UiText variant="caption" style={styles.secondary}>Quest rewards are granted automatically when tasks are completed.</UiText>

    <SurfaceCard style={styles.section}>
      <SectionHeader title="Achievements" trailing={<BadgePill label={achievements ? `${achievements.summary.earned}/${achievements.summary.total}` : "—"} />} />
      {(achievements?.achievements ?? []).slice(0, 3).map(achievement => <View key={achievement.achievementId} style={styles.achievement}>
        <MaterialCommunityIcons name={achievement.earned ? "trophy-outline" : "lock-outline"}
          color={achievement.earned ? ui.colors.coin : ui.colors.locked} size={ui.size.icon} accessible={false} aria-hidden />
        <View style={styles.achievementCopy}>
          <UiText variant="label">{achievement.name}</UiText>
          <UiText variant="caption" style={styles.secondary}>{achievement.earned ? "Earned" : "Locked"} · {achievement.currentValue}/{achievement.requiredValue} · {achievement.description}</UiText>
          {(achievement.rewards ?? []).length ? <UiText variant="caption" style={styles.secondary}>
            Rewards: {(achievement.rewards ?? []).map(reward => reward.name).join(", ")}
          </UiText> : null}
        </View>
      </View>)}
      {!achievements && <UiText variant="caption" style={styles.secondary}>{loading ? "Loading achievements…" : "Achievements unavailable. Refresh Home to try again."}</UiText>}
      {achievements?.achievements.length === 0 && <UiText variant="caption" style={styles.secondary}>No achievements to display yet.</UiText>}
    </SurfaceCard>
    {props.ad}
  </ScreenShell>;
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: ui.spacing.sm },
  titleCopy: { flex: 1, gap: ui.spacing.xs },
  profile: { alignItems: "center", gap: ui.spacing.xs, padding: ui.spacing.sm, borderWidth: 1, borderColor: ui.colors.controlBorder, borderRadius: ui.radius.md, backgroundColor: ui.colors.surface },
  secondary: { color: ui.colors.secondaryText },
  error: { color: ui.colors.danger },
  hero: { borderRadius: ui.radius.lg, backgroundColor: ui.colors.stone, borderWidth: 1, borderColor: ui.colors.border, overflow: "hidden" },
  resources: { padding: ui.spacing.sm, backgroundColor: ui.colors.surface },
  scene: { minHeight: 320, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  character: { width: "100%", alignItems: "center" },
  characterInner: { width: 320, maxWidth: "100%" },
  sceneNotice: { position: "absolute", bottom: ui.spacing.sm, padding: ui.spacing.xs, backgroundColor: ui.colors.surface, color: ui.colors.secondaryText },
  progress: { padding: ui.spacing.md, gap: ui.spacing.sm, backgroundColor: ui.colors.surface, borderTopWidth: 1, borderTopColor: ui.colors.border },
  progressHeading: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: ui.spacing.sm },
  name: { flexGrow: 1 },
  section: { gap: ui.spacing.md },
  achievement: { flexDirection: "row", alignItems: "flex-start", gap: ui.spacing.sm, paddingTop: ui.spacing.sm, borderTopWidth: 1, borderTopColor: ui.colors.divider },
  achievementCopy: { flex: 1, gap: ui.spacing.xs },
});
