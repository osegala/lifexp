import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
import { apiError } from "../src/api/errors.ts";
import { apiRoutes } from "../src/api/routes.ts";
import * as model from "../src/entitlements/model.ts";
import * as adsModel from "../src/ads/model.ts";
import * as theme from "../src/theme/theme.ts";

const require = createRequire(import.meta.url);
function load(path, imports) {
  const exports = {};
  const code = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } }).outputText;
  new Function("require", "exports", code)(id => id === "react/jsx-runtime" ? require(id) : id in imports ? imports[id] : (() => { throw new Error(`Missing ${id}`); })(), exports);
  return exports;
}
const rewarded = load("../src/ads/rewarded.ts", { "../api/errors": { apiError } });
const status = (used = 0) => ({ rewardCoins: 10, coins: 40 + used * 10, rewardedAdsUsedToday: used,
  rewardedAdsRemainingToday: 3 - used, date: "2026-10-08", timeZone: "America/New_York", available: true });
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const nodes = tree => Array.isArray(tree) ? tree.flatMap(nodes) : tree?.props ? [tree, ...nodes(tree.props.children)] : [];
const text = tree => typeof tree === "string" ? tree : Array.isArray(tree) ? tree.map(text).join("") : tree?.props ? text(tree.props.children) : "";
function fixture(overrides = {}) {
  const calls = []; let used = 0;
  const adapter = { loadBanner: () => "placeholder",
    getRewardStatus: async () => { calls.push("status"); return status(used); },
    showRewarded: async () => { calls.push("prepare"); return { providerEventId: "server-receipt", devSimulation: true }; },
    verifyRewardedCompletion: async event => { calls.push(event); return { ...status(++used), duplicate: false }; }, ...overrides };
  const flow = new rewarded.RewardedAds(adapter); flow.setScope("user", true);
  return { flow, calls, adapter };
}

test("DEV opt-in prepares but never grants before explicit completion; cancellation and disabled scopes make no claim", async () => {
  const { flow, calls } = fixture();
  await flow.refresh(); await flow.request();
  assert.equal(flow.getSnapshot().phase, "ready"); assert.equal(flow.getSnapshot().status.coins, 40);
  assert.deepEqual(calls, ["status", "prepare"]);
  flow.cancel(); assert.equal(await flow.complete(), null);
  flow.setScope("user", false); await flow.request(); await flow.refresh();
  assert.deepEqual(calls, ["status", "prepare"]);
});

test("confirmed server totals/counts update through all three rewards, then the fourth request is disabled", async () => {
  const { flow, calls } = fixture(); await flow.refresh();
  for (let used = 1; used <= 3; used++) {
    await flow.request(); const result = await flow.complete();
    assert.deepEqual(result, { ...status(used), duplicate: false });
    assert.equal(flow.getSnapshot().status.rewardedAdsRemainingToday, 3 - used);
  }
  await flow.request(); assert.equal(calls.filter(x => x === "prepare").length, 3);
  assert.equal(flow.getSnapshot().status.coins, 70);
});

test("same-tick taps do not double-submit, and timeout retries preserve the identical receipt without guessing coins", async () => {
  const prepare = deferred(), claim = deferred(); let attempts = 0;
  const { flow, calls } = fixture({ showRewarded: async () => { calls.push("prepare"); return prepare.promise; },
    verifyRewardedCompletion: async event => { calls.push(event); return ++attempts === 1 ? claim.promise : { ...status(1), duplicate: true }; } });
  await flow.refresh(); const a = flow.request(), b = flow.request();
  assert.equal(calls.filter(x => x === "prepare").length, 1);
  prepare.resolve({ providerEventId: "stable-receipt", devSimulation: true }); await Promise.all([a, b]);
  const c = flow.complete(), d = flow.complete(); assert.equal(calls.filter(x => x === "stable-receipt").length, 1);
  claim.reject(new Error("timeout")); await Promise.all([c, d]);
  assert.equal(flow.getSnapshot().status.coins, 40); assert.equal(flow.getSnapshot().phase, "ready");
  assert.match(flow.getSnapshot().error, /Retry this same completion/);
  assert.equal((await flow.complete()).coins, 50);
  assert.deepEqual(calls.filter(x => x === "stable-receipt"), ["stable-receipt", "stable-receipt"]);
});

test("account changes and disposal discard late rewards; feedback/Premium suppression prevents new provider requests", async () => {
  const pending = deferred(); const { flow, calls } = fixture({ verifyRewardedCompletion: async () => pending.promise });
  await flow.refresh(); await flow.request(); const claim = flow.complete();
  flow.setScope("other-user", false); pending.resolve({ ...status(1), duplicate: false });
  assert.equal(await claim, null); assert.equal(flow.getSnapshot().status, null);
  await flow.request(); await flow.refresh(); assert.deepEqual(calls, ["status", "prepare"]);
  flow.dispose(); flow.setScope("user", true); await flow.refresh(); assert.equal(flow.getSnapshot().phase, "idle");
});

test("unconfirmed/malformed allowance fails closed; server cap reached on another device updates the exhausted CTA", async () => {
  const f = fixture({ getRewardStatus: async () => ({ ...status(), rewardedAdsRemainingToday: 99 }) });
  await f.flow.refresh(); await f.flow.request(); assert.equal(f.flow.getSnapshot().status, null); assert.deepEqual(f.calls, []);
  f.adapter.getRewardStatus = async () => status();
  f.adapter.verifyRewardedCompletion = async () => { throw { response: { data: { error: {
    code: "AD_DAILY_LIMIT", message: "Daily ad rewards claimed.", details: status(3),
  } } } }; };
  await f.flow.refresh(); await f.flow.request(); assert.equal(await f.flow.complete(), null);
  assert.equal(f.flow.getSnapshot().phase, "idle"); assert.equal(f.flow.getSnapshot().status.rewardedAdsRemainingToday, 0);
});

function uiFixture(t) {
  const old = process.env.EXPO_PUBLIC_ADS_MODE; process.env.EXPO_PUBLIC_ADS_MODE = "placeholder"; globalThis.__DEV__ = true;
  t.after(() => { if (old === undefined) delete process.env.EXPO_PUBLIC_ADS_MODE; else process.env.EXPO_PUBLIC_ADS_MODE = old; delete globalThis.__DEV__; });
  const f = fixture(); const effects = []; let context;
  const state = { route: "/shop", feedback: false, loading: false, user: { id: "user", onboardingCompleted: true },
    entitlements: { ...model.FREE_ENTITLEMENTS, confirmed: true, loading: false } };
  const ads = load("../src/ads/Ads.tsx", {
    react: { useState: () => [f.flow], useEffect: fn => effects.push(fn), useSyncExternalStore: (_, get) => get(),
      createContext: value => (context = { value, Provider: "Provider" }), useContext: c => c.value },
    "expo-router": { usePathname: () => state.route }, "react-native": { Text: "Text", AppState: { currentState: "active", addEventListener: () => ({ remove() {} }) }, StyleSheet: { create: x => x } },
    "../context/AuthContext": { useAuth: () => state }, "../context/CompletionFeedbackContext": { useFeedbackActive: () => state.feedback },
    "../entitlements/useEntitlements": { useEntitlements: () => state.entitlements }, "../entitlements/model": model,
    "../config/environment": { environment: { environment: "dev" } }, "../components/LifeCard": "Card", "../components/LifeButton": "Button",
    "../theme/theme": theme, "./model": adsModel, "./adapter": { devAdAdapter: f.adapter }, "./rewarded": rewarded,
    "./native": load("../src/ads/native.tsx", {}),
  });
  const render = onReward => { effects.length = 0; context.value = ads.AdProvider({ children: null }).props.value; return ads.RewardedAdButton({ onReward }); };
  return { ...f, state, ads, render, effects };
}

test("real provider/CTA show only FREE Shop, remain absent in protected flows, and issue no requests when ineligible", async t => {
  const f = uiFixture(t); await f.flow.refresh();
  let tree = f.render(); assert.match(text(tree), /Rewarded ad — DEV only.*3 ad rewards remaining/s);
  assert.equal(nodes(tree).find(n => n.props.title === "Watch an ad for 10 coins").props.disabled, false);
  const checkHidden = async () => {
    assert.equal(f.render(), null); const cleanup = f.effects[0](); cleanup?.();
    await f.flow.request(); assert.equal(f.calls.includes("prepare"), false);
  };
  f.state.entitlements = { ...model.FREE_ENTITLEMENTS, premium: true, adsEnabled: false, confirmed: true }; await checkHidden();
  f.state.entitlements = { ...model.FREE_ENTITLEMENTS, confirmed: true, loading: true }; await checkHidden();
  f.state.entitlements.loading = false; f.state.entitlements.confirmed = false; await checkHidden(); f.state.entitlements.confirmed = true;
  for (const route of ["/dashboard", "/onboarding", "/login", "/avatar", "/tasks", "/profile", "/premium"]) { f.state.route = route; await checkHidden(); }
  f.state.route = "/shop"; f.state.feedback = true; await checkHidden(); f.state.feedback = false;
  f.state.user.onboardingCompleted = false; await checkHidden();
  assert.deepEqual(f.calls, ["status"]);
});

test("real DEV controls support cancellation, explicit completion, loading, announced confirmation, and exhausted state", async t => {
  const f = uiFixture(t); await f.flow.refresh(); await f.flow.request(); let confirmed;
  let tree = f.render(result => { confirmed = result; });
  assert.match(text(tree), /Closing this without completing grants no coins/);
  nodes(tree).find(n => n.props.title === "Complete DEV rewarded ad").props.onPress(); await new Promise(resolve => setImmediate(resolve));
  assert.equal(confirmed.coins, 50); assert.equal(confirmed.rewardedAdsRemainingToday, 2);
  tree = f.render(); assert.equal(nodes(tree).find(n => n.props.accessibilityLiveRegion === "polite").props.children, "10 coins confirmed by Evrenthia.");
  await f.flow.request(); nodes(f.render()).find(n => n.props.title === "Cancel DEV ad").props.onPress(); assert.equal(f.flow.getSnapshot().phase, "idle");
  for (let used = 2; used <= 3; used++) { await f.flow.request(); await f.flow.complete(); }
  tree = f.render(); assert.equal(nodes(tree).find(n => n.props.title === "Daily ad rewards claimed").props.disabled, true);
  const button = readFileSync(new URL("../src/components/LifeButton.tsx", import.meta.url), "utf8");
  assert.match(button, /accessibilityRole="button"/); assert.match(button, /accessibilityLabel=\{title\}/); assert.match(button, /minHeight: 48/);
});

test("DEV adapter calls only our authenticated API, sends event/type not coins, and has no real SDK", async () => {
  const calls = [];
  const { devAdAdapter } = load("../src/ads/adapter.ts", { "../api/client": { api: {
    get: async path => { calls.push(["GET", path]); return { data: status() }; },
    post: async (path, body) => { calls.push(["POST", path, body]); return { data: path === apiRoutes.prepareAdReward ? { providerEventId: "server", devSimulation: true } : { ...status(1), duplicate: false } }; },
  } }, "../api/routes": { apiRoutes } });
  assert.equal(devAdAdapter.loadBanner(), "placeholder"); await devAdAdapter.getRewardStatus();
  const receipt = await devAdAdapter.showRewarded(); await devAdAdapter.verifyRewardedCompletion(receipt.providerEventId);
  assert.deepEqual(calls, [["GET", "/ads/reward"], ["POST", "/ads/reward/prepare", {}], ["POST", "/ads/reward", { providerEventId: "server", rewardType: "COINS" }]]);
});

test("real Shop replaces balance with the authoritative total, including duplicate replies, without client addition", () => {
  let shop = { player: { coins: 40 }, items: [] }, refreshes = 0, index = 0;
  const Screen = load("../app/(tabs)/shop.tsx", {
    react: { useCallback: fn => fn, useState: initial => index++ === 0 ? [shop, fn => { shop = fn(shop); }] : [initial, () => {}] },
    "react-native": { ...Object.fromEntries(["ActivityIndicator", "Alert", "Pressable", "ScrollView", "Text", "View"].map(x => [x, x])), StyleSheet: { create: x => x } },
    "expo-router": { useFocusEffect() {}, router: {} }, "@expo/vector-icons/MaterialCommunityIcons": "Icon",
    "../../src/api/client": {}, "../../src/api/routes": {}, "../../src/avatar/assetRegistry": {}, "../../src/avatar/inventory": {},
    "../../src/components/CosmeticImage": "Image", "../../src/components/LifeCard": "Card", "../../src/components/LifeButton": "Button",
    "../../src/context/AuthContext": { useAuth: () => ({ refreshUser: () => { refreshes++; } }) }, "../../src/theme/theme": theme,
    "../../src/entitlements/useEntitlements": { useEntitlements: () => model.FREE_ENTITLEMENTS }, "../../src/ads/Ads": { BannerAdPlacement: "Banner", RewardedAdButton: "Reward" },
  }).default;
  const onReward = nodes(Screen()).find(n => n.type === "Reward").props.onReward;
  onReward({ ...status(1), duplicate: false }); assert.equal(shop.player.coins, 50);
  onReward({ ...status(1), duplicate: true }); assert.equal(shop.player.coins, 50); assert.equal(refreshes, 2);
});
