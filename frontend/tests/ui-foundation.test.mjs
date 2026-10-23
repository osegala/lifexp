import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";
import * as theme from "../src/theme/theme.ts";

const require = createRequire(import.meta.url);
const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
const native = { ...Object.fromEntries(["View", "Text", "Pressable", "ScrollView", "ActivityIndicator", "TextInput"].map(name => [name, name])),
  StyleSheet: { create: value => value }, Platform: { select: value => value.default }, useWindowDimensions: () => ({ fontScale: 1 }) };
let surfaceModule;
function load(path, imports = {}) {
  const exports = {};
  const code = ts.transpileModule(read(path), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } }).outputText;
  const modules = { "./ui/FantasyMaterial": "FantasyMaterial", "./FantasyMaterial": "FantasyMaterial", "../components/ui/FantasyMaterial": "FantasyMaterial", "react/jsx-runtime": require("react/jsx-runtime"), react: { useState: value => [value, () => {}], useId: () => "button-gradient" }, "react-native": native,
    "react-native-svg": { __esModule: true, default: "Svg", Defs: "Defs", LinearGradient: "LinearGradient", Rect: "Rect", Path: "Path", Stop: "Stop" },
    "./ui/ButtonSurface": surfaceModule, "./ButtonSurface": surfaceModule, "../components/ui/ButtonSurface": surfaceModule,
    "../utils/focus": { isFocusVisible: () => false }, "../../utils/focus": { isFocusVisible: () => false },
    "./ui/PaperTexture": "PaperTexture", "expo-router/react-navigation": { PlatformPressable: "PlatformPressable" },
    "../theme/theme": theme, "../../theme/theme": theme, "@expo/vector-icons/MaterialCommunityIcons": "Icon", ...imports };
  new Function("exports", "require", code)(exports, id => { assert.ok(id in modules, `Unexpected dependency ${id}`); return modules[id]; });
  return exports;
}
const flat = value => Object.assign({}, ...(Array.isArray(value) ? value.flat(Infinity) : [value]).filter(Boolean));
const nodes = tree => Array.isArray(tree) ? tree.flatMap(nodes) : tree?.props ? [tree, ...nodes(tree.props.children)] : [];
surfaceModule = load("../src/components/ui/ButtonSurface.tsx");
const button = load("../src/components/LifeButton.tsx").default;
const card = load("../src/components/LifeCard.tsx").default;
const xp = load("../src/components/XPBar.tsx").default;
const primitives = load("../src/components/ui/Primitives.tsx", { "../LifeCard": card, "./PageBackground": "Background", "react-native-safe-area-context": { useSafeAreaInsets: () => ({ top: 20, bottom: 34 }) } });
const indicators = load("../src/components/ui/Indicators.tsx", { "./Primitives": primitives });
const buttons = load("../src/components/ui/Buttons.tsx", { "../LifeButton": button, "./Primitives": primitives });
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
  assert.equal(nodes(disabled).find(n => n.type === surfaceModule.default).props.disabled, true);
  assert.equal(flat(nodes(disabled).find(n => n.type === "Text").props.style).color, theme.uiTheme.colors.text);
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
  const shell = primitives.ScreenShell({ children: "content" }).props.children;
  assert.equal(shell.props.children, "content");
  assert.equal(flat(shell.props.contentContainerStyle).width, "100%");
});

test("shared button variants preserve action, busy/disabled state and explicit accessible names", () => {
  const action = () => {};
  for (const [name, variant] of [["PrimaryButton", "primary"], ["SecondaryButton", "secondary"], ["DestructiveButton", "danger"]]) {
    const wrapper = buttons[name]({ title: "Save", accessibilityLabel: "Save appearance", busy: true, disabled: true, onPress: action });
    assert.equal(wrapper.props.variant, variant);
    const control = wrapper.type(wrapper.props);
    assert.equal(control.props.onPress, action);
    assert.equal(control.props.accessibilityLabel, "Save appearance");
    assert.deepEqual(control.props.accessibilityState, { disabled: true, busy: true });
    assert.equal(control.props.disabled, true);
    assert.ok(nodes(control).some(node => node.type === "ActivityIndicator"));
  }
  const wrapper = buttons.IconUtilityButton({ icon: "close", accessibilityLabel: "Close editor", disabled: true, onPress: action });
  const utility = wrapper.type(wrapper.props);
  assert.equal(utility.props.accessibilityRole, "button");
  assert.equal(utility.props.accessibilityLabel, "Close editor");
  assert.equal(utility.props.disabled, true);
  assert.equal(utility.props.onPress, action);
});

test("ornate action hit targets stay transparent in every native/web variant and interaction state", () => {
  for (const OS of ["ios", "android", "web"]) for (const variant of ["primary", "secondary", "danger"]) {
    native.Platform.OS = OS;
    for (const disabled of [false, true]) for (const pressed of [false, true]) for (const framed of [false, true]) {
      const control = button({ title: "Action", variant, tone: "parchment", disabled, framed, onPress() {},
        style: { backgroundColor: "green", borderWidth: 2, shadowOpacity: 0.5, elevation: 5 } });
      const style = flat(control.props.style({ pressed }));
      assert.equal(style.backgroundColor, "transparent"); assert.equal(style.borderWidth, 0);
      assert.equal(style.shadowOpacity, 0); assert.equal(style.elevation, 0); assert.equal(style.borderRadius, 0);
      const surfaces = nodes(control).filter(n => n.type === surfaceModule.default);
      assert.equal(surfaces.length, 1, "one bezel, including framed secondary and destructive actions");
      assert.equal(surfaces[0].props.variant, variant); assert.equal(surfaces[0].props.disabled, disabled);
      assert.equal(nodes(control).filter(n => n.type === "Pressable").length, 1, "no nested buttons");
      assert.equal(nodes(control).filter(n => n.type === "FantasyMaterial").length, 0, "no second painted frame");
    }
    const utility = buttons.IconUtilityButton({ icon: "plus", variant: "primary", accessibilityLabel: "Add task", disabled: true });
    assert.equal(flat(utility.props.style).backgroundColor, "transparent");
    assert.equal(flat(utility.props.style).borderWidth, 0);
    const chip = primitives.FilterChip({ label: "Today", selected: true, disabled: true });
    assert.equal(flat(chip.props.style).backgroundColor, "transparent");
    assert.equal(flat(chip.props.style).borderWidth, 0);
  }
  delete native.Platform.OS;
});

test("native bezels draw a single inset face inside the gold silhouette at icon and CTA sizes", () => {
  for (const OS of ["ios", "android", "web"]) for (const size of [{ width: 48, height: 48 }, { width: 358, height: 52 }, { width: 398, height: 76 }]) {
    native.Platform.OS = OS;
    const Surface = load("../src/components/ui/ButtonSurface.tsx", {
      react: { useId: () => ":r1:", useState: () => [size, () => {}] },
    }).default;
    const tree = Surface({ variant: "danger" }), svg = nodes(tree).find(n => n.type === "Svg");
    assert.equal(tree.props.pointerEvents, "none"); assert.equal(tree.props.accessible, false);
    assert.equal(tree.props.accessibilityElementsHidden, true);
    assert.equal(nodes(tree).filter(n => n.type === "Path").length, 2, "one rim and one face");
    assert.equal(nodes(tree).filter(n => ["Rect", "Pressable", "Image"].includes(n.type)).length, 0);
    if (OS === "web") { assert.equal(svg.props["aria-hidden"], true); assert.equal(svg.props.accessible, undefined); }
    else assert.equal(svg.props.accessible, false);
    assert.equal(nodes(tree).find(n => n.type === "Path").props.d, surfaceModule.buttonBezelPath(size.width, size.height, 0.75));
    assert.ok(!nodes(tree).some(n => n.type === "Stop" && n.props.stopColor === "#204B3A"), "destructive surface has no emerald face");
  }
  delete native.Platform.OS;
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


test("whole-tab tile contains icon and label while route links, selection, events and focus callbacks survive", () => {
  const children = ["icon", "Home"]; let calls = 0;
  const wrapper = navigation.tabAppearance(0, 1).tabBarButton({ children, href: "/dashboard", role: "tab", "aria-selected": true,
    onPress: () => calls++, onLongPress: () => calls++, onFocus: () => calls++, onBlur: () => calls++ });
  const button = wrapper.type(wrapper.props);
  assert.equal(button.props.href, "/dashboard"); assert.equal(button.props.role, "tab"); assert.equal(button.props["aria-selected"], true);
  button.props.onPress(); button.props.onLongPress(); button.props.onFocus({}); button.props.onBlur({}); assert.equal(calls, 4);
  const tile = button.props.children;
  assert.equal(tile.props.children[1], children);
  assert.equal(flat(tile.props.style).backgroundColor, "transparent");
  assert.equal(flat(tile.props.style).borderWidth, 0);
  assert.equal(flat(tile.props.style).shadowOpacity, 0);
  assert.ok(flat(tile.props.style).minWidth < 70, "tile stays compact inside its full touch target");
});

test("native tab selection survives accessibilityState and focused native inputs receive no CSS outline", () => {
  for (const OS of ["ios", "android", "web"]) {
    native.Platform.OS = OS;
    let presses = 0;
    const state = { selected: true };
    const wrapper = navigation.tabAppearance(34, 1).tabBarButton({ children: ["icon", "Home"],
      accessibilityState: state, onPress: () => presses++ });
    const control = wrapper.type(wrapper.props);
    assert.equal(control.props.accessibilityState, state);
    control.props.onPress(); assert.equal(presses, 1);
    assert.equal(nodes(control).find(n => n.type === "FantasyMaterial").props.kind, "selected");
    assert.deepEqual(control.props.children.props.children[1], ["icon", "Home"]);
    const Input = load("../src/components/LifeInput.tsx", { react: { useState: () => [true, () => {}] } }).default;
    const input = Input({ tone: "parchment", value: "value" });
    const field = nodes(input).find(n => n.type === "TextInput");
    const frameStyle = flat(input.props.style), fieldStyle = flat(field.props.style);
    assert.equal(frameStyle.borderColor, theme.uiTheme.colors.focus);
    if (OS === "web") assert.equal(frameStyle.outlineWidth, 1);
    else {
      assert.ok(!Object.keys(frameStyle).some(key => key.startsWith("outline")));
      assert.ok(!Object.keys(fieldStyle).some(key => key.startsWith("outline")));
    }
  }
  delete native.Platform.OS;
});


test("illustrated inputs preserve secure entry, autofill, editing and focus callbacks above the decorative layer", () => {
  const Input = load("../src/components/LifeInput.tsx").default;
  const events = [];
  const tree = Input({ tone: "parchment", value: "sample", secureTextEntry: true,
    autoComplete: "current-password", textContentType: "password", returnKeyType: "done", accessibilityLabel: "Password",
    onChangeText: value => events.push(value), onSubmitEditing: () => events.push("submit"), onFocus: () => events.push("focus"), onBlur: () => events.push("blur") });
  const field = nodes(tree).find(n => n.type === "TextInput");
  assert.equal(field.props.value, "sample"); assert.equal(field.props.secureTextEntry, true);
  assert.equal(field.props.autoComplete, "current-password"); assert.equal(field.props.textContentType, "password");
  assert.equal(field.props.returnKeyType, "done"); assert.equal(field.props.accessibilityLabel, "Password");
  field.props.onChangeText("changed"); field.props.onSubmitEditing(); field.props.onFocus({}); field.props.onBlur({});
  assert.deepEqual(events, ["changed", "submit", "focus", "blur"]);
  assert.equal(flat(field.props.style).position, "relative"); assert.equal(flat(field.props.style).zIndex, 1);
  assert.equal(nodes(tree).find(n => n.type === "FantasyMaterial").props.kind, "input");
  assert.equal(Input({ tone: "legacy", value: "legacy" }).type, "TextInput", "legacy callers retain their existing host control");
});
