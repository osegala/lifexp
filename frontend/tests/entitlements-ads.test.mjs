import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
import * as model from "../src/entitlements/model.ts";
import * as adsModel from "../src/ads/model.ts";
import * as theme from "../src/theme/theme.ts";
// Use the real controller; transpilation resolves its extensionless imports without a runtime loader.
const require = createRequire(import.meta.url);
const premium = { ...model.FREE_ENTITLEMENTS, plan: "PREMIUM", premium: true, adsEnabled: false, subscriptionStatus: "ACTIVE", source: "TEST" };
function load(path, imports) {
  const exports = {};
  const code = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } }).outputText;
  new Function("require", "exports", code)(id => id === "react/jsx-runtime" ? require(id) : id in imports ? imports[id] : (() => { throw new Error(`Missing ${id}`); })(), exports);
  return exports;
}
const react = { useCallback: fn => fn, useEffect() {}, useRef: value => ({ current: value }),
  useState: value => [typeof value === "function" ? value() : value, () => {}], useSyncExternalStore: (_, get) => get(),
  createContext: value => ({ value, Provider: "Provider" }), useContext: c => c.value };
const native = { ...Object.fromEntries(["View", "Text", "ScrollView", "Pressable"].map(name => [name, name])), StyleSheet: { create: x => x } };
const nodes = tree => Array.isArray(tree) ? tree.flatMap(nodes) : tree?.props ? [tree, ...nodes(tree.props.children)] : [];
const text = tree => typeof tree === "string" ? tree : Array.isArray(tree) ? tree.map(text).join("") : tree?.props ? text(tree.props.children) : "";

test("canonical UI normalization accepts existing server responses but never device time or unknown status as authority", () => {
  assert.deepEqual(model.normalizeEntitlements({ plan: "FREE", subscriptionStatus: "FREE" }), model.FREE_ENTITLEMENTS);
  assert.equal(model.isPremium(model.normalizeEntitlements(premium)), true);
  assert.equal(model.shouldShowAds(premium), false);
  assert.equal(model.shouldShowAds(model.FREE_ENTITLEMENTS), true);
  for (const v of [null, { ...premium, subscriptionStatus: "UNKNOWN" }, { ...premium, expiresAt: "invalid" }, { ...premium, adsEnabled: true }, { ...model.FREE_ENTITLEMENTS, premium: true }]) assert.throws(() => model.normalizeEntitlements(v));
  assert.equal(model.normalizeEntitlements({ plan: "FREE", subscriptionStatus: "EXPIRED", expiresAt: "2000-01-01" }).premium, false);
  // Expiry is interpreted by the server; a bad device clock must not turn on ads for Premium.
  assert.equal(model.normalizeEntitlements({ ...premium, expiresAt: "2000-01-01" }).premium, true);
});

test("ad configuration has no live mode and cannot enable even placeholders in a production build/environment", () => {
  assert.equal(adsModel.resolveAdMode(undefined, "dev", true), "disabled");
  assert.equal(adsModel.resolveAdMode("placeholder", "dev", true), "placeholder");
  for (const [value, env, dev] of [["live", "dev", true], ["placeholder", "prod", true], ["placeholder", "dev", false]]) assert.equal(adsModel.resolveAdMode(value, env, dev), "disabled");
});

function adFixture() {
  let context;
  const auth = { user: { id: "tester", onboardingCompleted: true }, loading: false, entitlements: model.FREE_ENTITLEMENTS,
    entitlementsLoading: false, entitlementsConfirmed: true, entitlementsError: null, refreshEntitlements: async () => true };
  const state = { route: "/dashboard", feedback: false, auth };
  const hook = load("../src/entitlements/useEntitlements.ts", { "../context/AuthContext": { useAuth: () => auth }, "./model": model }).useEntitlements;
  globalThis.__DEV__ = true;
  const ads = load("../src/ads/Ads.tsx", { react: { ...react, createContext: value => (context = react.createContext(value)) },
    "expo-router": { usePathname: () => state.route }, "react-native": native,
    "../context/AuthContext": { useAuth: () => auth }, "../context/CompletionFeedbackContext": { useFeedbackActive: () => state.feedback },
    "../entitlements/useEntitlements": { useEntitlements: hook }, "../entitlements/model": model,
    "../config/environment": { environment: { environment: "dev" } }, "../components/LifeCard": "Card", "../components/LifeButton": "Button",
    "../theme/theme": theme, "./model": adsModel, "./adapter": { devAdAdapter: {} },
    "./rewarded": load("../src/ads/rewarded.ts", { "../api/errors": load("../src/api/errors.ts", {}) }) });
  state.render = placement => { context.value = ads.AdProvider({ children: null }).props.value; return ads.BannerAdPlacement({ placement }); };
  state.ads = ads;
  return state;
}

test("actual provider and banner render only confirmed FREE at an allowed placement; Premium/loading/failure/onboarding are hidden", t => {
  const old = process.env.EXPO_PUBLIC_ADS_MODE; process.env.EXPO_PUBLIC_ADS_MODE = "placeholder";
  t.after(() => { if (old === undefined) delete process.env.EXPO_PUBLIC_ADS_MODE; else process.env.EXPO_PUBLIC_ADS_MODE = old; delete globalThis.__DEV__; });
  const f = adFixture(); assert.match(text(f.render("HOME")), /No ad network is connected/);
  assert.match(f.render("HOME").props.accessibilityLabel, /DEV only/);
  f.auth.entitlements = premium; assert.equal(f.render("HOME"), null);
  f.auth.entitlements = model.FREE_ENTITLEMENTS;
  for (const field of ["loading", "entitlementsLoading"]) { f.auth[field] = true; assert.equal(f.render("HOME"), null); f.auth[field] = false; }
  f.auth.entitlementsConfirmed = false; assert.equal(f.render("HOME"), null); f.auth.entitlementsConfirmed = true;
  f.auth.user.onboardingCompleted = false; assert.equal(f.render("HOME"), null); f.auth.user.onboardingCompleted = true;
  f.auth.user = null; assert.equal(f.render("HOME"), null);
  assert.equal(f.ads.InterstitialAdPlacement(), null);
});

test("DEV placeholders clearly identify Home and Shop slots without changing eligibility or live-ad safety", t => {
  const old = process.env.EXPO_PUBLIC_ADS_MODE; process.env.EXPO_PUBLIC_ADS_MODE = "placeholder";
  t.after(() => { if (old === undefined) delete process.env.EXPO_PUBLIC_ADS_MODE; else process.env.EXPO_PUBLIC_ADS_MODE = old; delete globalThis.__DEV__; });
  const f = adFixture();
  for (const [placement, route, label] of [["HOME", "/dashboard", "Home"], ["SHOP", "/shop", "Shop"]]) {
    f.route = route;
    const banner = f.render(placement);
    assert.match(text(banner), new RegExp(`Ad placement — DEV only${label} banner`));
    assert.match(banner.props.accessibilityLabel, new RegExp(`${label} banner`));
    assert.equal(banner.props.style.minHeight, 100); assert.equal(banner.props.style.borderWidth, 2);
    assert.equal(banner.props.style.backgroundColor, theme.colors.cardLight);
    f.auth.entitlements = premium; assert.equal(f.render(placement), null); f.auth.entitlements = model.FREE_ENTITLEMENTS;
    f.auth.entitlementsLoading = true; assert.equal(f.render(placement), null); f.auth.entitlementsLoading = false;
    f.auth.entitlementsConfirmed = false; assert.equal(f.render(placement), null); f.auth.entitlementsConfirmed = true;
    f.feedback = true; assert.equal(f.render(placement), null); f.feedback = false;
  }
  delete process.env.EXPO_PUBLIC_ADS_MODE; assert.equal(f.render("SHOP"), null);
  assert.equal(f.ads.InterstitialAdPlacement(), null);
});

test("route and feedback guards exclude authentication, onboarding, editors, permission flows, completion and building celebration", t => {
  const old = process.env.EXPO_PUBLIC_ADS_MODE; process.env.EXPO_PUBLIC_ADS_MODE = "placeholder";
  t.after(() => { if (old === undefined) delete process.env.EXPO_PUBLIC_ADS_MODE; else process.env.EXPO_PUBLIC_ADS_MODE = old; delete globalThis.__DEV__; });
  const f = adFixture();
  for (const route of ["/onboarding", "/login", "/register", "/avatar", "/tasks", "/profile", "/base", "/premium"]) {
    f.route = route; assert.equal(f.render("HOME"), null); assert.equal(f.render("SHOP"), null);
  }
  f.route = "/shop"; assert.ok(f.render("SHOP")); assert.equal(f.render("HOME"), null);
  f.feedback = true; assert.equal(f.render("SHOP"), null); f.route = "/dashboard"; assert.equal(f.render("HOME"), null);
  for (const path of ["../app/onboarding.tsx", "../src/components/TaskEditor.tsx", "../src/components/AppearanceEditor.tsx", "../src/components/NotificationSettings.tsx", "../src/components/CompletionFeedback.tsx", "../src/components/BuildingUpgradeFeedback.tsx"]) {
    assert.doesNotMatch(readFileSync(new URL(path, import.meta.url), "utf8"), /BannerAdPlacement|RewardedAdButton|InterstitialAdPlacement|useAds/);
  }
  for (const [path, placement] of [["../app/(tabs)/dashboard.tsx", "HOME"], ["../app/(tabs)/shop.tsx", "SHOP"]]) {
    const source = readFileSync(new URL(path, import.meta.url), "utf8");
    assert.equal(source.match(/<BannerAdPlacement /g).length, 1);
    assert.match(source, new RegExp(`<BannerAdPlacement placement="${placement}" />${placement === "SHOP" ? "\\s*<RewardedAdButton[\\s\\S]*?/>": ""}\\s*</ScrollView>`));
  }
});

function screen(path, entitlement) {
  const calls = [];
  const Screen = load(path, { react, "react-native": native, "expo-router": { useFocusEffect() {}, router: { push: x => calls.push(x), replace: x => calls.push(x), navigate() {} } },
    "@expo/vector-icons/MaterialCommunityIcons": "Icon", "../../src/context/AuthContext": { useAuth: () => ({ user: { username: "Hero", timeZone: "UTC" } }) },
    "../../src/api/client": {}, "../../src/api/routes": {}, "../../src/storage/localAccountData": {}, "../../src/notifications/device": {},
    "../../src/components/NotificationSettings": "Notifications", "../../src/components/XPBar": "XPBar", "../../src/components/LifeInput": "Input",
    ...Object.fromEntries(["../src", "../../src"].flatMap(prefix => [
      [`${prefix}/entitlements/useEntitlements`, { useEntitlements: () => entitlement }], [`${prefix}/theme/theme`, theme],
      [`${prefix}/components/LifeCard`, "Card"], [`${prefix}/components/LifeButton`, "Button"],
    ])) }).default;
  return { tree: Screen(), calls };
}

test("Profile shows server-derived Free Plan/Upgrade and Premium/Ad-free with the same Premium entry route", () => {
  for (const e of [model.FREE_ENTITLEMENTS, premium]) {
    const ui = screen("../app/(tabs)/profile.tsx", { ...e, confirmed: true });
    assert.match(text(ui.tree), e.premium ? /PremiumAd-free/ : /Free Plan/);
    const entry = nodes(ui.tree).find(n => n.props.title === (e.premium ? "View Premium" : "Upgrade to Premium"));
    assert.ok(entry); entry.props.onPress(); assert.deepEqual(ui.calls, ["/premium"]);
  }
});

test("Premium page never simulates purchase/restore or claims confirmation during failure/loading; refresh and back work", () => {
  for (const e of [{ ...model.FREE_ENTITLEMENTS, confirmed: true }, { ...premium, confirmed: true }, { ...model.FREE_ENTITLEMENTS, confirmed: false, loading: true }, { ...model.FREE_ENTITLEMENTS, confirmed: false, error: "Could not check your plan." }]) {
    let refreshed = 0;
    const ui = screen("../app/premium.tsx", { ...e, refresh: () => { refreshed++; } });
    assert.match(text(ui.tree), /Evrenthia Premium.*No ads.*Purchases are not available/s);
    const purchase = nodes(ui.tree).find(n => n.props.title === "Purchases unavailable"); assert.equal(purchase.props.disabled, true);
    const refresh = nodes(ui.tree).find(n => n.props.title?.includes("plan") && n.type === "Button"); refresh.props.onPress(); assert.equal(refreshed, 1);
    nodes(ui.tree).find(n => n.props.title === "Back to Profile").props.onPress(); assert.deepEqual(ui.calls, ["/(tabs)/profile"]);
    assert.match(text(ui.tree), e.confirmed ? /Your plan is confirmed/ : /has not yet been confirmed/);
    assert.equal(nodes(ui.tree).some(n => n.props.title === "Restore Purchases"), false);
  }
});
