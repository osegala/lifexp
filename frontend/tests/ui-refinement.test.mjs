import * as dateFormat from "../src/utils/dateFormat.ts";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";
import { wardrobeTrayStops, nearestTrayStop } from "../src/avatar/tray.ts";
import * as theme from "../src/theme/theme.ts";

const require = createRequire(import.meta.url);
function load(path, imports) {
  const exports = {};
  const code = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), { compilerOptions: {
    jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, esModuleInterop: true,
  } }).outputText;
  new Function("require", "exports", code)(id => {
    if (id === "react/jsx-runtime") return require(id);
    if (id === "../../utils/focus") return { isFocusVisible: () => false };
    if (id === "./PaperTexture") return "PaperTexture";
    if (id === "./FantasyMaterial") return "FantasyMaterial";
    if (id === "./ButtonSurface") return { __esModule: true, default: "ButtonSurface", buttonHitArea: { backgroundColor: "transparent", borderWidth: 0, shadowOpacity: 0, elevation: 0 } };
    assert.ok(id in imports, `Missing mock ${id}`); return imports[id];
  }, exports);
  return exports;
}
const nodes = tree => Array.isArray(tree) ? tree.flatMap(nodes) : tree?.props ? [tree, ...nodes(tree.props.children)] : [];
const native = { ...Object.fromEntries(["View", "Text", "ScrollView", "KeyboardAvoidingView", "Pressable"].map(name => [name, name])),
  StyleSheet: { create: x => x }, Platform: { OS: "ios", select: x => x.ios } };
const flat = styles => Object.assign({}, ...styles.flat(Infinity).filter(Boolean));

function hooks() {
  let index = 0; const state = [];
  return { useState(initial) { const i = index++; if (!(i in state)) state[i] = initial;
    return [state[i], value => { state[i] = typeof value === "function" ? value(state[i]) : value; }]; },
    render(fn) { index = 0; return fn(); } };
}

test("keyboard-safe forms resize under the keyboard while their background and content own safe insets", () => {
  const { ScreenShell } = load("../src/components/ui/Primitives.tsx", {
    react: { useState: value => [value, () => {}] }, "react-native": native,
    "react-native-safe-area-context": { useSafeAreaInsets: () => ({ top: 59, bottom: 34 }) },
    "../../theme/theme": theme, "../LifeCard": "Card", "./PageBackground": "Background",
  });
  for (const [platform, behavior] of [["ios", "padding"], ["android", "height"]]) {
    native.Platform.OS = platform;
    const tree = ScreenShell({ children: "form", keyboardSafe: true });
    assert.equal(tree.type, "Background");
    const avoider = nodes(tree).find(n => n.type === "KeyboardAvoidingView");
    assert.equal(avoider.props.behavior, behavior); assert.equal(avoider.props.keyboardVerticalOffset, 0);
    const scroll = nodes(tree).find(n => n.type === "ScrollView");
    assert.equal(scroll.props.keyboardShouldPersistTaps, "handled");
    assert.equal(scroll.props.keyboardDismissMode, platform === "ios" ? "interactive" : "on-drag");
    assert.equal(flat(scroll.props.contentContainerStyle).paddingTop, 75);
    assert.equal(flat(scroll.props.contentContainerStyle).paddingBottom, 66);
    assert.equal(scroll.props.children, "form");
  }
});

test("wardrobe snap points stay ordered and preserve the scene on short, tall and large-text layouts", () => {
  for (const height of [220, 300, 420, 600, 900]) for (const fontScale of [1, 1.5, 2]) {
    const stops = wardrobeTrayStops(height, fontScale);
    assert.equal(stops.length, 3); assert.ok(stops[0] > 0);
    assert.ok(stops[0] <= stops[1] && stops[1] <= stops[2]);
    assert.ok(stops[2] < height);
    if (height >= 300) assert.ok(height - stops[2] >= 136);
    stops.forEach((point, index) => { if (stops.filter(value => value === point).length === 1) assert.equal(nearestTrayStop(point, stops), index); });
    assert.equal(nearestTrayStop(-1000, stops), 0);
    assert.equal(nearestTrayStop(10000, stops), 2);
  }
});

test("tray drags clamp and snap; handle taps and accessibility actions resize without touching list gestures", () => {
  let handlers; const changes = [];
  class Value { constructor(value) { this.value = value; } setValue(value) { this.value = value; } stopAnimation(done) { done(this.value); } }
  const Tray = load("../src/components/ui/ExpandableTray.tsx", {
    react: { useCallback: fn => fn, useEffect: fn => fn(), useMemo: fn => fn(), useRef: value => ({ current: value }) },
    "react-native": { ...native, PanResponder: { create: value => { handlers = value; return { panHandlers: { onTouchMove: "handle-only" } }; } },
      Animated: { View: "AnimatedView", Value, timing: (value, config) => ({ start() { value.setValue(config.toValue); }, stop() {} }) } },
    "@expo/vector-icons/MaterialCommunityIcons": "Icon", "../../avatar/tray": { nearestTrayStop }, "../../theme/theme": theme,
    "./Primitives": { UiPressable: "Button", UiText: "Text" },
  }).default;
  const tree = Tray({ stops: [108, 250, 400], index: 1, onChange: value => changes.push(value), children: "scrolling list" });
  const handle = nodes(tree).find(n => n.type === "Button");
  handle.props.onPress(); assert.equal(changes.at(-1), 2);
  handle.props.onAccessibilityAction({ nativeEvent: { actionName: "decrement" } }); assert.equal(changes.at(-1), 0);
  assert.equal(handlers.onMoveShouldSetPanResponder(null, { dy: 1, dx: 20 }), false);
  assert.equal(handlers.onMoveShouldSetPanResponderCapture(null, { dy: 20, dx: 1 }), true);
  handlers.onPanResponderGrant(); handlers.onPanResponderMove(null, { dy: -1000 });
  assert.equal(tree.props.style[1].height.value, 400);
  handlers.onPanResponderRelease(null, { vy: 0 }); assert.equal(changes.at(-1), 2);
  handlers.onPanResponderGrant(); handlers.onPanResponderMove(null, { dy: 1000 });
  assert.equal(tree.props.style[1].height.value, 108);
  handlers.onPanResponderTerminate(); assert.equal(changes.at(-1), 0);
  assert.equal(tree.props.children[2], "scrolling list");
  assert.equal(tree.props.onTouchMove, undefined, "drag responder belongs only to handle");
  native.Platform.OS = "web";
  const webTree = Tray({ stops: [108, 250, 400], index: 1, onChange: value => changes.push(value), children: "list" });
  const pointer = webTree.props.children[1].props;
  const webHandle = nodes(webTree).find(n => n.type === "Button");
  let captured;
  const down = y => pointer.onPointerDown({ nativeEvent: { pageY: y, pointerId: 7 }, currentTarget: { setPointerCapture: id => { captured = id; } } });
  down(300); pointer.onPointerMove({ nativeEvent: { pageY: 650 } }); pointer.onPointerUp();
  assert.equal(captured, 7); assert.equal(changes.at(-1), 0);
  down(300); pointer.onPointerUp(); assert.equal(changes.at(-1), 2);
  const count = changes.length;
  webHandle.props.onPress({ nativeEvent: { detail: 1 } }); assert.equal(changes.length, count, "pointer release must not also activate click");
  webHandle.props.onPress({ nativeEvent: { detail: 0 } }); assert.equal(changes.length, count + 1, "keyboard and assistive clicks still activate");
  assert.equal(pointer.onTouchMove, undefined, "native responder is not attached on web");

});

function authScreen(name, auth) {
  const h = hooks(); const routes = [];
  const Screen = load(`../app/${name}.tsx`, {
    react: h, "react-native": native, "expo-router": { router: { replace: x => routes.push(x), push: x => routes.push(x) } },
    "../src/components/ui/AuthFrame": "Frame", "../src/components/LifeButton": "Button", "../src/components/LifeInput": "Input",
    "../src/components/ui/Buttons": { PrimaryButton: "Button", SecondaryButton: "Button" },
    "../src/context/AuthContext": { useAuth: () => auth }, "../src/auth/errors": { authErrorMessage: () => "Try again" }, "../src/theme/theme": theme,
  }).default;
  const render = () => h.render(Screen);
  return { render, routes, fill(label, value) { const input = nodes(render()).find(n => n.type === "Input" && n.props.accessibilityLabel === label); assert.ok(input); input.props.onChangeText(value); },
    async press(title) { const action = nodes(render()).find(n => n.type === "Button" && n.props.title === title); assert.ok(action); assert.ok(!action.props.disabled); await action.props.onPress(); } };
}

test("restyled sign-in keeps trimming, validation, Cognito callback and existing destination", async () => {
  const calls = []; const ui = authScreen("login", { login: async (...args) => calls.push(args), sessionNotice: "" });
  await ui.press("Enter Evrenthia"); assert.equal(calls.length, 0);
  ui.fill("Email", " hero@example.test "); ui.fill("Password", "fixture-only");
  await ui.press("Enter Evrenthia");
  assert.deepEqual(calls, [["hero@example.test", "fixture-only"]]); assert.deepEqual(ui.routes, ["/"]);
});

test("restyled registration retains entered credentials for email confirmation and never creates a profile", async () => {
  const calls = []; const ui = authScreen("register", {
    register: async (...args) => { calls.push(["register", ...args]); return "CONFIRM_SIGN_UP"; },
    confirmRegistration: async (...args) => calls.push(["confirm", ...args]), login() { throw new Error("Confirmation owns login"); },
  });
  ui.fill("Display name", " Rowan "); ui.fill("Email", " hero@example.test "); ui.fill("Password", "Fixture-only-123!");
  await ui.press("Create account");
  assert.equal(ui.render().props.title, "Check your email");
  const fields = nodes(ui.render()).filter(n => n.type === "Input");
  assert.deepEqual(fields.map(n => n.props.accessibilityLabel), ["Email confirmation code"]);
  ui.fill("Email confirmation code", " 123456 "); await ui.press("Confirm Account");
  assert.deepEqual(calls, [["register", "Rowan", "hero@example.test", "Fixture-only-123!", "BOY"], ["confirm", "hero@example.test", "123456", "Fixture-only-123!"]]);
  assert.deepEqual(ui.routes, ["/"]);
});


test("schedule fields display friendly dates and clocks while callbacks retain canonical save values and invalid drafts", () => {
  for (const [kind, initial, draft, canonical] of [["time", "09:00", "10:45 PM", "22:45"], ["date", "2026-10-20", "Oct 21, 2026", "2026-10-21"]]) {
    const h = hooks(); let value = initial;
    const Input = load("../src/components/ScheduleInput.tsx", { react: h, "./LifeInput": "Input", "../utils/dateFormat": dateFormat }).default;
    const render = () => h.render(() => Input({ kind, value, onChangeText: next => { value = next; } }));
    assert.doesNotMatch(render().props.value, /^\d{4}-\d{2}-\d{2}$|^\d{2}:\d{2}$/);
    render().props.onChangeText(draft); assert.equal(value, canonical); assert.equal(render().props.value, draft);
    render().props.onBlur({}); assert.equal(render().props.value, draft);
    render().props.onChangeText("invalid draft"); assert.equal(value, "invalid draft"); assert.equal(render().props.value, "invalid draft");
    value = ""; assert.equal(render().props.value, "", "external reset clears the display too");
  }
});
