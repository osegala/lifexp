import { ActivityIndicator, View, useWindowDimensions } from "react-native";
import { Redirect, Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { tabAppearance, TabIcon } from "../../src/navigation/tabAppearance";
import { uiTheme as ui } from "../../src/theme/theme";
import { useAuth } from "../../src/context/AuthContext";
import { CompletionFeedbackProvider } from "../../src/context/CompletionFeedbackContext";
import { AdProvider } from "../../src/ads/Ads";

export default function TabLayout() {
  const { token, user, loading } = useAuth();
  const { bottom } = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: ui.colors.background,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ActivityIndicator size="large" color={ui.colors.primary} accessibilityLabel="Loading your account" />
      </View>
    );
  }

  if (!token) {
    return <Redirect href="/login" />;
  }

  return (
    <CompletionFeedbackProvider key={String(user?.id ?? "loading")}>
    <AdProvider>
    <Tabs
      screenOptions={{
        headerShown: false,
        ...tabAppearance(bottom, fontScale),
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: "Home",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon tab="dashboard" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="tasks"
        options={{
          title: "Tasks",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon tab="tasks" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="base"
        options={{
          title: "Base",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon tab="base" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="avatar"
        options={{
          title: "Avatar",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon tab="avatar" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="shop"
        options={{
          title: "Shop",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon tab="shop" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="social"
        options={{
          title: "Social",
          href: null,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          href: null,
        }}
      />
    </Tabs>
    </AdProvider>
    </CompletionFeedbackProvider>
  );
}
