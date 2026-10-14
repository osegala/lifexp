import { useState } from "react";
import { StyleSheet, View, useWindowDimensions } from "react-native";
import { NavigationContainer } from "expo-router/react-navigation";
import { createBottomTabNavigator } from "expo-router/js-tabs";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import LifeButton from "../components/LifeButton";
import XPBar from "../components/XPBar";
import { EmptyState, FilterChip, ListRowCard, ScreenShell, SectionHeader, SurfaceCard, UiText } from "../components/ui/Primitives";
import { BadgePill, ResourceCluster, ResourcePill } from "../components/ui/Indicators";
import { tabAppearance, TabIcon, tabIcons } from "../navigation/tabAppearance";
import { uiTheme as ui } from "../theme/theme";

const Tabs = createBottomTabNavigator();
const titles = { dashboard: "Home", tasks: "Tasks", base: "Base", avatar: "Avatar", shop: "Shop" };
function Samples() {
  const [selected, setSelected] = useState("Today");
  const [saved, setSaved] = useState(false);
  return <ScreenShell>
    <View style={styles.intro}>
      <UiText variant="display" accessibilityRole="header">Evrenthia</UiText>
      <UiText style={styles.secondary}>A more intentional you.</UiText>
      <UiText variant="caption" style={styles.secondary}>UI foundation preview. All values below are examples.</UiText>
    </View>
    <ResourceCluster><ResourcePill resource="coins" value="1,240" /><ResourcePill resource="gems" value="45" /><ResourcePill resource="worldPoints" value="128" /></ResourceCluster>
    <SurfaceCard><View style={styles.stack}>
      <SectionHeader title="Your progress" trailing={<BadgePill label="Level 12" />} />
      <UiText variant="caption" style={styles.secondary}>320 / 500 XP</UiText>
      <XPBar tone="parchment" progress={0.64} />
      <UiText>Small steps, taken consistently.</UiText>
    </View></SurfaceCard>
    <View style={styles.stack}>
      <SectionHeader title="Today" subtitle="Make room for what matters." />
      <View style={styles.wrap}>{["Today", "Upcoming", "Completed"].map(label =>
        <FilterChip key={label} label={label} selected={selected === label} onPress={() => setSelected(label)} />)}</View>
      <UiText variant="caption" accessibilityLiveRegion="polite" style={styles.secondary}>{selected} selected in this preview.</UiText>
      <ListRowCard title="Morning journal" detail="5 min" onPress={() => setSaved(value => !value)}
        leading={<MaterialCommunityIcons name={saved ? "check-circle" : "notebook-outline"} size={ui.size.icon} color={ui.colors.primary} accessible={false} aria-hidden />}
        trailing={<MaterialCommunityIcons name="chevron-right" size={ui.size.icon} color={ui.colors.subduedText} accessible={false} aria-hidden />} />
      <LifeButton tone="parchment" title={saved ? "Added to your day" : "Add task"} onPress={() => setSaved(value => !value)} />
      <LifeButton tone="parchment" variant="secondary" title="Reset preview" onPress={() => { setSaved(false); setSelected("Today"); }} />
    </View>
    <View style={styles.stack}>
      <SectionHeader title="States" />
      <View style={styles.wrap}><BadgePill tone="success" label="Complete" /><BadgePill tone="warning" label="Needs attention" /><BadgePill tone="locked" label="Locked" /></View>
      <FilterChip label="Unavailable filter" disabled onPress={() => {}} />
      <LifeButton tone="parchment" title="Save changes" disabled onPress={() => {}} />
      <LifeButton tone="parchment" title="Try again" variant="danger" onPress={() => setSaved(false)} />
      <EmptyState title="Nothing here yet" description="Add a task when you are ready to begin." />
    </View>
  </ScreenShell>;
}

function PreviewTabs() {
  const { bottom } = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  return <Tabs.Navigator screenOptions={{ headerShown: false, ...tabAppearance(bottom, fontScale) }}>
    {(Object.keys(titles) as (keyof typeof tabIcons)[]).map(name => <Tabs.Screen key={name} name={name} component={Samples}
      options={{ title: titles[name], tabBarIcon: props => <TabIcon tab={name} {...props} /> }} />)}
  </Tabs.Navigator>;
}
export default function UiPreview() {
  return __DEV__ ? <SafeAreaProvider><NavigationContainer><PreviewTabs /></NavigationContainer></SafeAreaProvider> : null;
}
const styles = StyleSheet.create({
  intro: { gap: ui.spacing.xs, paddingTop: ui.spacing.sm },
  secondary: { color: ui.colors.secondaryText },
  stack: { gap: ui.spacing.md },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: ui.spacing.sm },
});
