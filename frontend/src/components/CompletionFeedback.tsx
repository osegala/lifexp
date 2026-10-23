import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { api } from "../api/client";
import { apiRoutes } from "../api/routes";
import { completionAnnouncement, completionFrame, questCompletionMessages } from "../feedback/completion";
import type { CompletionEvent } from "../feedback/completion";
import type { AchievementsResponse } from "../types";
import { setGameFeedbackActive } from "../feedback/notices";
import GameNotice, { GameNoticeOverlay } from "./ui/GameNotice";
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
  const questMessages = questCompletionMessages(event.response);

  useEffect(() => {
    let active = true;
    setGameFeedbackActive("completion", true);
    void AccessibilityInfo.isReduceMotionEnabled().then(value => { if (active) setReducedMotion(value); })
      .catch(() => { if (active) setReducedMotion(true); });
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReducedMotion);
    if (Platform.OS !== "web") AccessibilityInfo.announceForAccessibility(announcement);
    return () => { active = false; subscription.remove(); setGameFeedbackActive("completion", false); };
  }, [announcement]);

  useEffect(() => {
    if (reducedMotion === null) return;
    progress.setValue(0);
    setFrame(completionFrame(event, reducedMotion ? 1 : 0));
    const listener = progress.addListener(({ value }) => setFrame(completionFrame(event, value)));
    const animation = Animated.timing(progress, { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.quad), useNativeDriver: false });
    if (!reducedMotion) animation.start();
    const timer = setTimeout(() => onDone(event.id), questMessages.length ? 5500 : 2800);
    return () => { clearTimeout(timer); animation.stop(); progress.removeListener(listener); progress.setValue(0); };
  }, [event, onDone, progress, reducedMotion, questMessages.length]);

  useEffect(() => {
    if (!newAchievements.length) return;
    let active = true;
    void api.get<AchievementsResponse>(apiRoutes.achievements).then(({ data }) => {
      if (active) setRewardNames(Object.fromEntries(data.achievements.map(a => [a.achievementId, (a.rewards ?? []).map(r => r.name)])));
    }).catch(() => { /* The award itself is already confirmed; omit unknown shop details. */ });
    return () => { active = false; };
  }, [newAchievements]);

  return <GameNoticeOverlay placement="lower">
    <GameNotice title="Task Complete" message={task.title} variant="success" announce={false}
      duration={questMessages.length ? 5500 : 2800} dismissLabel="Dismiss completion feedback" onDismiss={() => onDone(event.id)}
      rewards={{ xp: rewards.xp, coins: rewards.coins, ...(rewards.worldPoints ? { worldPoints: rewards.worldPoints } : {}) }}>
      <View style={styles.progressRow}>
        <Text style={styles.caption}>{frame.leveledUp ? "Level Up! · " : ""}Level {frame.level}</Text>
        <View style={styles.bar}><XPBar tone="parchment" label="Level experience" progress={frame.progress} style={{ height: 5 }} /></View>
      </View>
      <Text style={styles.caption}>{frame.coins} coins total{typeof event.response.player.worldPoints === "number" ? ` · ${event.response.player.worldPoints} World Points total` : ""}</Text>
      {questMessages.map(message => <Text key={message} style={styles.achievementName}>{message}</Text>)}
      {!!newAchievements.length && <ScrollView style={styles.achievements}>
        {newAchievements.map(achievement => <View key={achievement.achievementId} style={styles.achievement}>
          <Text style={styles.achievementName}>✦ {achievement.name}</Text>
          <Text style={styles.caption}>{rewardNames[achievement.achievementId]?.length
            ? `Achievement requirement met: ${rewardNames[achievement.achievementId].join(", ")}. Check Shop to purchase; not automatically owned or equipped.`
            : "Achievement earned. Check Shop for related cosmetic requirements."}</Text>
        </View>)}
      </ScrollView>}
      <Text style={styles.caption}>After completion: {progression.xpIntoLevel} / {progression.xpForNextLevel} XP · Level {progression.level}</Text>
    </GameNotice>
  </GameNoticeOverlay>;
}

const styles = StyleSheet.create({
  progressRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  bar: { flex: 1 },
  caption: { color: "#E9DFC9", fontSize: 12, lineHeight: 17 },
  achievements: { maxHeight: 96 },
  achievement: { paddingVertical: 3 },
  achievementName: { color: "#F2D493", fontSize: 13, lineHeight: 19, fontWeight: "600" },
});
