import { useEffect, useSyncExternalStore } from "react";
import { Platform, Text, StyleSheet, View } from "react-native";
import { clearGameNotices, dismissGameNotice, getGameNotices, subscribeGameNotices } from "../feedback/notices";
import GameNotice, { GameNoticeOverlay } from "./ui/GameNotice";

/** Mounted once per account; it never writes profile, reward or billing state. */
export default function GameNoticeHost({ scope, placement = "upper" }: { scope: string; placement?: "upper" | "lower" }) {
  const state = useSyncExternalStore(subscribeGameNotices, getGameNotices, getGameNotices);
  const current = state.blockers.length ? undefined : state.pending[0];
  useEffect(() => () => clearGameNotices(), [scope]);
  useEffect(() => {
    if (!current) return;
    const timer = setTimeout(() => dismissGameNotice(current.id), current.duration);
    return () => clearTimeout(timer);
  }, [current]);
  return <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
    {Platform.OS === "web" && <>
      <Text role="status" aria-live="polite" aria-atomic style={styles.announcement}>
        {current && current.variant !== "error" ? `${current.title}. ${current.message ?? ""}` : ""}
      </Text>
      <Text role="alert" aria-live="assertive" aria-atomic style={styles.announcement}>
        {current?.variant === "error" ? `${current.title}. ${current.message ?? ""}` : ""}
      </Text>
    </>}
    {current && <GameNoticeOverlay placement={placement}><GameNotice key={current.id} title={current.title} message={current.message}
      variant={current.variant} duration={current.duration} announce={Platform.OS !== "web"}
      onDismiss={() => dismissGameNotice(current.id)} /></GameNoticeOverlay>}
  </View>;
}
const styles = StyleSheet.create({ announcement: { position: "absolute", width: 1, height: 1, overflow: "hidden", opacity: 0 } });
