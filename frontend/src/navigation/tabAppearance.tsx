import FantasyMaterial from "../components/ui/FantasyMaterial";
import { buttonHitArea } from "../components/ui/ButtonSurface";
import { useState } from "react";
import { isFocusVisible } from "../utils/focus";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import type { BottomTabNavigationOptions } from "expo-router/js-tabs";
import { PlatformPressable } from "expo-router/react-navigation";
import { Platform, StyleSheet, View, type ColorValue } from "react-native";
import { uiTheme as ui } from "../theme/theme";

type TabButtonProps = Parameters<NonNullable<BottomTabNavigationOptions["tabBarButton"]>>[0];

export const tabIcons = {
  dashboard: ["home-variant-outline", "home-variant"],
  tasks: ["format-list-checks", "format-list-checks"],
  base: ["castle", "castle"],
  avatar: ["account-outline", "account"],
  shop: ["shopping-outline", "shopping"],
} as const;

export function TabIcon({ tab, focused, color }: { tab: keyof typeof tabIcons; focused: boolean; color: ColorValue }) {
  return <View accessible={false} aria-hidden style={styles.icon}>
    <MaterialCommunityIcons name={tabIcons[tab][focused ? 1 : 0]} color={color} size={ui.size.tabIcon} accessible={false} aria-hidden />
  </View>;
}

function TabButton({ children, style, onFocus, onBlur, onPointerDown, ...props }: TabButtonProps) {
  const selected = props["aria-selected"] ?? props.accessibilityState?.selected;
  const [focused, setFocused] = useState(false);
  return <PlatformPressable {...props}
    onPointerDown={event => { setFocused(false); onPointerDown?.(event); }}
    onFocus={event => { setFocused(isFocusVisible(event)); onFocus?.(event); }}
    onBlur={event => { setFocused(false); onBlur?.(event); }}
    style={[style, styles.button, focused && Platform.OS === "web" && styles.focused]}>
    <View pointerEvents="none" style={[styles.tile, buttonHitArea]}>
      {selected && <FantasyMaterial kind="selected" opacity={0.68} />}
      {children}
    </View>
  </PlatformPressable>;
}

// Keep the stock tab bar: route events, links, long-press, focus and safe areas
// remain owned by React Navigation. Only presentation options change.
export function tabAppearance(bottomInset: number, fontScale: number) {
  return {
    tabBarBackground: () => <FantasyMaterial kind="nav" />,
    tabBarButton: props => <TabButton {...props} />,
    tabBarLabelPosition: "below-icon",
    tabBarAllowFontScaling: true,
    tabBarActiveTintColor: ui.colors.navigationActive,
    tabBarInactiveTintColor: ui.colors.navigationText,
    tabBarActiveBackgroundColor: "transparent",
    tabBarLabelStyle: { ...ui.type.tab, flexShrink: 0 },
    tabBarItemStyle: { minHeight: ui.size.target, marginHorizontal: 2 },
    tabBarStyle: {
      backgroundColor: ui.colors.navigation,
      borderTopColor: ui.colors.navigationBorder,
      borderTopWidth: 0,
      height: ui.size.tabBar + bottomInset + Math.max(0, fontScale - 1) * ui.type.tab.lineHeight,
      paddingTop: ui.spacing.xs,
      paddingBottom: Math.max(bottomInset, ui.spacing.xs),
      paddingHorizontal: ui.spacing.xs,
      elevation: 0,
      shadowOpacity: 0,
    },
  } satisfies BottomTabNavigationOptions;
}

const styles = StyleSheet.create({
  focused: { outlineWidth: 2, outlineStyle: "solid", outlineColor: ui.colors.navigationActive, outlineOffset: -3, borderRadius: 8 },
  button: { alignItems: "center", justifyContent: "center" },
  tile: { minWidth: 58, maxWidth: "100%", paddingHorizontal: 5, paddingVertical: 4, minHeight: 54,
    alignItems: "center", justifyContent: "center" },
  icon: { width: 31, height: 28, alignItems: "center", justifyContent: "center" },
});
