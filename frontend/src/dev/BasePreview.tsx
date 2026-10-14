import { useState, type PropsWithChildren } from "react";
import { View, useWindowDimensions } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import { ExpoRoot, Tabs } from "expo-router";
import type { RequireContext } from "expo-router/build/types";
import BaseScreen from "../../app/(tabs)/base";
import { api } from "../api/client";
import { apiRoutes } from "../api/routes";
import { CompletionFeedbackProvider } from "../context/CompletionFeedbackContext";
import { FilterChip, UiText } from "../components/ui/Primitives";
import { uiTheme as ui } from "../theme/theme";
import { tabAppearance, TabIcon, tabIcons } from "../navigation/tabAppearance";
import type { BuildingType, WorldResponse } from "../types/progression";

// Standalone DEV entry only. The real Base screen/renderer runs against this
// in-memory transport; every unrecognised request is rejected, never sent.
const names: BuildingType[] = ["Home Base", "Workshop", "Library", "Training Grounds", "Garden", "Hall of Achievements"];
let mode = "Normal", world = makeWorld();
function makeWorld(): WorldResponse {
  return { worldPoints: 412, buildings: names.map((name, index) => ({
    buildingId: `review-${index}`, name, currentLevel: 1, level: 1, maxLevel: 5,
    maxed: false, nextLevel: 2, upgradeCost: 100, canAfford: true, canUpgrade: true, sortOrder: index, upgradedAt: null,
  })) };
}
if (__DEV__) {
  api.get = (async (route: string) => {
    if (route !== apiRoutes.world) throw new Error("No network in Base review");
    if (mode === "Loading") await new Promise(resolve => setTimeout(resolve, 15000));
    if (mode === "Load failure") throw new Error("Fixture world unavailable");
    return { data: structuredClone(world) };
  }) as typeof api.get;
  api.post = (async (route: string) => {
    const building = world.buildings.find(item => route === apiRoutes.upgradeBuilding(item.buildingId));
    if (!building || mode === "Upgrade failure") throw new Error("Fixture upgrade unavailable");
    const oldLevel = building.level;
    world = { worldPoints: world.worldPoints - (building.upgradeCost ?? 0), buildings: world.buildings.map(item => item === building ? {
      ...item, currentLevel: oldLevel + 1, level: oldLevel + 1, nextLevel: oldLevel + 2,
    } : item) };
    return { data: { upgraded: true, building: { buildingId: building.buildingId, name: building.name, oldLevel, newLevel: oldLevel + 1, maxLevel: 5 },
      cost: { worldPoints: building.upgradeCost }, player: { worldPoints: world.worldPoints } } };
  }) as typeof api.post;
}
function configureFixture(label: string) {
  mode = label; world = makeWorld();
  if (label === "Locked") world = { ...world, worldPoints: 12, buildings: world.buildings.map(item => ({ ...item, canUpgrade: false, canAfford: false })) };
  if (label === "Maximum") world.buildings = world.buildings.map(item => ({ ...item, currentLevel: 5, level: 5, maxed: true, nextLevel: null, upgradeCost: null, canUpgrade: false }));
  if (label === "Large balance") world.worldPoints = 1234567890;
}
function recoverFixture() { mode = "Normal"; }
function ReviewBase() {
  const [scenario, setScenario] = useState("Normal"), [version, setVersion] = useState(0), [controls, setControls] = useState(true);
  function change(label: string) {
    configureFixture(label);
    setScenario(label); setVersion(value => value + 1);
  }
  return <View testID="base-review" style={{ flex: 1, backgroundColor: ui.colors.background }}>
    <View testID="base-review-controls" style={{ padding: ui.spacing.sm, gap: ui.spacing.xs }}>
      <UiText variant="caption">DEV Base review · real world renderer · fixture API only</UiText>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: ui.spacing.xs }}>
        {controls && ["Normal", "Locked", "Maximum", "Load failure", "Upgrade failure", "Loading", "Large balance"].map(label =>
          <FilterChip key={label} label={label} selected={scenario === label} onPress={() => change(label)} />)}
        <FilterChip label={controls ? "Hide review controls" : "Show review controls"} onPress={() => setControls(value => !value)} />
        {scenario === "Load failure" && <FilterChip label="Recover fixture transport" onPress={recoverFixture} />}
      </View>
    </View>
    <BaseScreen key={version} />
  </View>;
}
const titles = { dashboard: "Home", tasks: "Tasks", base: "Base", avatar: "Avatar", shop: "Shop" };
function OtherTab() { return <UiText>Unchanged screen. Return to Base to review.</UiText>; }
function ReviewTabs() {
  const { bottom } = useSafeAreaInsets(), { fontScale } = useWindowDimensions();
  return <Tabs initialRouteName="base" screenOptions={{ headerShown: false, ...tabAppearance(bottom, fontScale) }}>
    {(Object.keys(titles) as (keyof typeof tabIcons)[]).map(name => <Tabs.Screen key={name} name={name}
      options={{ title: titles[name], tabBarIcon: props => <TabIcon tab={name} {...props} /> }} />)}
  </Tabs>;
}
function ReviewProviders({ children }: PropsWithChildren) {
  return <GestureHandlerRootView style={{ flex: 1 }}><SafeAreaProvider><CompletionFeedbackProvider>
    {children}
  </CompletionFeedbackProvider></SafeAreaProvider></GestureHandlerRootView>;
}
const routes: Record<string, { default: React.ComponentType }> = { "./_layout.tsx": { default: ReviewTabs },
  ...Object.fromEntries(Object.keys(titles).map(name => [`./${name}.tsx`, { default: name === "base" ? ReviewBase : OtherTab }])) };
const context = Object.assign((id: string) => routes[id], { keys: () => Object.keys(routes), resolve: (id: string) => id, id: "base-review" }) as RequireContext;
export default function BasePreview() {
  return __DEV__ ? <ExpoRoot context={context} location="/base" wrapper={ReviewProviders} /> : null;
}
