import { useState, type PropsWithChildren } from "react";
import { Platform, View, useWindowDimensions } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import { ExpoRoot, Stack, Tabs, router, usePathname, type RequireContext } from "expo-router";
import TasksScreen from "../../app/(tabs)/tasks";
import AvatarScreen from "../../app/(tabs)/avatar";
import ProfileScreen from "../../app/(tabs)/profile";
import PremiumScreen from "../../app/premium";
import BaseScreen from "../../app/(tabs)/base";
import { AuthProvider } from "../context/AuthContext";
import { CompletionFeedbackProvider } from "../context/CompletionFeedbackContext";
import GameNoticeHost from "../components/GameNoticeHost";
import GameNotice from "../components/ui/GameNotice";
import { ScreenShell, FilterChip, UiText } from "../components/ui/Primitives";
import { api } from "../api/client";
import { cognitoAuth } from "../auth/cognito";
import { billingProvider } from "../billing/provider";
import { DEFAULT_APPEARANCE } from "../avatar/appearance";
import { FREE_ENTITLEMENTS } from "../entitlements/model";
import { showGameNotice } from "../feedback/notices";
import { tabAppearance, TabIcon, tabIcons } from "../navigation/tabAppearance";
import type { Task, ShopItem } from "../types";
import type { InventoryEquipment } from "../types/avatar";

// Separate DEV/web entry. Every request and store operation below is local.
const profile = { ...DEFAULT_APPEARANCE, displayName: "Rowan", onboardingCompleted: true, timeZone: "America/New_York",
  xp: 1740, level: 6, xpIntoLevel: 140, xpForNextLevel: 360, xpToNextLevel: 220, coins: 284, worldPoints: 412 };
const time = { date: "2026-10-21", weekday: "WED", timeZone: profile.timeZone };
const tasks: Task[] = ['Read a chapter', 'Take an afternoon walk', 'Plan tomorrow'].map((title, index) => ({
  taskId: String(index), title, description: null, taskSize: "NORMAL", repeatType: "DAILY", repeatDays: [],
  active: true, archived: false, completed: false, completedToday: false, isScheduledToday: true, isDueToday: true,
  currentStreak: 0, bestStreak: 0, xpReward: 35, coinReward: 4, dueTime: '09:00',
}));
const gear = (itemId: string, name: string, category: string, assetKey: string): ShopItem => ({
  itemId, name, category, assetKey, price: 0, effectivePrice: 0, requiredLevel: 1, effectiveRequiredLevel: 1,
  requiredAchievement: null, achievementRequirement: null, requirementSatisfied: true,
  owned: true, unlocked: true, canAfford: true, canPurchase: false, status: "OWNED",
});
const items = [gear('top', 'Forest Ranger Tunic', 'tunic', 'avatar-v2/tops/forest-ranger'),
  gear('dress', 'Forestbound Dress', 'tunic', 'avatar-v2/dresses/forest-ranger'),
  gear('pants', 'Forest Ranger Trousers', 'pants', 'avatar-v2/bottoms/forest-ranger-trousers'),
  gear('boots', 'Guild Boots', 'boots', 'avatar-v2/boots/forest-ranger-boots'),
  gear('garden', 'Castle Garden', 'background', 'avatar-v2/backgrounds/castle-garden')];
let equipment: InventoryEquipment = { tunic: 'top', pants: 'pants', boots: 'boots', background: 'garden', hair: null, hat: null, pet: null, aura: null };
const slots: Record<string, keyof InventoryEquipment> = { tunic: 'tunic', pants: 'pants', boots: 'boots', background: 'background' };
let premium = false, fail = false;
const preferences = { notificationsEnabled: false, taskRemindersEnabled: false, dailyReminderEnabled: false, dailyReminderTime: '09:00',
  dailyQuestReminderEnabled: false, dailyQuestReminderTime: '18:00', streakReminderEnabled: false, streakReminderTime: '20:00',
  quietHoursEnabled: false, quietHoursStart: '22:00', quietHoursEnd: '07:00' };
const buildings = ['Home Base', 'Workshop', 'Library', 'Training Grounds', 'Garden', 'Hall of Achievements'].map((name, index) => ({
  buildingId: `review-${index}`, name, currentLevel: 1, level: 1, maxLevel: 5, maxed: false, nextLevel: 2,
  upgradeCost: 100, canAfford: true, canUpgrade: true, sortOrder: index, upgradedAt: null,
}));
if (__DEV__ && Platform.OS === 'web') {
  cognitoAuth.getSession = async () => ({ token: 'local-fixture-only', userId: 'feedback-ui-review', email: 'rowan@example.test' });
  Object.assign(billingProvider, { available: true, identify: async () => {}, offerings: async () => [{ id: 'local', label: 'Local review', price: '$0.00 fixture' }],
    purchase: async () => {}, restore: async () => {}, manage: async () => {} });
  api.defaults.adapter = async config => {
    const path = config.url ?? '', method = config.method, input = config.data ? JSON.parse(config.data) : {};
    let data: unknown;
    if (method === 'get' && path === '/me') data = profile;
    else if (method === 'patch' && path === '/me') { if (fail) throw new Error('Local review: connection unavailable. Your changes are still here.'); data = Object.assign(profile, input); }
    else if (method === 'get' && path === '/entitlements') data = premium ? { ...FREE_ENTITLEMENTS, plan: 'PREMIUM', premium: true, adsEnabled: false, subscriptionStatus: 'ACTIVE', source: 'LOCAL_REVIEW' } : FREE_ENTITLEMENTS;
    else if (method === 'post' && path === '/billing/sync') { premium = true; data = {}; }
    else if (method === 'get' && path === '/shop') data = { player: { coins: profile.coins, level: profile.level }, items };
    else if (method === 'get' && path === '/inventory') data = { equipped: equipment, items: items.map(item => ({ ...item, equipped: Object.values(equipment).includes(item.itemId), purchasedAt: null, purchasePrice: 0 })) };
    else if (method === 'post' && (path === '/inventory/equip' || path === '/inventory/unequip')) {
      if (fail) throw new Error('Local review: could not update that item.');
      const item = items.find(row => row.itemId === input.itemId)!;
      equipment = { ...equipment, [slots[item.category]]: path.endsWith('/unequip') ? null : item.itemId }; data = {};
    }
    else if (method === 'get' && path === '/tasks') data = { time, tasks, summary: { total: tasks.length, active: tasks.length, scheduledToday: tasks.length, dueToday: tasks.filter(t => t.isDueToday).length, completedToday: tasks.filter(t => t.completedToday).length } };
    else if (method === 'post' && /^\/tasks\/[^/]+\/complete$/.test(path)) {
      if (fail) throw new Error('Local review: completion could not be confirmed. No rewards granted.');
      const task = tasks.find(row => row.taskId === path.split('/')[2])!;
      task.completedToday = true; task.isDueToday = false;
      const previous = { level: 6, totalXp: profile.xp, xpIntoLevel: profile.xpIntoLevel, xpForNextLevel: 360, xpToNextLevel: 360 - profile.xpIntoLevel };
      profile.xp += 35; profile.xpIntoLevel += 35; profile.coins += 4;
      data = { task, rewards: { xp: 35, coins: 4, worldPoints: 0 }, progression: { ...previous, totalXp: profile.xp, xpIntoLevel: profile.xpIntoLevel, xpToNextLevel: 360 - profile.xpIntoLevel, previousLevel: 6, leveledUp: false, previous }, player: { xp: profile.xp, coins: profile.coins, worldPoints: profile.worldPoints, level: 6, tasksCompleted: 1 }, time: { date: time.date, completedAt: '2026-10-21T12:00:00Z' }, newAchievements: [] };
    }
    else if (method === 'get' && path === '/world') data = { worldPoints: profile.worldPoints, buildings };
    else if (method === 'post' && /^\/world\/buildings\/.+\/upgrade$/.test(path)) {
      const building = buildings.find(row => path.includes(row.buildingId))!;const oldLevel = building.level;
      building.level++; building.currentLevel++; building.nextLevel++; profile.worldPoints -= 100;
      data = { upgraded: true, building: { buildingId: building.buildingId, name: building.name, oldLevel, newLevel: building.level, maxLevel: 5 }, cost: { worldPoints: 100 }, player: { worldPoints: profile.worldPoints } };
    }
    else if (method === 'get' && path === '/achievements') data = { achievements: [], summary: { earned: 0, total: 0 } };
    else if (method === 'get' && path === '/preferences') data = preferences;
    else if (method === 'patch' && path === '/preferences') data = Object.assign(preferences, input);
    else if (method === 'get' && path === '/reminders') data = { reminders: [] };
    else throw new Error(`Blocked external request in feedback review: ${method} ${path}`);
    return { data: structuredClone(data), config, status: 200, statusText: 'OK', headers: {} };
  };
}
function Samples() {
  const [failed, setFailed] = useState(fail);
  return <ScreenShell><UiText variant="display">Feedback review</UiText><UiText>Local fixtures only. No real account, network, ads or store transaction.</UiText>
    <FilterChip label={failed ? 'Use successful responses' : 'Use recoverable errors'} onPress={() => { fail = !fail; setFailed(fail); }} />
    {(['success', 'info', 'error', 'warning'] as const).map(variant => <GameNotice key={variant} title={`${variant[0].toUpperCase()}${variant.slice(1)} notice`}
      variant={variant} message="Small steps, a little progress. This is a visual fixture." />)}
    <FilterChip label="Show transient info" onPress={() => showGameNotice('Journey update', 'Your changes are safe.', 'info')} />
    <FilterChip label="Show transient warning" onPress={() => showGameNotice('Connection paused', 'Reconnect before trying again.', 'warning')} />
    <FilterChip label="Open Profile" onPress={() => router.push('/(tabs)/profile')} />
    <FilterChip label="Open Premium" onPress={() => router.push('/premium')} />
  </ScreenShell>;
}
function Other() { return <ScreenShell><UiText>Use Tasks, Base, Avatar, or the Home review controls.</UiText></ScreenShell>; }
const titles = { dashboard: 'Home', tasks: 'Tasks', base: 'Base', avatar: 'Avatar', shop: 'Shop' };
function ReviewTabs() {
  const { bottom } = useSafeAreaInsets(), { fontScale } = useWindowDimensions();
  return <Tabs initialRouteName="tasks" screenOptions={{ headerShown: false, ...tabAppearance(bottom, fontScale) }}>
    {Object.keys(titles).map(name => <Tabs.Screen key={name} name={name} options={{ title: titles[name as keyof typeof titles], tabBarIcon: props => <TabIcon tab={name as keyof typeof tabIcons} {...props} /> }} />)}
    <Tabs.Screen name="profile" options={{ href: null }} />
  </Tabs>;
}
function Layout() { return <Stack screenOptions={{ headerShown: false }} />; }
function ReviewNoticeHost() { return <GameNoticeHost scope="feedback-review" placement={usePathname() === '/tasks' ? 'lower' : 'upper'} />; }
function Providers({ children }: PropsWithChildren) { return <GestureHandlerRootView style={{ flex: 1 }}><SafeAreaProvider><AuthProvider><CompletionFeedbackProvider>
  <View style={{ flex: 1 }}>{children}<ReviewNoticeHost /></View>
</CompletionFeedbackProvider></AuthProvider></SafeAreaProvider></GestureHandlerRootView>; }
const routes: Record<string, { default: React.ComponentType }> = { './_layout.tsx': { default: Layout }, './(tabs)/_layout.tsx': { default: ReviewTabs },
  './(tabs)/dashboard.tsx': { default: Samples }, './(tabs)/tasks.tsx': { default: TasksScreen }, './(tabs)/avatar.tsx': { default: AvatarScreen },
  './(tabs)/base.tsx': { default: BaseScreen }, './(tabs)/shop.tsx': { default: Other }, './(tabs)/profile.tsx': { default: ProfileScreen }, './premium.tsx': { default: PremiumScreen } };
const context = Object.assign((id: string) => routes[id], { keys: () => Object.keys(routes), resolve: (id: string) => id, id: 'notice-review' }) as RequireContext;
export default function NoticePreview() {
  if (!__DEV__ || Platform.OS !== 'web') return null;
  const view = new URL(window.location.href).searchParams.get('view') ?? 'tasks';
  return <ExpoRoot context={context} location={view === 'premium' ? '/premium' : `/(tabs)/${['dashboard','tasks','avatar','base','profile'].includes(view) ? view : 'tasks'}`} wrapper={Providers} />;
}
