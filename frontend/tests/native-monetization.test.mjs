import { noticeJsxRuntime, noticeImport } from "./notice-test-support.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
import { BillingClient } from "../src/billing/client.ts";
import { resolveAdMode } from "../src/ads/model.ts";
import { apiError } from "../src/api/errors.ts";
import { apiRoutes } from "../src/api/routes.ts";
import * as theme from "../src/theme/theme.ts";
import * as adDiagnostics from "../src/ads/debug.ts";

const require = createRequire(import.meta.url);
function load(path, imports) {
  const exports = {};
  const code = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } }).outputText;
  new Function("require", "exports", code)(id => { if (id === "react/jsx-runtime") return noticeJsxRuntime; const notice = noticeImport(id, imports); if (notice !== undefined) return notice; return id in imports ? imports[id] : id === "./debug" ? adDiagnostics : (() => { throw new Error(`Missing ${id}`); })(); }, exports);
  return exports;
}
const tick = () => new Promise(resolve => setImmediate(resolve));
const savedEnvironments = new WeakMap();
function setEnv(t, name, value) {
  if (!savedEnvironments.has(t)) {
    const saved = new Map(); savedEnvironments.set(t, saved);
    t.after(() => { for (const [key, previous] of saved) { if (previous === undefined) delete process.env[key]; else process.env[key] = previous; } });
  }
  const saved = savedEnvironments.get(t);
  if (!saved.has(name)) saved.set(name, process.env[name]);
  if (value === undefined) delete process.env[name]; else process.env[name] = value;
}
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const options = [{ id: "monthly", label: "Monthly", price: "€4,99" }, { id: "annual", label: "Yearly", price: "$49.99" }];
function billingFixture(overrides = {}) {
  const calls = [];
  const provider = { available: true, identify: async id => { calls.push(["identify", id]); }, offerings: async () => options,
    purchase: async id => { calls.push(["purchase", id]); }, restore: async () => { calls.push(["restore"]); },
    manage: async () => { calls.push(["manage"]); }, ...overrides };
  const client = new BillingClient(provider, async id => { calls.push(["sync", id]); return false; });
  return { client, provider, calls };
}

test("offerings retain localized prices; purchase waits for backend confirmation and same-tick taps buy once", async () => {
  const purchase = deferred(), confirmation = deferred(), calls = [];
  const f = billingFixture({ purchase: async id => { calls.push(id); return purchase.promise; } });
  const client = new BillingClient(f.provider, async id => { calls.push(id); return confirmation.promise; });
  await client.identify("sub-1"); await client.load(); assert.equal(client.getSnapshot().options[0].price, "€4,99");
  const a = client.purchase("monthly"), b = client.purchase("monthly"); await tick();
  assert.deepEqual(calls, ["monthly"]); assert.equal(client.getSnapshot().busy, true);
  purchase.resolve({ customerInfo: { entitlements: { premium: true } } }); await tick();
  assert.deepEqual(calls, ["monthly", "sub-1"]); assert.equal(client.getSnapshot().verificationPending, true);
  assert.doesNotMatch(client.getSnapshot().message, /Premium confirmed/);
  confirmation.resolve(true); await Promise.all([a, b]); assert.match(client.getSnapshot().message, /Premium confirmed by Evrenthia/);
  assert.equal(client.getSnapshot().premium, undefined); // No second local entitlement model.
});

test("cancellation/pending/store error grant nothing; backend failure retries verification without another purchase", async () => {
  for (const code of ["1", "20", "2"]) {
    const f = billingFixture({ purchase: async () => { throw { code }; } }); await f.client.identify("sub"); await f.client.load(); await f.client.purchase("monthly");
    assert.equal(f.calls.some(c => c[0] === "sync"), false);
    if (code === "1") { assert.equal(f.client.getSnapshot().error, null); assert.equal(f.client.getSnapshot().message, "Purchase canceled."); }
    else assert.ok(f.client.getSnapshot().error);
    if (code === "20") assert.equal(f.client.getSnapshot().verificationPending, true);
  }
  let syncs = 0; const f = billingFixture();
  const client = new BillingClient(f.provider, async () => { if (!syncs++) throw new Error("unavailable"); return true; });
  await client.identify("sub"); await client.load(); await client.purchase("monthly");
  assert.equal(client.getSnapshot().verificationPending, true); assert.match(client.getSnapshot().error, /do not buy again/);
  await client.purchase("monthly"); // Even programmatic retries must not repeat the store charge.
  assert.equal(f.calls.filter(c => c[0] === "purchase").length, 1);
  await client.sync(); assert.equal(client.getSnapshot().verificationPending, false);
  assert.equal(f.calls.filter(c => c[0] === "purchase").length, 1);
});

test("restore always syncs, management only opens store, unavailable packages cannot buy", async () => {
  const f = billingFixture(); await f.client.identify("sub"); await f.client.load(); await f.client.purchase("fake");
  assert.equal(f.calls.some(c => c[0] === "purchase"), false);
  await f.client.restore(); assert.deepEqual(f.calls.slice(-2), [["restore"], ["sync", "sub"]]);
  assert.match(f.client.getSnapshot().message, /No active Premium/);
  await f.client.manage(); assert.deepEqual(f.calls.at(-1), ["manage"]);
});

test("account switches/logout serialize behind native operation and discard stale purchase before any backend sync", async () => {
  const pending = deferred(), f = billingFixture({ purchase: () => pending.promise });
  await f.client.identify("old"); await f.client.load(); const purchase = f.client.purchase("monthly"); await tick();
  const logout = f.client.identify(null), login = f.client.identify("new");
  assert.equal(f.client.getSnapshot().ready, false); pending.resolve(); await Promise.all([purchase, logout, login]);
  assert.equal(f.calls.some(c => c[0] === "sync"), false); assert.deepEqual(f.calls.filter(c => c[0] === "identify"), [["identify", "old"], ["identify", null], ["identify", "new"]]);
  assert.equal(f.client.getSnapshot().options.length, 0);
});

test("web provider imports no native SDK and unavailable store remains functional; connection can be retried", async () => {
  const { billingProvider } = load("../src/billing/provider.ts", {});
  assert.equal(billingProvider.available, false); await billingProvider.identify("sub"); assert.deepEqual(await billingProvider.offerings(), []);
  let attempts = 0; const f = billingFixture({ identify: async () => { if (!attempts++) throw new Error("offline"); } });
  await f.client.identify("sub"); assert.equal(f.client.getSnapshot().ready, false);
  await f.client.load(); assert.equal(f.client.getSnapshot().ready, true); assert.equal(f.client.getSnapshot().options.length, 2);
});

test("native RevenueCat config uses stable sub, public platform key, cleans logout and returns no CustomerInfo", async t => {
  setEnv(t, "EXPO_PUBLIC_BILLING_ENABLED", "true"); setEnv(t, "EXPO_PUBLIC_REVENUECAT_IOS_API_KEY", "appl_fixture_public_key");
  const calls = [], sdk = { setLogHandler() {}, configure: x => calls.push(["configure", x]), logIn: async id => calls.push(["login", id]),
    logOut: async () => calls.push(["logout"]), getOfferings: async () => ({ current: { monthly: { identifier: "monthly", packageType: "MONTHLY", product: { priceString: "€4,99" } } } }),
    purchasePackage: async () => ({ premium: true }), restorePurchases: async () => ({ premium: true }), showManageSubscriptions: async () => calls.push(["manage"]) };
  const { billingProvider: provider } = load("../src/billing/provider.native.ts", {
    "expo-constants": { default: { executionEnvironment: "standalone" }, ExecutionEnvironment: { StoreClient: "storeClient" }, __esModule: true },
    "react-native": { Platform: { OS: "ios" }, Linking: { openURL: async () => {} } }, "react-native-purchases": { default: sdk, __esModule: true },
  });
  assert.equal(provider.available, true); await provider.identify("cognito-sub-1");
  assert.equal(calls[0][1].appUserID, "cognito-sub-1"); assert.equal(calls[0][1].apiKey, "appl_fixture_public_key");
  assert.equal((await provider.offerings())[0].price, "€4,99"); assert.equal(await provider.purchase("monthly"), undefined);
  assert.equal(await provider.restore(), undefined); await provider.manage(); await provider.identify(null); await provider.identify("sub2");
  assert.deepEqual(calls.slice(-3), [["manage"], ["logout"], ["login", "sub2"]]);
});

test("ad modes require native DEV for test, explicit complete production config for live; ordinary web stays disabled", () => {
  assert.equal(resolveAdMode("test", "dev", true, true), "test");
  assert.equal(resolveAdMode("test", "dev", true, false), "disabled");
  assert.equal(resolveAdMode("placeholder", "dev", true), "placeholder");
  for (const args of [["live", "dev", true, true, true, true], ["live", "prod", false, true, false, true],
    ["live", "prod", false, true, true, false], ["live", "prod", false, false, true, true]]) assert.equal(resolveAdMode(...args), "disabled");
  assert.equal(resolveAdMode("live", "prod", false, true, true, true), "live");
});

function adFixture(t, preparedUnit = "official-test-rewarded", platform = "android") {
  setEnv(t, "EXPO_PUBLIC_ADS_MODE", "test"); const calls = [], traces = [], events = new Map(), effects = [], states = []; let allowedConsent = true, hook = 0;
  const imports = {
    "./debug": { ...adDiagnostics, adDebug: (event, details) => traces.push([event, details]) },
    react: { useEffect: fn => effects.push(fn), useState: x => { const index = hook++; if (!(index in states)) states[index] = x;
      return [states[index], update => { states[index] = typeof update === "function" ? update(states[index]) : update; }]; } }, "react-native": { Platform: { OS: platform }, View: "View" },
    "expo-constants": { default: { executionEnvironment: "standalone" }, ExecutionEnvironment: { StoreClient: "storeClient" }, __esModule: true },
    "../components/LifeButton": "Button", "../api/routes": { apiRoutes },
    "../api/client": { api: {
      get: async url => { calls.push(["GET", url]); return { data: { rewardCoins: 10, coins: 100, rewardedAdsUsedToday: 0, rewardedAdsRemainingToday: 3, date: "2026-10-08", timeZone: "UTC", available: true } }; },
      post: async (url, body) => { calls.push(["POST", url, body]); return { status: 200, data: { providerEventId: "adm:opaque", binding: "opaque-binding", adUnitId: preparedUnit } }; },
    } },
    "react-native-google-mobile-ads": { __esModule: true, default: () => ({ setRequestConfiguration: async config => calls.push(["request-config", config]), initialize: async () => calls.push(["initialize"]) }),
      AdsConsent: { gatherConsent: async () => { calls.push(["consent"]); return { canRequestAds: allowedConsent }; }, getConsentInfo: async () => ({ canRequestAds: allowedConsent }) },
      TestIds: { REWARDED: "official-test-rewarded", ADAPTIVE_BANNER: "official-adaptive-banner" }, BannerAd: "Banner", BannerAdSize: { ANCHORED_ADAPTIVE_BANNER: "ADAPTIVE" },
      RewardedAdEventType: { LOADED: "loaded", EARNED_REWARD: "earned" }, AdEventType: { CLOSED: "closed", ERROR: "error" },
      RewardedAd: { createForAdRequest: (unit, opts) => { calls.push(["create", unit, opts]); return { addAdEventListener: (type, fn) => { events.set(type, fn); return () => events.delete(type); },
        load: () => calls.push(["load"]), show: async () => calls.push(["show"]) }; } },
    },
  };
  const native = load("../src/ads/native.native.tsx", imports);
  return { ...native, calls, traces, events, effects, api: imports["../api/client"].api, sdk: imports["react-native-google-mobile-ads"],
    render: (placement = "HOME") => { hook = 0; return native.NativeBanner({ placement }); }, denyConsent: () => { allowedConsent = false; } };
}

test("native inventory is not initialized/requested when ineligible and denied consent fails closed", async t => {
  const f = adFixture(t); f.setNativeAdScope("sub", false); await assert.rejects(f.adMobAdapter.showRewarded()); assert.deepEqual(f.calls, []);
  f.setNativeAdScope("sub", true); f.denyConsent(); await assert.rejects(f.adMobAdapter.showRewarded()); assert.deepEqual(f.calls, [["consent"]]);
});

test("test rewarded ad sends only opaque SSV data; earned callback alone grants/posts nothing", async t => {
  const f = adFixture(t); f.setNativeAdScope("sub", true);
  const showing = f.adMobAdapter.showRewarded(); await tick();
  assert.equal(f.calls.find(c => c[0] === "create")[1], "official-test-rewarded");
  assert.deepEqual(f.calls.find(c => c[0] === "create")[2].serverSideVerificationOptions, { userId: "opaque-binding", customData: "adm:opaque" });
  f.events.get("loaded")(); await tick(); f.events.get("earned")();
  assert.equal(f.calls.filter(c => c[0] === "POST").length, 1); assert.equal(f.calls.some(c => c[1] === apiRoutes.adReward), false);
  f.events.get("closed")(); assert.deepEqual(await showing, { providerEventId: "adm:opaque", devSimulation: false });
});

test("Android/iOS attach the unmodified prepared SSV claim before load/show and log only presence/length", async t => {
  const env = require("../eas.json").build.development.env;
  setEnv(t, "EXPO_PUBLIC_ADMOB_TEST_DEVICE_IDS", "A".repeat(32)); // Synthetic fixture, not app configuration.
  for (const platform of ["android", "ios"]) {
    const unit = env[`EXPO_PUBLIC_ADMOB_${platform.toUpperCase()}_REWARDED_UNIT_ID`];
    setEnv(t, `EXPO_PUBLIC_ADMOB_${platform.toUpperCase()}_REWARDED_UNIT_ID`, unit);
    const prepared = { providerEventId: `adm:${"opaque_claim-".repeat(20)}`, binding: "private-prepared-binding", adUnitId: unit };
    const response = deferred(), f = adFixture(t, unit, platform); f.setNativeAdScope("sub", true);
    f.api.post = async (url, body) => { f.calls.push(["POST", url, body]); return response.promise; };
    const showing = f.adMobAdapter.showRewarded(); await tick();
    assert.equal(f.calls.some(c => c[0] === "create" || c[0] === "load" || c[0] === "show"), false);
    response.resolve({ status: 201, data: prepared }); await tick();
    const createIndex = f.calls.findIndex(c => c[0] === "create"), loadIndex = f.calls.findIndex(c => c[0] === "load");
    assert.ok(createIndex >= 0 && createIndex < loadIndex);
    assert.deepEqual(f.calls[createIndex].slice(1), [unit, { requestNonPersonalizedAdsOnly: true,
      serverSideVerificationOptions: { userId: prepared.binding, customData: prepared.providerEventId } }]);
    assert.deepEqual(f.traces.find(([event]) => event === "rewarded.ssv_options")[1], {
      ssv_options_attached: true, custom_data_present: true, custom_data_length: prepared.providerEventId.length,
    });
    assert.deepEqual(f.traces.map(([event]) => event), ["rewarded.ssv_options"]);
    assert.equal(f.calls.some(c => c[0] === "show"), false);
    f.events.get("loaded")(); await tick();
    assert.ok(loadIndex < f.calls.findIndex(c => c[0] === "show"));
    f.events.get("earned")(); f.events.get("closed")();
    assert.deepEqual(await showing, { providerEventId: prepared.providerEventId, devSimulation: false });
    for (const sensitive of [prepared.providerEventId, prepared.binding]) assert.equal(JSON.stringify(f.traces).includes(sensitive), false);
    assert.deepEqual(f.calls.filter(c => c[0] === "POST").map(c => c[1]), [apiRoutes.prepareAdReward]);
  }
});

test("native earned/closed callbacks only start server polling; coins and allowance wait for confirmation", async t => {
  const f = adFixture(t); f.setNativeAdScope("sub", true);
  const { RewardedAds } = load("../src/ads/rewarded.ts", { "../api/errors": { apiError } });
  const flow = new RewardedAds(f.adMobAdapter), confirmation = deferred();
  flow.setScope("sub", true); await flow.refresh();
  const initial = flow.getSnapshot().status;
  f.api.get = async url => { f.calls.push(["GET", url]); return { data: await confirmation.promise }; };
  const request = flow.request(); await tick();
  f.events.get("loaded")(); await tick(); f.events.get("earned")();
  assert.equal(flow.getSnapshot().status.coins, 100);
  assert.equal(flow.getSnapshot().status.rewardedAdsRemainingToday, 3);
  assert.equal(f.calls.filter(c => c[0] === "GET").length, 1); // Initial status only; ad has not closed yet.
  f.events.get("closed")(); await tick();
  assert.equal(flow.getSnapshot().phase, "claiming");
  assert.ok(f.calls.some(c => c[0] === "GET" && c[1] === `${apiRoutes.adReward}?provider=ADMOB&claimId=adm%3Aopaque`));
  assert.deepEqual(flow.getSnapshot().status, initial);
  assert.deepEqual(f.calls.filter(c => c[0] === "POST").map(c => c[1]), [apiRoutes.prepareAdReward]);
  confirmation.resolve({ ...initial, claimStatus: "GRANTED", coins: 110,
    rewardedAdsUsedToday: 1, rewardedAdsRemainingToday: 2, duplicate: false });
  assert.equal((await request).coins, 110);
  assert.equal(flow.getSnapshot().status.rewardedAdsRemainingToday, 2);
});

test("missing, blank and whitespace-only test-device IDs select demo rewarded inventory", async t => {
  const env = require("../eas.json").build.development.env;
  for (const platform of ["android", "ios"]) {
    setEnv(t, `EXPO_PUBLIC_ADMOB_${platform.toUpperCase()}_REWARDED_UNIT_ID`, env[`EXPO_PUBLIC_ADMOB_${platform.toUpperCase()}_REWARDED_UNIT_ID`]);
    for (const devices of [undefined, "", " ,  , "]) {
      setEnv(t, "EXPO_PUBLIC_ADMOB_TEST_DEVICE_IDS", devices);
      const f = adFixture(t, "official-test-rewarded", platform); f.setNativeAdScope("sub", true);
      const showing = f.adMobAdapter.showRewarded(); await tick();
      assert.equal(f.calls.find(c => c[0] === "create")[1], "official-test-rewarded");
      f.events.get("earned")(); f.events.get("closed")(); await showing;
    }
  }
});

test("registered test devices use the configured Android/iOS rewarded unit, while both banners stay demo", async t => {
  const env = require("../eas.json").build.development.env, device = "A".repeat(32), secondDevice = "b".repeat(32); // Synthetic fixtures, never app configuration.
  for (const [name, value] of Object.entries(env)) if (name.startsWith("EXPO_PUBLIC_ADMOB_")) setEnv(t, name, value);
  setEnv(t, "EXPO_PUBLIC_LIVE_ADS_ENABLED", "false");
  setEnv(t, "EXPO_PUBLIC_ADMOB_TEST_DEVICE_IDS", ` ${device}, ,${secondDevice} `);
  for (const platform of ["android", "ios"]) {
    const unit = env[`EXPO_PUBLIC_ADMOB_${platform.toUpperCase()}_REWARDED_UNIT_ID`];
    const f = adFixture(t, unit, platform); f.setNativeAdScope("sub", true);
    assert.equal(f.render(), null); f.effects[0](); await tick();
    for (const placement of ["HOME", "SHOP"]) assert.equal(f.render(placement).props.children[0].props.unitId, "official-adaptive-banner");
    const showing = f.adMobAdapter.showRewarded(); await tick();
    assert.deepEqual(f.calls.find(c => c[0] === "request-config")[1].testDeviceIdentifiers, ["EMULATOR", device, secondDevice]);
    assert.ok(f.calls.findIndex(c => c[0] === "request-config") < f.calls.findIndex(c => c[0] === "initialize"));
    assert.ok(f.calls.findIndex(c => c[0] === "initialize") < f.calls.findIndex(c => c[0] === "load"));
    assert.equal(f.calls.find(c => c[0] === "create")[1], unit);
    assert.equal(f.calls.find(c => c[0] === "POST")[2].platform, platform.toUpperCase());
    assert.deepEqual(f.calls.find(c => c[0] === "create")[2].serverSideVerificationOptions, { userId: "opaque-binding", customData: "adm:opaque" });
    f.events.get("earned")(); f.events.get("closed")(); await showing;
    assert.equal(f.calls.filter(c => c[0] === "POST").length, 1); // Prepare only; no client reward grant.
    assert.equal(process.env.EXPO_PUBLIC_LIVE_ADS_ENABLED, "false");
    assert.equal(resolveAdMode("live", "dev", true, true, false, true), "disabled");
  }
});

test("an explicitly configured Android EMULATOR alias opts into the real test-only rewarded unit", async t => {
  const unit = require("../eas.json").build.development.env.EXPO_PUBLIC_ADMOB_ANDROID_REWARDED_UNIT_ID;
  setEnv(t, "EXPO_PUBLIC_ADMOB_ANDROID_REWARDED_UNIT_ID", unit);
  setEnv(t, "EXPO_PUBLIC_ADMOB_TEST_DEVICE_IDS", "EMULATOR");
  const f = adFixture(t, unit); f.setNativeAdScope("sub", true);
  const configured = deferred();
  f.sdk.default = () => ({
    setRequestConfiguration: config => { f.calls.push(["request-config", config]); return configured.promise; },
    initialize: async () => f.calls.push(["initialize"]),
  });
  const showing = f.adMobAdapter.showRewarded(); await tick();
  assert.deepEqual(f.calls.find(c => c[0] === "request-config")[1].testDeviceIdentifiers, ["EMULATOR"]);
  assert.equal(f.calls.some(c => ["initialize", "POST", "create", "load"].includes(c[0])), false);
  configured.resolve(); await tick();
  assert.equal(f.calls.find(c => c[0] === "create")[1], unit);
  f.events.get("earned")(); f.events.get("closed")(); await showing;
});

test("malformed test devices or missing/demo rewarded configuration fail closed before any request", async t => {
  const unit = require("../eas.json").build.development.env.EXPO_PUBLIC_ADMOB_ANDROID_REWARDED_UNIT_ID;
  for (const [devices, configuredUnit, platform] of [["not-an-admob-id", unit, "android"], ["EMULATOR", unit, "ios"],
    ["A".repeat(32), "", "android"], ["A".repeat(32), "ca-app-pub-3940256099942544/5224354917", "android"]]) {
    setEnv(t, "EXPO_PUBLIC_ADMOB_TEST_DEVICE_IDS", devices);
    setEnv(t, `EXPO_PUBLIC_ADMOB_${platform.toUpperCase()}_REWARDED_UNIT_ID`, configuredUnit);
    const f = adFixture(t, unit, platform); f.setNativeAdScope("sub", true);
    await assert.rejects(f.adMobAdapter.showRewarded(), /registered test-device/);
    assert.deepEqual(f.calls, []);
  }
});

test("registered-device rewarded testing still rejects mismatched units and invalid prepared claims", async t => {
  const unit = require("../eas.json").build.development.env.EXPO_PUBLIC_ADMOB_ANDROID_REWARDED_UNIT_ID;
  setEnv(t, "EXPO_PUBLIC_ADMOB_ANDROID_REWARDED_UNIT_ID", unit);
  setEnv(t, "EXPO_PUBLIC_ADMOB_TEST_DEVICE_IDS", "A".repeat(32));
  for (const invalid of [{ adUnitId: "ca-app-pub-123456789/1234" }, { providerEventId: "invalid" }, { binding: "" }]) {
    const f = adFixture(t, unit); f.setNativeAdScope("sub", true);
    f.api.post = async () => ({ status: 201, data: { providerEventId: "adm:opaque", binding: "opaque-binding", adUnitId: unit, ...invalid } });
    await assert.rejects(f.adMobAdapter.showRewarded(), /configuration mismatch/);
    assert.equal(f.calls.some(c => c[0] === "create" || c[0] === "load"), false);
  }
});

test("native build configuration defaults to sample app IDs, never adds ATT, and rejects incomplete live config", t => {
  const configure = require("../app.config.js");
  setEnv(t, "APP_ENV", "dev"); setEnv(t, "EXPO_PUBLIC_APP_ENV", "dev"); setEnv(t, "EXPO_PUBLIC_ADS_MODE", "disabled");
  setEnv(t, "EXPO_PUBLIC_ADMOB_IOS_APP_ID", ""); setEnv(t, "EXPO_PUBLIC_ADMOB_ANDROID_APP_ID", "");
  const plugin = configure({ config: { plugins: [] } }).plugins[0][1];
  assert.equal(plugin.iosAppId, "ca-app-pub-3940256099942544~1458002511");
  assert.equal(plugin.delayAppMeasurementInit, true); assert.equal(plugin.userTrackingUsageDescription, undefined);
  setEnv(t, "EXPO_PUBLIC_APP_ENV", "prod"); setEnv(t, "EXPO_PUBLIC_ADS_MODE", "live"); setEnv(t, "EXPO_PUBLIC_LIVE_ADS_ENABLED", "true");
  setEnv(t, "EXPO_PUBLIC_ADMOB_IOS_APP_ID", ""); setEnv(t, "EXPO_PUBLIC_ADMOB_ANDROID_APP_ID", "");
  assert.throws(() => configure({ config: {} }), /both platform AdMob App IDs/);
});

test("DEV builds use configured AdMob app IDs without enabling live ads or changing native identity", t => {
  const env = require("../eas.json").build.development.env;
  for (const [name, value] of Object.entries(env)) if (name.startsWith("EXPO_PUBLIC_AD") || name === "EXPO_PUBLIC_LIVE_ADS_ENABLED") setEnv(t, name, value);
  setEnv(t, "EXPO_PUBLIC_APP_ENV", "dev");
  const app = require("../app.json").expo, config = require("../app.config.js")({ config: app });
  const plugin = config.plugins.find(p => Array.isArray(p) && p[0] === "react-native-google-mobile-ads")[1];
  assert.equal(plugin.iosAppId, env.EXPO_PUBLIC_ADMOB_IOS_APP_ID);
  assert.equal(plugin.androidAppId, env.EXPO_PUBLIC_ADMOB_ANDROID_APP_ID);
  assert.equal(plugin.androidSdk, "classic");
  const { setAndroidSdkGradleProperties } = require("react-native-google-mobile-ads/app.plugin");
  assert.deepEqual(setAndroidSdkGradleProperties([], plugin.androidSdk), [
    { type: "property", key: "RNGMA_ANDROID_BACKEND", value: "classic" },
  ]);
  assert.equal(plugin.delayAppMeasurementInit, true); assert.equal(plugin.userTrackingUsageDescription, undefined);
  assert.equal(config.ios.bundleIdentifier, "com.osegssteam.evrenthia");
  assert.equal(config.android.package, "com.osegssteam.evrenthia");
  assert.equal(process.env.EXPO_PUBLIC_LIVE_ADS_ENABLED, "false");
  assert.equal(resolveAdMode(process.env.EXPO_PUBLIC_ADS_MODE, "dev", true, true, false, true), "test");
});

test("configured real units and blank test-device IDs still use demo banners and never request a real rewarded unit", async t => {
  const env = require("../eas.json").build.development.env;
  for (const [name, value] of Object.entries(env)) if (name.startsWith("EXPO_PUBLIC_ADMOB_")) setEnv(t, name, value);
  setEnv(t, "EXPO_PUBLIC_ADMOB_TEST_DEVICE_IDS", "");
  const f = adFixture(t, env.EXPO_PUBLIC_ADMOB_ANDROID_REWARDED_UNIT_ID);
  assert.equal(f.liveAdsConfigured, true); f.setNativeAdScope("sub", true);
  assert.equal(f.render(), null); f.effects[0](); await tick();
  assert.equal(f.render().props.children[0].props.unitId, "official-adaptive-banner");
  assert.deepEqual(f.calls.find(c => c[0] === "request-config")[1].testDeviceIdentifiers, ["EMULATOR"]);
  await assert.rejects(f.adMobAdapter.showRewarded(), /configuration mismatch/);
  assert.equal(f.calls.filter(c => c[0] === "POST" && c[1] === apiRoutes.prepareAdReward).length, 1);
  assert.deepEqual(f.traces, []);
  assert.equal(f.calls.some(c => c[0] === "create" || c[0] === "load"), false);
});

test("consent exceptions reproduce the generic Shop failure before prepare or native ad loading", async t => {
  const f = adFixture(t); f.setNativeAdScope("sub", true);
  f.sdk.AdsConsent.gatherConsent = async () => { throw Object.assign(new Error("Consent configuration unavailable"), { code: "consent-update-failed" }); };
  const { RewardedAds } = load("../src/ads/rewarded.ts", { "../api/errors": { apiError } });
  const flow = new RewardedAds(f.adMobAdapter); flow.setScope("sub", true); await flow.refresh(); await flow.request();
  assert.equal(flow.getSnapshot().error, "Could not prepare the ad. No reward was confirmed.");
  assert.equal(flow.getSnapshot().status.coins, 100);
  assert.equal(f.calls.some(c => ["POST", "initialize", "create", "load"].includes(c[0])), false);
  assert.deepEqual(f.traces, []); // The flow logs one request failure, not every readiness stage.
});

test("prepare HTTP rejection propagates without response/URL traces or native loading", async t => {
  const f = adFixture(t); f.setNativeAdScope("sub", true);
  f.api.post = async () => { throw Object.assign(new Error("Request failed with status code 403"), {
    response: { status: 403, data: { error: { code: "FORBIDDEN", message: "Not allowed", details: { token: "private-token" } }, binding: "private-binding" } },
  }); };
  await assert.rejects(f.adMobAdapter.showRewarded(), /403/);
  assert.deepEqual(f.traces, []);
  assert.doesNotMatch(JSON.stringify(f.traces), /private-token|private-binding/);
  assert.equal(f.calls.some(c => c[0] === "load"), false);
});

test("native rewarded errors are traced without granting or confirming a reward", async t => {
  const f = adFixture(t); f.setNativeAdScope("sub", true);
  const showing = f.adMobAdapter.showRewarded(); const rejected = assert.rejects(showing, /Ad unavailable/); await tick();
  assert.ok(f.calls.some(([event]) => event === "load"));
  f.events.get("error")(Object.assign(new Error("No fill"), { code: "googleMobileAds/no-fill" }));
  await rejected;
  assert.deepEqual(f.traces.find(([event]) => event === "rewarded.load.failed")[1], { code: "googleMobileAds/no-fill" });
  assert.equal(f.calls.filter(c => c[0] === "POST").length, 1);
  assert.equal(f.calls.some(c => c[1] === apiRoutes.adReward), false);
});

test("confirmed Free banner waits for consent and SDK readiness, then uses an official adaptive test unit", async t => {
  const f = adFixture(t); f.setNativeAdScope("sub", true); assert.equal(f.render(), null);
  f.effects[0](); await tick();
  const tree = f.render(), banner = tree.props.children[0];
  assert.equal(banner.props.unitId, "official-adaptive-banner"); assert.equal(banner.props.size, "ADAPTIVE");
  assert.equal(banner.props.requestOptions.requestNonPersonalizedAdsOnly, true);
  f.setNativeAdScope("sub", false); assert.equal(f.render(), null);
});

test("earned reward leaves verifying UI and unchanged balance until the authenticated server poll confirms", async () => {
  const confirmation = deferred();
  const { RewardedAds } = load("../src/ads/rewarded.ts", { "../api/errors": { apiError } });
  const status = { rewardCoins: 10, coins: 100, rewardedAdsUsedToday: 0, rewardedAdsRemainingToday: 3, date: "2026-10-08", timeZone: "UTC", available: true };
  const flow = new RewardedAds({ getRewardStatus: async () => status, showRewarded: async () => ({ providerEventId: "opaque", devSimulation: false }), verifyRewardedCompletion: () => confirmation.promise });
  flow.setScope("sub", true); await flow.refresh(); const request = flow.request(); await tick();
  assert.equal(flow.getSnapshot().phase, "claiming"); assert.equal(flow.getSnapshot().status.coins, 100);
  confirmation.resolve({ ...status, coins: 110, rewardedAdsUsedToday: 1, rewardedAdsRemainingToday: 2, duplicate: false });
  assert.equal((await request).coins, 110);
});

test("Premium UI uses localized package prices, disables purchase during verification, and retains restore/manage", () => {
  const nodes = tree => Array.isArray(tree) ? tree.flatMap(nodes) : tree?.props ? [tree, ...nodes(tree.props.children)] : [];
  let premium = false;
  const billingState = { ready: true, busy: false, options, verificationPending: false };
  const Screen = load("../app/premium.tsx", {
    react: { useCallback: fn => fn }, "expo-router": { useFocusEffect() {}, router: {} },
    "react-native": { ScrollView: "Scroll", Text: "Text", Platform: { select: value => value.default }, StyleSheet: { create: x => x } },
    "../src/context/AuthContext": { useAuth: () => ({ billing: { provider: { available: true } }, billingState }) },
    "../src/entitlements/useEntitlements": { useEntitlements: () => ({ premium, confirmed: true, loading: false, refresh() {} }) },
    "../src/components/ui/Primitives": { ScreenShell: "Scroll" },
    "../src/components/LifeCard": "Card", "../src/components/LifeButton": "Button", "../src/theme/theme": theme,
  }).default;
  assert.equal(nodes(Screen()).find(n => n.props.title === "Subscribe Monthly · €4,99").props.disabled, false);
  billingState.verificationPending = true;
  assert.equal(nodes(Screen()).find(n => n.props.title === "Subscribe Monthly · €4,99").props.disabled, true);
  assert.ok(nodes(Screen()).find(n => n.props.title === "Retry plan verification"));
  premium = true; assert.ok(nodes(Screen()).find(n => n.props.title === "Manage Subscription"));
  assert.ok(nodes(Screen()).find(n => n.props.title === "Restore Purchases"));
});
