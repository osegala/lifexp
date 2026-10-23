import GameNoticeHost from "../src/components/GameNoticeHost";
import { Stack, usePathname } from "expo-router";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { AuthProvider, useAuth } from "../src/context/AuthContext";
import SessionRecovery from "../src/components/SessionRecovery";
import { uiTheme as ui } from "../src/theme/theme";
import { authDestination } from "../src/auth/destination";

export default function RootLayout() {
  const pathname = usePathname();
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <View style={styles.foundation}>
          <StatusBar style={pathname === "/base" ? "light" : "dark"} />
          <AuthProvider>
            <SessionNavigator pathname={pathname} />
          </AuthProvider>
        </View>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function SessionNavigator({ pathname }: { pathname: string }) {
  const { token, user, loading, sessionError } = useAuth();

  if (loading) {
    return <View style={styles.loading}><ActivityIndicator size="large" color={ui.colors.primary} /></View>;
  }
  if (sessionError && !user) return <SessionRecovery fullScreen />;
  const destination = authDestination(token, user);

  return (
    <View style={styles.root}>
      {token && sessionError ? <SessionRecovery /> : null}
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "transparent" } }}>
        <Stack.Screen name="index" />
        <Stack.Protected guard={destination === "/onboarding"}>
          <Stack.Screen name="onboarding" />
        </Stack.Protected>
        <Stack.Protected guard={destination === "/(tabs)/dashboard"}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="base-interior" />
          <Stack.Screen name="social-base" />
          <Stack.Screen name="modal" />
          <Stack.Screen name="premium" />
        </Stack.Protected>
        <Stack.Protected guard={!token}>
          <Stack.Screen name="login" />
          <Stack.Screen name="register" />
        </Stack.Protected>
      </Stack>
      <GameNoticeHost scope={String(user?.id ?? "signed-out")} placement={pathname === "/tasks" ? "lower" : "upper"} />
    </View>
  );
}

const styles = StyleSheet.create({
  foundation: { flex: 1, backgroundColor: ui.colors.ivory },
  root: {
    flex: 1,
  },
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
