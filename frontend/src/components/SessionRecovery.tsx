import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useAuth } from "../context/AuthContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { uiTheme as ui } from "../theme/theme";

export default function SessionRecovery({ fullScreen = false }: { fullScreen?: boolean }) {
  const insets = useSafeAreaInsets();
  const { sessionError, retrySession } = useAuth();
  const [retrying, setRetrying] = useState(false);

  async function retry() {
    if (retrying) return;
    setRetrying(true);
    try { await retrySession(); } finally { setRetrying(false); }
  }

  return (
    <View style={[styles.container, fullScreen ? styles.fullScreen : { paddingTop: insets.top + ui.spacing.md }]}>
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
          {retrying && <ActivityIndicator size="small" color={ui.colors.onPrimary} />}
          <Text style={styles.buttonText}>{retrying ? "Reconnecting…" : "Try again"}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: ui.spacing.md },
  fullScreen: { flex: 1, alignItems: "center", justifyContent: "center" },
  notice: { width: "100%", maxWidth: 600, alignSelf: "center", gap: ui.spacing.sm, padding: ui.spacing.md, backgroundColor: ui.colors.surface, borderRadius: ui.radius.md, borderWidth: 1, borderColor: ui.colors.border },
  title: { ...ui.type.section, color: ui.colors.text },
  message: { ...ui.type.body, color: ui.colors.secondaryText },
  button: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: ui.spacing.sm, padding: ui.spacing.sm, backgroundColor: ui.colors.primary, borderRadius: ui.radius.md },
  buttonText: { ...ui.type.label, color: ui.colors.onPrimary },
});
