import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
import * as notices from "../src/feedback/notices.ts";
import * as theme from "../src/theme/theme.ts";

const require = createRequire(import.meta.url);
function load(path, imports) {
  const exports = {};
  const code = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText;
  new Function("exports", "require", code)(exports, id => {
    if (id === "react/jsx-runtime") return require(id);
    if (!(id in imports)) throw new Error(`Unmocked import: ${id}`);
    return imports[id];
  });
  return exports;
}
function hooks() {
  let cursor = 0;
  const state = [], effects = [];
  const react = {
    useState(initial) {
      const key = cursor++;
      if (!(key in state)) state[key] = typeof initial === "function" ? initial() : initial;
      return [state[key], value => { state[key] = typeof value === "function" ? value(state[key]) : value; }];
    },
    useRef: initial => react.useState({ current: initial })[0],
    useEffect: fn => effects.push(fn),
    useSyncExternalStore: (_, get) => get(),
  };
  return { react, effects, render: fn => { cursor = 0; effects.length = 0; return fn(); } };
}
function nodes(tree) {
  return Array.isArray(tree) ? tree.flatMap(nodes) : tree?.props ? [tree, ...nodes(tree.props.children)] : [];
}
const text = tree => typeof tree === "string" || typeof tree === "number" ? String(tree) : Array.isArray(tree)
  ? tree.map(text).join("") : tree?.props ? text(tree.props.children) : "";
const native = { View: "View", Text: "Text", Pressable: "Pressable", StyleSheet: { create: v => v, absoluteFill: {} } };
const tick = () => new Promise(setImmediate);

// These are presentation-store tests; no task, profile or billing model is mocked or written.
test("notice FIFO keeps actual messages, stale dismiss cannot drop another, and account cleanup empties all", () => {
  notices.clearGameNotices();
  let updates = 0;
  const stop = notices.subscribeGameNotices(() => updates++);
  notices.showGameNotice("Saved", "Rowan", "success");
  const first = notices.getGameNotices().pending[0];
  notices.showGameNotice("Connection lost", "Try again", "error");
  const second = notices.getGameNotices().pending[1];
  assert.equal(first.duration, 6000);
  assert.equal(second.duration, 8000);
  assert.equal(second.message, "Try again");
  notices.dismissGameNotice(first.id);
  notices.dismissGameNotice(first.id);
  assert.deepEqual(notices.getGameNotices().pending, [second]);
  notices.setGameFeedbackActive("completion", true);
  notices.setGameFeedbackActive("completion", true);
  notices.setGameFeedbackActive("upgrade", true);
  assert.deepEqual(notices.getGameNotices().blockers, ["completion", "upgrade"]);
  notices.setGameFeedbackActive("completion", false);
  assert.deepEqual(notices.getGameNotices().blockers, ["upgrade"]);
  notices.clearGameNotices();
  assert.deepEqual(notices.getGameNotices(), { pending: [], blockers: [] });
  assert.ok(updates > 0);
  stop(); const count = updates;
  notices.showGameNotice("Unsubscribed");
  assert.equal(updates, count);
  notices.clearGameNotices();
});

test("host waits behind reward feedback, auto-dismisses FIFO, announces errors and cancels stale timers", t => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  notices.clearGameNotices();
  const h = hooks();
  const Host = load("../src/components/GameNoticeHost.tsx", { react: h.react,
    "react-native": { ...native, Platform: { OS: "web" } }, "../feedback/notices": notices,
    "./ui/GameNotice": { __esModule: true, default: "Card", GameNoticeOverlay: "Overlay" },
  }).default;
  const render = () => h.render(() => Host({ scope: "one", placement: "lower" }));
  render(); const cleanupSession = h.effects[0]();
  notices.showGameNotice("Saved", "Changes saved", "success");
  notices.showGameNotice("Offline", "Your changes remain", "error");
  notices.setGameFeedbackActive("completion", true);
  assert.equal(nodes(render()).find(n => n.type === "Card"), undefined);
  assert.equal(h.effects[1](), undefined);
  t.mock.timers.tick(9000);
  assert.equal(notices.getGameNotices().pending.length, 2);
  notices.setGameFeedbackActive("completion", false);
  let tree = render();
  assert.equal(nodes(tree).find(n => n.type === "Overlay").props.placement, "lower");
  assert.match(text(nodes(tree).find(n => n.props.role === "status")), /Saved/);
  const cleanupFirst = h.effects[1]();
  t.mock.timers.tick(5999); assert.equal(notices.getGameNotices().pending.length, 2);
  t.mock.timers.tick(1); assert.equal(notices.getGameNotices().pending.length, 1);
  cleanupFirst(); tree = render();
  assert.match(text(nodes(tree).find(n => n.props.role === "alert")), /Offline.*Your changes remain/);
  const cleanupSecond = h.effects[1](); cleanupSecond();
  t.mock.timers.tick(9000);
  assert.equal(notices.getGameNotices().pending.length, 1, "unmount cancels auto-dismiss");
  nodes(tree).find(n => n.type === "Card").props.onDismiss();
  assert.equal(notices.getGameNotices().pending.length, 0);
  notices.showGameNotice("Previous account"); cleanupSession();
  assert.equal(notices.getGameNotices().pending.length, 0);
});

function cardUI({ reduced = false, os = "web", fontScale = 1 } = {}) {
  const h = hooks(), announced = [], animations = [], values = [];
  let removed = 0;
  const components = load("../src/components/ui/GameNotice.tsx", { react: h.react,
    "react-native": { ...native, Platform: { OS: os }, useWindowDimensions: () => ({ fontScale }),
      AccessibilityInfo: { isReduceMotionEnabled: async () => reduced,
        addEventListener: () => ({ remove() { removed++; } }), announceForAccessibility: v => announced.push(v) },
      Animated: { View: "AnimatedView", Value: class { setValue(v) { values.push(v); } interpolate(config) { return config; } },
        timing: (_, config) => { const animation = { ...config, stopped: false, start() {}, stop() { this.stopped = true; } }; animations.push(animation); return animation; } },
    },
    "@expo/vector-icons/MaterialCommunityIcons": "Icon", "react-native-safe-area-context": { useSafeAreaInsets: () => ({ top: 47, bottom: 34 }) },
    "../../theme/theme": theme, "./FantasyMaterial": "Material",
  });
  return { h, ...components, announced, animations, values, removed: () => removed };
}

test("shared variants render actual rewards, semantic announcements, accessible dismissal and safe-area placement", () => {
  const ui = cardUI();
  for (const variant of ["success", "info", "error", "warning"]) {
    const tree = ui.h.render(() => ui.default({ title: "Confirmed", message: "Read a chapter", variant, rewards: { xp: 47, coins: 7, worldPoints: 0 }, onDismiss() {} }));
    assert.match(text(tree), /\+47 XP.*\+7 coins.*\+0 World Points/);
    const live = nodes(tree).find(n => n.props["aria-live"]);
    assert.equal(live.props.role, variant === "error" ? "alert" : "status");
    assert.equal(live.props["aria-live"], variant === "error" ? "assertive" : "polite");
    assert.match(text(live), /47 XP.*7 coins.*0 World Points/);
    const dismiss = nodes(tree).find(n => n.props.accessibilityRole === "button");
    assert.equal(dismiss.props.style.width, 44);
    assert.equal(dismiss.props.accessibilityLabel, "Dismiss notification");
    const icon = nodes(tree).find(n => n.type === "Icon");
    assert.equal(icon.props.accessible, false);
    assert.notEqual(icon.props.name, undefined);
  }
  assert.equal(ui.GameNoticeOverlay({ children: null }).props.style[1].top, 119);
  assert.equal(ui.GameNoticeOverlay({ children: null, placement: "lower" }).props.style[1].bottom, 34 + theme.uiTheme.size.tabBar + 12);
  const enlarged = cardUI({ fontScale: 2 });
  assert.equal(enlarged.GameNoticeOverlay({ children: null, placement: "lower" }).props.style[1].bottom,
    34 + theme.uiTheme.size.tabBar + theme.uiTheme.type.tab.lineHeight + 12);
});

test("card uses restrained entrance/exit, native announcement, reduced motion and complete timer/listener cleanup", async t => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  for (const reduced of [false, true]) {
    const ui = cardUI({ reduced, os: "ios" });
    const render = () => ui.h.render(() => ui.default({ title: "Saved", message: "Profile saved", duration: 6000 }));
    render(); const cleanupListener = ui.h.effects[0](); ui.h.effects[1]();
    assert.equal(ui.h.effects[2](), undefined, "wait for motion preference before starting entrance");
    await tick(); render(); const cleanupMotion = ui.h.effects[2]();
    assert.deepEqual(ui.announced, ["Information. Saved. Profile saved"]);
    assert.equal(ui.animations.length, reduced ? 0 : 1);
    if (!reduced) {
      assert.equal(ui.animations[0].duration, 160);
      t.mock.timers.tick(5820);
      assert.equal(ui.animations[1].duration, 180);
      cleanupMotion(); assert.ok(ui.animations.every(a => a.stopped));
    } else assert.equal(ui.values.at(-1), 1);
    cleanupListener(); assert.equal(ui.removed(), 1);
  }
  const ui = cardUI();
  ui.h.render(() => ui.default({ title: "Early dismissal", duration: 6000 }));
  ui.h.effects[0](); await tick(); ui.h.render(() => ui.default({ title: "Early dismissal", duration: 6000 }));
  const cleanup = ui.h.effects[2](); cleanup();
  t.mock.timers.tick(6000); assert.equal(ui.animations.length, 1, "dismissed notices cannot start a late exit");
});
