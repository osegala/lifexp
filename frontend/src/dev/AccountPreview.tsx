import type { PropsWithChildren } from "react";
import { Platform } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ExpoRoot, Stack, router } from "expo-router";
import type { RequireContext } from "expo-router/build/types";
import LoginScreen from "../../app/login";
import RegisterScreen from "../../app/register";
import ProfileScreen from "../../app/(tabs)/profile";
import PremiumScreen from "../../app/premium";
import OnboardingScreen from "../../app/onboarding";
import { AuthProvider } from "../context/AuthContext";
import { api } from "../api/client";
import { cognitoAuth } from "../auth/cognito";
import { DEFAULT_APPEARANCE } from "../avatar/appearance";
import { FREE_ENTITLEMENTS } from "../entitlements/model";
import { FilterChip, ScreenShell, UiText } from "../components/ui/Primitives";

// Separate DEV/web entry. Real account screens, in-memory responses, no real Cognito or HTTP calls.
const views = ["login", "register", "profile", "premium", "onboarding"];
const profile = { ...DEFAULT_APPEARANCE, displayName: "Rowan", onboardingCompleted: false, timeZone: "America/New_York",
  xp: 1740, level: 6, xpIntoLevel: 140, xpForNextLevel: 360, xpToNextLevel: 220, coins: 284, worldPoints: 112 };
const preferences = { notificationsEnabled: false, taskRemindersEnabled: false, dailyReminderEnabled: false, dailyReminderTime: "09:00",
  dailyQuestReminderEnabled: false, dailyQuestReminderTime: "18:00", streakReminderEnabled: false, streakReminderTime: "20:00",
  quietHoursEnabled: false, quietHoursStart: "22:00", quietHoursEnd: "07:00" };
if (__DEV__ && Platform.OS === "web") {
  const identity = { token: "local-fixture-only", userId: "account-ui-review", email: "rowan@example.test" };
  cognitoAuth.getSession = async () => identity;
  cognitoAuth.signIn = async () => identity;
  cognitoAuth.signUp = async () => "CONFIRM_SIGN_UP";
  cognitoAuth.confirmSignUp = async () => {};
  cognitoAuth.signOut = async () => {};
  api.defaults.adapter = async config => {
    let data;
    if (config.method === "get" && config.url === "/me") data = profile;
    else if (config.method === "get" && config.url === "/entitlements") data = FREE_ENTITLEMENTS;
    else if (config.method === "get" && config.url === "/preferences") data = preferences;
    else if (config.method === "get" && config.url === "/tasks") data = { tasks: [], time: { date: "2026-10-20", weekday: "Tuesday", timeZone: profile.timeZone }, summary: { total: 0, active: 0, scheduledToday: 0, dueToday: 0, completedToday: 0 } };
    else if (config.method === "patch" && config.url === "/me") data = Object.assign(profile, JSON.parse(config.data));
    else if (config.method === "patch" && config.url === "/preferences") data = Object.assign(preferences, JSON.parse(config.data));
    else throw new Error("This action is disabled in the isolated account review.");
    return { data: structuredClone(data), status: 200, statusText: "OK", headers: {}, config };
  };
}
function ReviewIndex() {
  return <ScreenShell><UiText variant="display">Account UI review</UiText>
    <UiText>Local fixtures only. Changes are discarded on reload.</UiText>
    {views.map(view => <FilterChip key={view} label={view} onPress={() => router.replace(`/${view}` as "/login")} />)}
  </ScreenShell>;
}
function Layout() { return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "transparent" } }} />; }
function Providers({ children }: PropsWithChildren) { return <SafeAreaProvider><AuthProvider>{children}</AuthProvider></SafeAreaProvider>; }
const routes: Record<string, { default: React.ComponentType }> = {
  "./_layout.tsx": { default: Layout }, "./index.tsx": { default: ReviewIndex },
  "./login.tsx": { default: LoginScreen }, "./register.tsx": { default: RegisterScreen },
  "./profile.tsx": { default: ProfileScreen }, "./premium.tsx": { default: PremiumScreen }, "./onboarding.tsx": { default: OnboardingScreen },
  "./(tabs)/dashboard.tsx": { default: ReviewIndex }, "./(tabs)/profile.tsx": { default: ProfileScreen },
};
const context = Object.assign((id: string) => routes[id], { keys: () => Object.keys(routes), resolve: (id: string) => id, id: "account-review" }) as RequireContext;
export default function AccountPreview() {
  if (!__DEV__ || Platform.OS !== "web") return null;
  const view = new URL(window.location.href).searchParams.get("view") ?? window.location.pathname.split("/").at(-1) ?? "login";
  return <ExpoRoot context={context} location={`/${views.includes(view) ? view : "login"}`} wrapper={Providers} />;
}
