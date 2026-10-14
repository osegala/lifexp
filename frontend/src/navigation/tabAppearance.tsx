import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import type { BottomTabNavigationOptions } from "expo-router/js-tabs";
import type { ColorValue } from "react-native";
import { uiTheme as ui } from "../theme/theme";

export const tabIcons = {
  dashboard: ["home-variant-outline", "home-variant"],
  tasks: ["format-list-checks", "format-list-checks"],
  base: ["castle", "castle"],
  avatar: ["account-outline", "account"],
  shop: ["shopping-outline", "shopping"],
} as const;

export function TabIcon({ tab, focused, color }: { tab: keyof typeof tabIcons; focused: boolean; color: ColorValue }) {
  return <MaterialCommunityIcons name={tabIcons[tab][focused ? 1 : 0]} color={color} size={ui.size.tabIcon} accessible={false} aria-hidden />;
}

// Keep the stock tab bar: route events, links, long-press, focus and safe areas
// remain owned by React Navigation. Only presentation options change.
export function tabAppearance(bottomInset: number, fontScale: number) {
  return {
    tabBarLabelPosition: "below-icon",
    tabBarAllowFontScaling: true,
    tabBarActiveTintColor: ui.colors.navigationActive,
    tabBarInactiveTintColor: ui.colors.navigationText,
    tabBarActiveBackgroundColor: ui.colors.navigationSelected,
    tabBarLabelStyle: { ...ui.type.tab, flexShrink: 0 },
    tabBarItemStyle: { minHeight: ui.size.target, marginHorizontal: 2 },
    tabBarStyle: {
      backgroundColor: ui.colors.navigation,
      borderTopColor: ui.colors.navigationBorder,
      borderTopWidth: 1,
      height: ui.size.tabBar + bottomInset + Math.max(0, fontScale - 1) * ui.type.tab.lineHeight,
      paddingTop: ui.spacing.xs,
      paddingBottom: Math.max(bottomInset, ui.spacing.xs),
      paddingHorizontal: ui.spacing.xs,
      elevation: 0,
      shadowOpacity: 0,
    },
  } satisfies BottomTabNavigationOptions;
}
