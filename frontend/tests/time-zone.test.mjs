import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
import { getDeviceTimeZone, normalizeTimeZone, timeZoneLabel } from "../src/utils/timeZone.ts";

test("legacy US abbreviations migrate to regional IANA zones, not fixed offsets", () => {
  for (const [input, expected] of [["EST", "America/New_York"], ["CST", "America/Chicago"],
    ["MST", "America/Denver"], ["PST", "America/Los_Angeles"], [" edt ", "America/New_York"]]) {
    assert.equal(normalizeTimeZone(input), expected);
  }
  for (const input of [null, "", "Moon/Tranquility", "+05:00", "GMT-0500", "__proto__", {}, "A".repeat(101)]) {
    assert.equal(normalizeTimeZone(input), null);
  }
  assert.equal(normalizeTimeZone("UTC"), "UTC");
  assert.equal(normalizeTimeZone("Asia/Tokyo"), "Asia/Tokyo");
  assert.equal(normalizeTimeZone("Asia/Kolkata"), "Asia/Kolkata", "ICU alias differences must not cause repeated writes");
});

test("device detection reads a fresh runtime zone on each call and safely handles missing Intl", t => {
  const Original = Intl.DateTimeFormat;
  let device = "America/New_York";
  t.mock.method(Intl, "DateTimeFormat", function (...args) {
    if (!args.length) return { resolvedOptions: () => ({ timeZone: device }) };
    return new Original(...args);
  });
  assert.equal(getDeviceTimeZone(), "America/New_York");
  device = "America/Los_Angeles";
  assert.equal(getDeviceTimeZone(), "America/Los_Angeles");
  device = undefined;
  assert.equal(getDeviceTimeZone(), null, "do not guess UTC and overwrite the saved zone");
  t.mock.method(Intl, "DateTimeFormat", () => { throw new Error("unsupported"); });
  assert.equal(getDeviceTimeZone(), null);
});

test("friendly labels are distinct from the saved IANA value and follow daylight saving", t => {
  const Original = Intl.DateTimeFormat;
  t.mock.method(Intl, "DateTimeFormat", function (_locale, options) { return new Original("en-US", options); });
  assert.match(timeZoneLabel("America/New_York", new Date("2026-01-15T12:00Z")), /New York.*Eastern Standard Time/);
  assert.match(timeZoneLabel("America/New_York", new Date("2026-07-15T12:00Z")), /New York.*Eastern Daylight Time/);
  assert.match(timeZoneLabel("UTC"), /Coordinated Universal Time/);
  assert.equal(timeZoneLabel("EST"), "EST · awaiting automatic update", "do not display regional DST rules until migration is confirmed");
  assert.equal(timeZoneLabel("invalid"), "Time zone unavailable");
});

test("auth lifecycle refreshes on foreground and checks timezone changes locally while active, with cleanup", () => {
  const require = createRequire(import.meta.url);
  const effects = [], cleanups = [], timers = new Map(), listeners = [];
  let device = "America/New_York", zoneRefreshes = 0, resumed = 0, removed = 0;
  const state = { token: "fixture", loading: false, user: { id: "test", timeZone: device } };
  const AppState = { currentState: "active", addEventListener: (_type, fn) => { listeners.push(fn); return { remove: () => removed++ }; } };
  const react = { createContext: () => ({ Provider: "Provider" }),
    useState: initial => [typeof initial === "function" ? initial() : initial, () => {}],
    useEffect: fn => effects.push(fn), useCallback: fn => fn, useMemo: fn => fn(),
    useSyncExternalStore: (_subscribe, snapshot) => snapshot(), useContext() {} };
  class Session {
    start = () => () => {};
    subscribe = () => () => {};
    getSnapshot = () => state;
    refreshUser = () => { zoneRefreshes++; state.user = { ...state.user, timeZone: device }; return Promise.resolve(true); };
    retrySession = () => { resumed++; return Promise.resolve(true); };
  }
  class Billing {
    subscribe = () => () => {};
    getSnapshot = () => ({});
    identify = async () => {};
  }
  const imports = { react, "react/jsx-runtime": require("react/jsx-runtime"), "react-native": { AppState, Platform: { OS: "ios" } },
    "../auth/session": { AuthSession: Session }, "../auth/cognito": { cognitoAuth: {} }, "../api/client": { api: {} },
    "../notifications/device": { enableDeviceNotifications: async () => {}, watchDeviceToken: async () => () => {}, disableCurrentDevice: async () => {} },
    "../billing/client": { BillingClient: Billing }, "../billing/provider": { billingProvider: {} }, "../api/routes": { apiRoutes: {} },
    "../cache/playerData": { playerCache: {} }, "../avatar/prefetch": { prefetchCachedAvatar: async () => {} }, "../utils/timeZone": { getDeviceTimeZone: () => device } };
  const source = ts.transpileModule(readFileSync(new URL("../src/context/AuthContext.tsx", import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  const exports = {};
  new Function("exports", "require", "setInterval", "clearInterval", source)(exports, id => {
    assert.ok(id in imports, `Unexpected dependency: ${id}`); return imports[id];
  }, (fn, delay) => { assert.equal(delay, 60_000); timers.set(1, fn); return 1; }, id => timers.delete(id));
  exports.AuthProvider({ children: "app" });
  effects.forEach(fn => cleanups.push(fn()));
  const check = timers.get(1);
  check(); assert.equal(zoneRefreshes, 0, "no network poll when device zone is unchanged");
  device = "Asia/Tokyo"; check(); assert.equal(zoneRefreshes, 1);
  check(); assert.equal(zoneRefreshes, 1);
  AppState.currentState = "background"; device = "America/Los_Angeles";
  check(); assert.equal(zoneRefreshes, 1, "no checks in the background");
  listeners.forEach(fn => fn("active")); assert.equal(resumed, 1);
  cleanups.forEach(fn => fn?.());
  assert.equal(timers.size, 0); assert.equal(removed, 2);
});
