import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { AccessibilityInfo, Animated, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions, type StyleProp, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { NoticeRewards, NoticeVariant } from "../../feedback/notices";
import { uiTheme as ui } from "../../theme/theme";
import FantasyMaterial from "./FantasyMaterial";

const variants = {
  success: { icon: "check-circle-outline", color: "#E8C783", background: "#203D30", label: "Success" },
  info: { icon: "information-outline", color: "#C9DDE7", background: "#233A43", label: "Information" },
  error: { icon: "alert-circle-outline", color: "#F0C5AB", background: "#4B302A", label: "Error" },
  warning: { icon: "alert-outline", color: "#F1D18B", background: "#4A3C26", label: "Warning" },
} as const;

type Props = {
  title: string; message?: string; variant?: NoticeVariant;
  icon?: React.ComponentProps<typeof MaterialCommunityIcons>["name"];
  rewards?: NoticeRewards; children?: ReactNode; onDismiss?: () => void; dismissLabel?: string;
  duration?: number; announce?: boolean; style?: StyleProp<ViewStyle>;
};

/** One painted material for floating notices and existing inline status messages. */
export default function GameNotice({ title, message, variant = "info", icon, rewards, children, onDismiss,
  dismissLabel = "Dismiss notification", duration, announce = true, style }: Props) {
  const treatment = variants[variant];
  const opacity = useRef(new Animated.Value(duration ? 0 : 1)).current;
  const [reducedMotion, setReducedMotion] = useState<boolean | null>(null);
  const announcement = [treatment.label, title, message,
    rewards?.xp !== undefined ? `${rewards.xp} XP` : null,
    rewards?.coins !== undefined ? `${rewards.coins} coins` : null,
    rewards?.worldPoints !== undefined ? `${rewards.worldPoints} World Points` : null].filter(Boolean).join(". ");
  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(value => { if (active) setReducedMotion(value); })
      .catch(() => { if (active) setReducedMotion(true); });
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReducedMotion);
    return () => { active = false; subscription.remove(); };
  }, []);
  useEffect(() => {
    if (announce && Platform.OS !== "web") AccessibilityInfo.announceForAccessibility(announcement);
  }, [announce, announcement]);
  useEffect(() => {
    if (reducedMotion === null) return;
    opacity.setValue(duration && !reducedMotion ? 0 : 1);
    if (!duration || reducedMotion) return;
    const entrance = Animated.timing(opacity, { toValue: 1, duration: 160, useNativeDriver: Platform.OS !== "web" });
    entrance.start();
    let exit: Animated.CompositeAnimation | undefined;
    const timer = setTimeout(() => {
      exit = Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: Platform.OS !== "web" }); exit.start();
    }, Math.max(160, duration - 180));
    return () => { clearTimeout(timer); entrance.stop(); exit?.stop(); };
  }, [duration, opacity, reducedMotion]);
  return <Animated.View testID="game-notice" style={[styles.card, { backgroundColor: treatment.background },
    { opacity, transform: [{ translateY: opacity.interpolate({ inputRange: [0, 1], outputRange: [-6, 0] }) }] }, style]}>
    <FantasyMaterial kind="resource" opacity={0.2} />
    {Platform.OS === "web" && announce && <Text role={variant === "error" ? "alert" : "status"}
      aria-live={variant === "error" ? "assertive" : "polite"} aria-atomic style={styles.announcement}>{announcement}</Text>}
    <View style={styles.heading}>
      <MaterialCommunityIcons name={icon ?? treatment.icon} color={treatment.color} size={21} accessible={false} aria-hidden />
      <Text style={styles.title}>{title}</Text>
      {onDismiss && <Pressable accessibilityRole="button" accessibilityLabel={dismissLabel} onPress={onDismiss} style={styles.dismiss}>
        <MaterialCommunityIcons name="close" size={19} color="#E9DFC9" accessible={false} aria-hidden />
      </Pressable>}
    </View>
    {!!message && <Text style={styles.message}>{message}</Text>}
    {rewards && <View style={styles.rewards}>
      {([['xp', 'XP'], ['coins', 'coins'], ['worldPoints', 'World Points']] as const).map(([key, label]) =>
        rewards[key] !== undefined ? <Text key={key} style={styles.reward}>+{rewards[key]} {label}</Text> : null)}
    </View>}
    {children}
  </Animated.View>;
}

export function GameNoticeOverlay({ children, placement = "upper", style }: {
  children: ReactNode; placement?: "upper" | "lower"; style?: StyleProp<ViewStyle>;
}) {
  const insets = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  return <View pointerEvents="box-none" style={[styles.overlay, placement === "lower"
    ? { bottom: insets.bottom + ui.size.tabBar + Math.max(0, fontScale - 1) * ui.type.tab.lineHeight + 12 }
    : { top: insets.top + 72 }, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  overlay: { position: "absolute", left: 12, right: 12, alignItems: "center", zIndex: 2000 },
  card: { width: "100%", maxWidth: 420, paddingHorizontal: 14, paddingVertical: 10, gap: 5,
    borderWidth: 1, borderColor: "#B49A65", borderRadius: 12, shadowColor: "#101C16", shadowOpacity: 0.22,
    shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 5 },
  heading: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 26 },
  title: { ...ui.type.label, color: "#FBF2DF", flex: 1 },
  message: { ...ui.type.caption, color: "#F0E7D4", flexShrink: 1 },
  rewards: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  reward: { ...ui.type.label, fontSize: 14, lineHeight: 20, color: "#F2D493", fontVariant: ["tabular-nums"] },
  dismiss: { width: 44, height: 44, marginVertical: -9, marginRight: -9, alignItems: "center", justifyContent: "center" },
  announcement: { position: "absolute", width: 1, height: 1, overflow: "hidden", opacity: 0 },
});
