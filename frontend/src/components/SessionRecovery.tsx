import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useAuth } from "../context/AuthContext";
import { colors, radius, spacing } from "../theme/theme";

export default function SessionRecovery({ fullScreen = false }: { fullScreen?: boolean }) {
  const { sessionError, retrySession } = useAuth();
  const [retrying, setRetrying] = useState(false);

  async function retry() {
    if (retrying) return;
    setRetrying(true);
    try { await retrySession(); } finally { setRetrying(false); }
  }

  return (
    <View style={[styles.container, fullScreen && styles.fullScreen]}>
      <View style={styles.notice}>
        {fullScreen && <Text accessibilityRole="header" style={styles.title}>Unable to load your account</Text>}
        <Text accessibilityRole="alert" style={styles.message}>{sessionError}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Retry account connection"
          accessibilityState={{ disabled: retrying, busy: retrying }}
          disabled={retrying}
          onPress={retry}
          style={styles.button}
        >
          {retrying && <ActivityIndicator size="small" color={colors.text} />}
          <Text style={styles.buttonText}>{retrying ? "Reconnecting…" : "Try again"}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.md, backgroundColor: colors.background },
  fullScreen: { flex: 1, alignItems: "center", justifyContent: "center" },
  notice: { width: "100%", maxWidth: 600, alignSelf: "center", gap: spacing.sm, padding: spacing.md, backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  title: { color: colors.text, fontSize: 22, fontWeight: "700" },
  message: { color: colors.mutedText, fontSize: 15, lineHeight: 22 },
  button: { minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, padding: spacing.sm, backgroundColor: colors.primaryDark, borderRadius: radius.md },
  buttonText: { color: colors.text, fontSize: 15, fontWeight: "600" },
});
