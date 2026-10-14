import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";
import * as theme from "../src/theme/theme.ts";

const require = createRequire(import.meta.url);
const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
const native = { ...Object.fromEntries(["View", "Text", "Pressable", "ScrollView", "ActivityIndicator"].map(name => [name, name])),
  StyleSheet: { create: value => value }, Platform: { select: value => value.default }, useWindowDimensions: () => ({ fontScale: 1 }) };
function load(path, imports = {}) {
  const exports = {};
  const code = ts.transpileModule(read(path), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } }).outputText;
  const modules = { "react/jsx-runtime": require("react/jsx-runtime"), react: { useState: value => [value, () => {}] }, "react-native": native,
    "../theme/theme": theme, "../../theme/theme": theme, "@expo/vector-icons/MaterialCommunityIcons": "Icon", ...imports };
  new Function("exports", "require", code)(exports, id => { assert.ok(id in modules, `Unexpected dependency ${id}`); return modules[id]; });
  return exports;
}
const flat = value => Object.assign({}, ...(Array.isArray(value) ? value.flat(Infinity) : [value]).filter(Boolean));
const nodes = tree => Array.isArray(tree) ? tree.flatMap(nodes) : tree?.props ? [tree, ...nodes(tree.props.children)] : [];
const button = load("../src/components/LifeButton.tsx").default;
const card = load("../src/components/LifeCard.tsx").default;
const xp = load("../src/components/XPBar.tsx").default;
const primitives = load("../src/components/ui/Primitives.tsx", { "../LifeCard": card });
const indicators = load("../src/components/ui/Indicators.tsx", { "./Primitives": primitives });
const navigation = load("../src/navigation/tabAppearance.tsx");

test("legacy surfaces remain unchanged unless parchment is explicitly selected", () => {
  assert.equal(theme.colors.background, "#111713");
  assert.equal(flat(card({}).props.style).backgroundColor, theme.colors.card);
  assert.equal(flat(card({ tone: "parchment" }).props.style).backgroundColor, theme.uiTheme.colors.surface);
  const current = button({ title: "Save", onPress() {} });
  assert.equal(flat(current.props.style({ pressed: false })).backgroundColor, theme.colors.primary);
  assert.equal(flat(xp({ progress: 0.5 }).props.style).backgroundColor, theme.colors.cardLight);
});

test("button variants preserve callbacks, disabled semantics, readable labels and touch targets", () => {
  let calls = 0;
  for (const variant of ["primary", "secondary", "danger"]) {
    const node = button({ title: "Save", variant, tone: "parchment", onPress: () => calls++ });
    node.props.onPress();
    assert.equal(node.props.accessibilityRole, "button");
    assert.equal(node.props.accessibilityLabel, "Save");
    assert.ok(flat(node.props.style({ pressed: false })).minHeight >= 44);
    assert.deepEqual(flat(node.props.style({ pressed: true })).transform, [], "no animated or scaled parchment controls");
  }
  assert.equal(calls, 3);
  const disabled = button({ title: "Save", tone: "parchment", disabled: true, onPress() {} });
  assert.equal(disabled.props.disabled, true);
  assert.deepEqual(disabled.props.accessibilityState, { disabled: true });
  assert.equal(flat(disabled.props.style({ pressed: true })).backgroundColor, theme.uiTheme.colors.disabled);
});

test("chips, rows and resource pills are accessible display primitives, not new data logic", () => {
  let calls = 0;
  const chip = primitives.FilterChip({ label: "Today", selected: true, onPress: () => calls++ });
  chip.props.onPress();
  assert.equal(calls, 1);
  assert.deepEqual(chip.props.accessibilityState, { selected: true, disabled: false });
  assert.equal(chip.props["aria-pressed"], true);
  native.Platform.OS = "web";
  const webChip = primitives.FilterChip({ label: "Today", selected: true, onPress() {} });
  assert.deepEqual(webChip.props.accessibilityState, { disabled: false });
  assert.equal(webChip.props["aria-pressed"], true);
  delete native.Platform.OS;
  assert.equal(primitives.FilterChip({ label: "Locked", disabled: true, onPress() {} }).props.disabled, true);
  const row = primitives.ListRowCard({ title: "Read", detail: "20 min", onPress: () => calls++ });
  assert.equal(row.props.accessibilityLabel, "Read, 20 min");
  row.props.onPress(); assert.equal(calls, 2);
  assert.equal(primitives.ListRowCard({ title: "Read" }).type, "View");
  assert.equal(indicators.ResourcePill({ resource: "worldPoints", value: 0 }).props.accessibilityLabel, "World Points: 0");
  const shell = primitives.ScreenShell({ children: "content" });
  assert.equal(shell.props.children, "content");
  assert.equal(flat(shell.props.contentContainerStyle).width, "100%");
});

test("XP presentation is bounded and exposes meaningful progress without calculating rewards", () => {
  for (const [progress, now] of [[0.64, 64], [-1, 0], [2, 100], [NaN, 0]]) {
    const node = xp({ progress, tone: "parchment" });
    assert.equal(node.props.accessibilityRole, "progressbar");
    assert.equal(node.props.accessibilityValue.now, now);
    assert.equal(flat(node.props.children.props.style).width, `${now}%`);
  }
});

test("the five-tab order, hidden routes, providers and authentication behavior remain intact", () => {
  const auth = { loading: false, token: "test", user: { id: "fixture" } };
  const Tabs = Object.assign(() => {}, { Screen: "Screen" });
  const Layout = load("../app/(tabs)/_layout.tsx", {
    "expo-router": { Tabs, Redirect: "Redirect" }, "react-native-safe-area-context": { useSafeAreaInsets: () => ({ bottom: 34 }) },
    "../../src/theme/theme": theme, "../../src/navigation/tabAppearance": navigation,
    "../../src/context/AuthContext": { useAuth: () => auth },
    "../../src/context/CompletionFeedbackContext": { CompletionFeedbackProvider: "CompletionFeedbackProvider" },
    "../../src/ads/Ads": { AdProvider: "AdProvider" },
  }).default;
  const tree = Layout(), all = nodes(tree), screens = all.filter(node => node.type === "Screen");
  assert.equal(tree.type, "CompletionFeedbackProvider"); assert.equal(tree.key, "fixture");
  assert.equal(tree.props.children.type, "AdProvider");
  assert.deepEqual(screens.slice(0, 5).map(node => [node.props.name, node.props.options.title]),
    [["dashboard", "Home"], ["tasks", "Tasks"], ["base", "Base"], ["avatar", "Avatar"], ["shop", "Shop"]]);
  assert.deepEqual(screens.slice(5).map(node => [node.props.name, node.props.options.href]), [["social", null], ["profile", null]]);
  assert.ok(!("tabBar" in all.find(node => node.type === Tabs).props), "stock navigation retained");
  auth.token = null; assert.equal(Layout().props.href, "/login");
  auth.loading = true; assert.ok(nodes(Layout()).some(node => node.type === "ActivityIndicator"));
});

test("tab appearance accommodates insets and larger text and hides decorative glyphs", () => {
  const ordinary = navigation.tabAppearance(0, 1), larger = navigation.tabAppearance(34, 2);
  assert.equal(ordinary.tabBarLabelPosition, "below-icon");
  assert.equal(ordinary.tabBarAllowFontScaling, true);
  assert.equal(ordinary.tabBarStyle.height, 64);
  assert.equal(larger.tabBarStyle.height, 114);
  assert.equal(larger.tabBarStyle.paddingBottom, 34);
  assert.ok(ordinary.tabBarItemStyle.minHeight >= 44);
  assert.equal(navigation.TabIcon({ tab: "dashboard", focused: true, color: "gold" }).props["aria-hidden"], true);
});

test("semantic foreground/background pairs pass WCAG AA text and control contrast", () => {
  const luminance = hex => hex.slice(1).match(/../g).map(x => parseInt(x, 16) / 255)
    .map(x => x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4)
    .reduce((sum, x, i) => sum + x * [0.2126, 0.7152, 0.0722][i], 0);
  const ratio = (a, b) => (Math.max(luminance(a), luminance(b)) + 0.05) / (Math.min(luminance(a), luminance(b)) + 0.05);
  const c = theme.uiTheme.colors;
  for (const [fg, bg] of [[c.text, c.surface], [c.secondaryText, c.background], [c.subduedText, c.surface],
    [c.onPrimary, c.primary], [c.onPrimary, c.danger], [c.primary, c.surface], [c.disabledText, c.disabled],
    [c.coin, c.coinSurface], [c.gem, c.gemSurface], [c.success, c.successSurface], [c.warning, c.warningSurface],
    [c.locked, c.stone], [c.navigationText, c.navigation], [c.navigationActive, c.navigationSelected]]) {
    assert.ok(ratio(fg, bg) >= 4.5, `${fg} on ${bg}: ${ratio(fg, bg)}`);
  }
  assert.ok(ratio(c.controlBorder, c.surface) >= 3);
  assert.ok(ratio(c.focus, c.background) >= 3);
});
