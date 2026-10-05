import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { api } from "../api/client";
import { apiRoutes } from "../api/routes";
import { completionAnnouncement, completionFrame } from "../feedback/completion";
import type { CompletionEvent } from "../feedback/completion";
import type { AchievementsResponse } from "../types";
import { colors, radius, spacing } from "../theme/theme";
import CompletionScene from "./CompletionScene";
import XPBar from "./XPBar";

export default function CompletionFeedback({ event, onDone }: {
  event: CompletionEvent;
  onDone: (id: string) => void;
}) {
  const [reducedMotion, setReducedMotion] = useState<boolean | null>(null);
  const [frame, setFrame] = useState(() => completionFrame(event, 1));
  const [rewardNames, setRewardNames] = useState<Record<string, string[]>>({});
  const progress = useRef(new Animated.Value(0)).current;
  const announcement = completionAnnouncement(event);
  const { task, rewards, progression, newAchievements } = event.response;

  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(value => { if (active) setReducedMotion(value); })
      .catch(() => { if (active) setReducedMotion(true); });
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReducedMotion);
    if (Platform.OS !== "web") AccessibilityInfo.announceForAccessibility(announcement);
    return () => { active = false; subscription.remove(); };
  }, [announcement]);

  useEffect(() => {
    if (reducedMotion === null) return;
    progress.setValue(0);
    setFrame(completionFrame(event, reducedMotion ? 1 : 0));
    const listener = progress.addListener(({ value }) => setFrame(completionFrame(event, value)));
    const animation = Animated.timing(progress, { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.quad), useNativeDriver: false });
    if (!reducedMotion) animation.start();
    const timer = setTimeout(() => onDone(event.id), 2800);
    return () => { clearTimeout(timer); animation.stop(); progress.removeListener(listener); progress.setValue(0); };
  }, [event, onDone, progress, reducedMotion]);

  useEffect(() => {
    if (!newAchievements.length) return;
    let active = true;
    void api.get<AchievementsResponse>(apiRoutes.achievements).then(({ data }) => {
      if (active) setRewardNames(Object.fromEntries(data.achievements.map(a => [a.achievementId, (a.rewards ?? []).map(r => r.name)])));
    }).catch(() => { /* The award itself is already confirmed; omit unknown shop details. */ });
    return () => { active = false; };
  }, [newAchievements]);

  return (
    <View pointerEvents="box-none" style={styles.overlay}>
      <View style={styles.card}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>✓ TASK COMPLETE</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Dismiss completion feedback" onPress={() => onDone(event.id)} style={styles.dismiss}>
            <Text style={styles.dismissText}>×</Text>
          </Pressable>
        </View>
        <View style={styles.row}>
          <CompletionScene progress={progress} reducedMotion={reducedMotion !== false} />
          <View style={styles.copy}>
            <Text numberOfLines={2} style={styles.title}>{task.title}</Text>
            <Text style={styles.rewards}>+{rewards.xp} XP · +{rewards.coins} coins</Text>
            <Text style={styles.caption}>{frame.leveledUp ? "Level Up! · " : ""}Level {frame.level}</Text>
            <View accessibilityRole="progressbar" accessibilityLabel="Level experience" accessibilityValue={{ min: 0, max: 100, now: Math.round(frame.progress * 100) }}>
              <XPBar progress={frame.progress} />
            </View>
            <Text style={styles.caption}>{frame.coins} coins total{rewards.worldPoints ? ` · +${rewards.worldPoints} World Points` : ""}</Text>
          </View>
        </View>
        {!!newAchievements.length && <ScrollView style={styles.achievements}>
          {newAchievements.map(achievement => <View key={achievement.achievementId} style={styles.achievement}>
            <Text style={styles.achievementName}>✦ {achievement.name}</Text>
            <Text style={styles.caption}>{rewardNames[achievement.achievementId]?.length
              ? `Achievement requirement met: ${rewardNames[achievement.achievementId].join(", ")}. Check Shop to purchase; not automatically owned or equipped.`
              : "Achievement earned. Check Shop for related cosmetic requirements."}</Text>
          </View>)}
        </ScrollView>}
        <Text style={styles.worldNote}>A little brighter in Evrenthia</Text>
        <Text style={styles.xpTotal}>After completion: {progression.xpIntoLevel} / {progression.xpForNextLevel} XP · Level {progression.level}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { position: "absolute", top: spacing.sm, left: spacing.md, right: spacing.md, alignItems: "center", zIndex: 20 },
  card: { width: "100%", maxWidth: 460, padding: spacing.md, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.primary, backgroundColor: colors.card, gap: spacing.sm },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  eyebrow: { color: colors.accent, fontSize: 12, fontWeight: "800", letterSpacing: 1 },
  dismiss: { width: 44, height: 44, alignItems: "center", justifyContent: "center", margin: -spacing.sm },
  dismissText: { color: colors.mutedText, fontSize: 26 },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  copy: { flex: 1, minWidth: 0, gap: spacing.xs },
  title: { color: colors.text, fontWeight: "700", fontSize: 16 },
  rewards: { color: colors.text, fontWeight: "800", fontSize: 18 },
  caption: { color: colors.mutedText, fontSize: 12, lineHeight: 18 },
  achievements: { maxHeight: 96 },
  achievement: { paddingVertical: spacing.xs },
  achievementName: { color: colors.accent, fontWeight: "700" },
  worldNote: { color: colors.mutedText, fontSize: 11 },
  xpTotal: { color: colors.mutedText, fontSize: 11 },
});
