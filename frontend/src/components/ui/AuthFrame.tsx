import type { ReactNode } from "react";
import { Image, StyleSheet, View } from "react-native";
import { uiTheme as ui } from "../../theme/theme";
import { ScreenShell, SurfaceCard, UiText } from "./Primitives";

export default function AuthFrame({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return <ScreenShell keyboardSafe contentContainerStyle={styles.content}>
    <View style={styles.brand}>
      <Image source={require("../../../assets/images/evrenthia-wordmark.png")} style={styles.art} resizeMode="contain" accessible accessibilityLabel="Evrenthia" />
      <UiText variant="caption" style={styles.secondary}>A more intentional you.</UiText>
    </View>
    <SurfaceCard framed style={styles.form}>
      <View style={styles.heading}>
        <UiText variant="section" accessibilityRole="header" aria-level={1}>{title}</UiText>
        <UiText variant="caption" style={styles.secondary}>{subtitle}</UiText>
      </View>
      {children}
    </SurfaceCard>
  </ScreenShell>;
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, justifyContent: "center", maxWidth: 480, gap: ui.spacing.md },
  brand: { width: "100%", alignItems: "center", gap: ui.spacing.xs, marginTop: -ui.spacing.xs },
  art: { width: "100%", maxWidth: 320, height: 168 },
  secondary: { color: ui.colors.secondaryText },
  heading: { gap: ui.spacing.xs, paddingBottom: ui.spacing.md, borderBottomWidth: 1, borderBottomColor: ui.colors.divider },
  form: { gap: ui.spacing.sm },
});
