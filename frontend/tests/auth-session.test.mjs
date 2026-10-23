import assert from "node:assert/strict";
import { setImmediate as nextTick } from "node:timers/promises";
import test from "node:test";
import axios, { AxiosError } from "axios";
import { AuthSession, userFromProfile } from "../src/auth/session.ts";
import { authDestination } from "../src/auth/destination.ts";
import { FREE_ENTITLEMENTS } from "../src/entitlements/model.ts";

import { memoryCache, inventory, tasks, goals, achievements, world, baseLayout } from "./cache-test-support.mjs";
import { PlayerCache } from "../src/cache/PlayerCache.ts";

const identity = { token: "saved-id-token", userId: "user-sub-1", email: "hero@example.test" };
const nextIdentity = { token: "new-id-token", userId: "user-sub-2", email: "second@example.test" };
const profile = {
  onboardingCompleted: true,
  displayName: "Test Hero", level: 3, xp: 200, xpIntoLevel: 50,
  xpForNextLevel: 200, xpToNextLevel: 150, coins: 20, timeZone: "America/New_York",
};
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const premiumEntitlement = { ...FREE_ENTITLEMENTS, plan: "PREMIUM", premium: true, adsEnabled: false,
  subscriptionStatus: "ACTIVE", expiresAt: "2099-01-01T00:00:00Z", source: "TEST" };
const response = (config, data) => ({ config, data, status: 200, statusText: "OK", headers: {} });
const httpError = (config, status, data = {}) => new AxiosError(
  `Request failed: ${status}`,
  "ERR_BAD_RESPONSE",
  config,
  null,
  { ...response(config, data), status },
);

function harness(t, { session = identity, deviceTimeZone = profile.timeZone, cache, prepareDisplay } = {}) {
  const calls = [], authCalls = [];
  const h = {
    calls,
    authCalls,
    session,
    deviceTimeZone,
    profile: config => response(config, profile),
    saveProfile: config => response(config, JSON.parse(config.data)),
    entitlement: config => response(config, { plan: "FREE", subscriptionStatus: "FREE" }),
  };
  h.auth = {
    getSession: async forceRefresh => {
      authCalls.push(["getSession", forceRefresh ?? false]);
      return h.session;
    },
    signIn: async (email, password) => {
      authCalls.push(["signIn", email, password]);
      h.session = nextIdentity;
      return nextIdentity;
    },
    signUp: async (displayName, email, password) => {
      authCalls.push(["signUp", displayName, email, password]);
      return "CONFIRM_SIGN_UP";
    },
    confirmSignUp: async (email, code) => {
      authCalls.push(["confirmSignUp", email, code]);
    },
    signOut: async () => {
      authCalls.push(["signOut"]);
      h.session = null;
    },
  };
  h.client = axios.create({ adapter: async config => {
    calls.push(config);
    if (config.url === "/me") return config.method === "patch" ? h.saveProfile(config) : h.profile(config);
    if (config.url === "/entitlements") return h.entitlement(config);
    return response(config, {});
  } });
  h.authSession = new AuthSession(h.client, h.auth, () => h.deviceTimeZone, cache, prepareDisplay);
  const stop = h.authSession.start();
  t.after(stop);
  h.ready = async () => {
    if (h.authSession.getSnapshot().loading) {
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => { unsubscribe(); reject(new Error("Session did not finish restoring")); }, 1000);
        const unsubscribe = h.authSession.subscribe(() => {
          if (!h.authSession.getSnapshot().loading) {
            clearTimeout(timeout);
            unsubscribe();
            resolve();
          }
        });
      });
    }
    await nextTick();
  };
  return h;
}

test("entitlement failure leaves the core profile usable, defaults FREE and hides ads until confirmed", async t => {
  const h = harness(t); h.entitlement = () => { throw new Error("offline"); };
  await h.ready();
  const s = h.authSession.getSnapshot();
  assert.equal(s.user.id, identity.userId); assert.equal(s.sessionError, null);
  assert.deepEqual(s.entitlements, FREE_ENTITLEMENTS); assert.equal(s.entitlementsConfirmed, false);
  assert.equal(s.entitlementsLoading, false); assert.ok(s.entitlementsError); assert.equal(s.user.premiumActive, false);
  h.entitlement = config => response(config, premiumEntitlement);
  assert.equal(await h.authSession.refreshEntitlements(), true);
  assert.equal(h.authSession.getSnapshot().user.premiumActive, true);
});

test("a pending entitlement request cannot delay the core profile or route", async t => {
  const h = harness(t), wait = deferred();
  h.entitlement = config => wait.promise.then(() => response(config, FREE_ENTITLEMENTS));
  await h.ready();
  assert.equal(h.authSession.getSnapshot().user.id, identity.userId);
  assert.equal(h.authSession.getSnapshot().loading, false);
  assert.equal(h.authSession.getSnapshot().entitlementsLoading, true);
  assert.equal(h.authSession.getSnapshot().entitlementsConfirmed, false);
  wait.resolve(); await nextTick();
  assert.equal(h.authSession.getSnapshot().entitlementsConfirmed, true);
});

test("loading refreshes are deduplicated and cannot flash a FREE ad over cached Premium", async t => {
  const h = harness(t); h.entitlement = config => response(config, premiumEntitlement); await h.ready();
  const wait = deferred(); h.entitlement = config => wait.promise.then(() => response(config, FREE_ENTITLEMENTS));
  const first = h.authSession.refreshEntitlements(), second = h.authSession.refreshEntitlements();
  assert.equal(first, second); assert.equal(h.authSession.getSnapshot().entitlementsLoading, true);
  assert.equal(h.authSession.getSnapshot().entitlements.premium, true);
  wait.resolve(); assert.equal(await first, true);
  assert.deepEqual(h.authSession.getSnapshot().entitlements, FREE_ENTITLEMENTS);
  assert.equal(h.calls.filter(c => c.url === "/entitlements").length, 2);
});

test("unknown or inconsistent response cannot grant Premium; a failed refresh discards stale privilege", async t => {
  const h = harness(t); h.entitlement = config => response(config, premiumEntitlement); await h.ready();
  for (const data of [{ ...premiumEntitlement, subscriptionStatus: "UNKNOWN" }, { ...FREE_ENTITLEMENTS, premium: true }, null]) {
    h.entitlement = config => response(config, data); assert.equal(await h.authSession.refreshEntitlements(), false);
    assert.equal(h.authSession.getSnapshot().entitlements.premium, false);
    assert.equal(h.authSession.getSnapshot().entitlementsConfirmed, false);
  }
});

for (const clear of ["logout", "clearDeletedAccountSession"]) {
  test(`${clear} clears entitlement state and ignores a late Premium response`, async t => {
    const h = harness(t); h.entitlement = config => response(config, premiumEntitlement); await h.ready();
    const wait = deferred(); h.entitlement = config => wait.promise.then(() => response(config, premiumEntitlement));
    const refresh = h.authSession.refreshEntitlements(); await nextTick(); await h.authSession[clear]();
    wait.resolve(); assert.equal(await refresh, false);
    assert.deepEqual(h.authSession.getSnapshot().entitlements, FREE_ENTITLEMENTS);
    assert.equal(h.authSession.getSnapshot().entitlementsConfirmed, false); assert.equal(h.authSession.getSnapshot().user, null);
  });
}

test("a late old-account entitlement cannot overwrite a newly authenticated FREE user", async t => {
  const h = harness(t); await h.ready(); const wait = deferred();
  h.entitlement = config => config.headers.get("Authorization").includes(identity.token)
    ? wait.promise.then(() => response(config, premiumEntitlement)) : response(config, FREE_ENTITLEMENTS);
  const refresh = h.authSession.refreshEntitlements(); await nextTick();
  await h.authSession.login("second@example.test", "password"); wait.resolve(); await refresh;
  assert.equal(h.authSession.getSnapshot().user.id, nextIdentity.userId);
  assert.deepEqual(h.authSession.getSnapshot().entitlements, FREE_ENTITLEMENTS);
});

test("billing and ad requests bound to an old user cannot send with a new account's JWT", async t => {
  const h = harness(t); await h.ready();
  await h.client.post("/billing/sync", {}, { expectedUserId: identity.userId });
  await h.authSession.login("second@example.test", "password");
  const requests = h.calls.length;
  await assert.rejects(h.client.post("/billing/sync", {}, { expectedUserId: identity.userId }));
  await assert.rejects(h.client.get("/ad-rewards", { expectedUserId: identity.userId }));
  assert.equal(h.calls.length, requests);
});

test("prepare requests retain account-binding protection without temporary auth diagnostics", async t => {
  const previous = globalThis.__DEV__, logs = [];
  globalThis.__DEV__ = true;
  t.after(() => { if (previous === undefined) delete globalThis.__DEV__; else globalThis.__DEV__ = previous; });
  t.mock.method(console, "info", (...args) => logs.push(args));
  const h = harness(t); await h.ready();
  await h.client.post("/ads/reward/prepare", {}, { expectedUserId: identity.userId });
  await assert.rejects(h.client.post("/ads/reward/prepare", {}, { expectedUserId: nextIdentity.userId }));
  assert.deepEqual(logs, []);
  assert.doesNotMatch(JSON.stringify(logs), /saved-id-token|user-sub-1|user-sub-2|Bearer/);
  assert.equal(h.calls.filter(c => c.url === "/ads/reward/prepare").length, 1);
});

test("restores the Cognito session and authenticates profile requests with its ID token", async t => {
  const h = harness(t);
  await h.ready();
  assert.equal(h.authSession.getSnapshot().user.id, identity.userId);
  assert.equal(h.authSession.getSnapshot().user.username, profile.displayName);
  assert.equal(h.authSession.getSnapshot().user.email, identity.email);
  assert.deepEqual(h.calls.map(call => call.url).sort(), ["/entitlements", "/me"]);
  assert.ok(h.calls.every(call => call.headers.get("Authorization") === `Bearer ${identity.token}`));
  assert.ok(h.calls.every(call => call.timeout === 15000));
});

test("onboarding route follows server state through incomplete login, completion refresh, logout and login", async t => {
  const h = harness(t); h.profile = config => response(config, { ...profile, onboardingCompleted: false });
  await h.ready();
  const destination = () => authDestination(h.authSession.getSnapshot().token, h.authSession.getSnapshot().user);
  assert.equal(destination(), "/onboarding");
  h.profile = config => response(config, { ...profile, onboardingCompleted: true });
  assert.equal(await h.authSession.refreshUser(), true); assert.equal(destination(), "/(tabs)/dashboard");
  await h.authSession.logout(); assert.equal(destination(), "/login");
  await h.authSession.login("hero@example.test", "password"); assert.equal(destination(), "/(tabs)/dashboard");
});

test("missing or invalid API completion state is recoverable, never inferred from a token", async t => {
  const h = harness(t); h.profile = config => response(config, { ...profile, onboardingCompleted: undefined });
  await h.ready(); assert.equal(h.authSession.getSnapshot().user, null);
  assert.ok(h.authSession.getSnapshot().sessionError);
  assert.equal(authDestination(h.authSession.getSnapshot().token, null), null);
  h.profile = config => response(config, profile); assert.equal(await h.authSession.retrySession(), true);
  for (const onboardingCompleted of [undefined, null, "false", 0]) assert.throws(() => userFromProfile({ ...profile, onboardingCompleted }, identity));
});

test("failed profile refresh keeps incomplete status until server confirmation", async t => {
  const h = harness(t); h.profile = config => response(config, { ...profile, onboardingCompleted: false });
  await h.ready(); h.profile = () => { throw new Error("offline"); };
  assert.equal(await h.authSession.refreshUser(), false);
  assert.equal(authDestination(h.authSession.getSnapshot().token, h.authSession.getSnapshot().user), "/onboarding");
});

test("an empty Cognito session stays signed out without API requests", async t => {
  const h = harness(t, { session: null });
  await h.ready();
  assert.equal(h.authSession.getSnapshot().token, null);
  assert.equal(h.authSession.getSnapshot().user, null);
  assert.equal(h.calls.length, 0);
});

test("a profile outage preserves the Cognito token and can be retried", async t => {
  const h = harness(t);
  h.profile = config => { throw new AxiosError("Network Error", "ERR_NETWORK", config); };
  await h.ready();
  assert.equal(h.authSession.getSnapshot().token, identity.token);
  assert.ok(h.authSession.getSnapshot().sessionError);
  h.profile = config => response(config, profile);
  assert.equal(await h.authSession.retrySession(), true);
  assert.equal(h.authSession.getSnapshot().user.id, identity.userId);
  assert.deepEqual(h.authCalls.at(-1), ["getSession", true]);
});

for (const failure of ["timeout", 403, 429, 500]) {
  test(`preserves a restored Cognito session when profile loading encounters ${failure}`, async t => {
    const h = harness(t);
    h.profile = config => {
      throw typeof failure === "number"
        ? httpError(config, failure)
        : new AxiosError(failure, "ECONNABORTED", config);
    };
    await h.ready();
    assert.equal(h.authSession.getSnapshot().token, identity.token);
    assert.equal(h.authSession.getSnapshot().user, null);
    assert.ok(h.authSession.getSnapshot().sessionError);
    assert.equal(h.authCalls.filter(call => call[0] === "signOut").length, 0);
  });
}

test("keeps an already loaded profile during an outage and recovers on retry", async t => {
  const h = harness(t);
  await h.ready();
  h.profile = config => { throw new AxiosError("Network Error", "ERR_NETWORK", config); };
  assert.equal(await h.authSession.refreshUser(), false);
  assert.equal(h.authSession.getSnapshot().user.id, identity.userId);
  h.profile = config => response(config, { ...profile, coins: 35 });
  assert.equal(await h.authSession.retrySession(), true);
  assert.equal(h.authSession.getSnapshot().user.coins, 35);
});

test("a 401 expires the local session and signs out of Cognito", async t => {
  const h = harness(t);
  h.profile = config => { throw httpError(config, 401); };
  await h.ready();
  assert.equal(h.authSession.getSnapshot().token, null);
  assert.match(h.authSession.getSnapshot().sessionNotice, /expired/);
  assert.ok(h.authCalls.some(call => call[0] === "signOut"));
});

test("ACCOUNT_NOT_FOUND clears a stale Cognito session without retrying", async t => {
  const h = harness(t);
  h.profile = config => {
    throw httpError(config, 403, {
      error: { code: "ACCOUNT_NOT_FOUND", message: "Player account no longer exists.", details: [] },
    });
  };
  await h.ready();
  assert.equal(h.authSession.getSnapshot().token, null);
  assert.equal(h.authSession.getSnapshot().user, null);
  assert.match(h.authSession.getSnapshot().sessionNotice, /account no longer exists/i);
  assert.equal(h.authCalls.filter(call => call[0] === "signOut").length, 1);
  assert.equal(h.authCalls.filter(call => call[0] === "getSession").length, 1);
});

test("login uses Cognito and never posts credentials to the API", async t => {
  const h = harness(t, { session: null });
  await h.ready();
  await h.authSession.login("second@example.test", "test-password");
  assert.deepEqual(h.authCalls.find(call => call[0] === "signIn"), ["signIn", "second@example.test", "test-password"]);
  assert.ok(h.calls.every(call => call.url === "/me" || call.url === "/entitlements"));
  assert.ok(h.calls.every(call => call.headers.get("Authorization") === `Bearer ${nextIdentity.token}`));
  assert.equal(h.authSession.getSnapshot().user.id, nextIdentity.userId);
});

test("failed Cognito login does not invalidate an existing session", async t => {
  const h = harness(t);
  await h.ready();
  h.auth.signIn = async () => { throw new Error("NotAuthorizedException"); };
  await assert.rejects(h.authSession.login("wrong@example.test", "wrong-password"));
  assert.equal(h.authSession.getSnapshot().token, identity.token);
  assert.equal(h.authSession.getSnapshot().user.id, identity.userId);
});

test("registration and confirmation stay in Cognito before loading the API profile", async t => {
  const h = harness(t, { session: null });
  await h.ready();
  assert.equal(
    await h.authSession.register("Test Hero", "hero@example.test", "test-password", "GIRL"),
    "CONFIRM_SIGN_UP",
  );
  await h.authSession.confirmRegistration("hero@example.test", "123456", "test-password");
  assert.deepEqual(h.authCalls.find(call => call[0] === "signUp"), ["signUp", "Test Hero", "hero@example.test", "test-password"]);
  assert.deepEqual(h.authCalls.find(call => call[0] === "confirmSignUp"), ["confirmSignUp", "hero@example.test", "123456"]);
  assert.equal(h.authSession.getSnapshot().user.id, nextIdentity.userId);
});

test("concurrent profile refreshes share one forced Cognito refresh", async t => {
  const h = harness(t);
  await h.ready();
  const pending = deferred();
  h.auth.getSession = async forceRefresh => {
    h.authCalls.push(["getSession", forceRefresh ?? false]);
    await pending.promise;
    return identity;
  };
  const refreshes = Array.from({ length: 10 }, () => h.authSession.refreshUser());
  assert.ok(refreshes.every(refresh => refresh === refreshes[0]));
  await nextTick();
  assert.equal(h.authCalls.filter(call => call[0] === "getSession" && call[1] === true).length, 1);
  pending.resolve();
  assert.ok((await Promise.all(refreshes)).every(Boolean));
});

test("startup stores the device IANA zone before publishing the account", async t => {
  const h = harness(t, { deviceTimeZone: "America/Los_Angeles" });
  let published = false;
  h.saveProfile = config => {
    assert.equal(h.authSession.getSnapshot().user, null);
    assert.deepEqual(JSON.parse(config.data), { timeZone: "America/Los_Angeles" });
    published = true;
    return response(config, { timeZone: "America/Los_Angeles" });
  };
  await h.ready();
  assert.ok(published);
  assert.equal(h.authSession.getSnapshot().user.timeZone, "America/Los_Angeles");
  assert.equal(h.authSession.getSnapshot().sessionError, null);
});

test("account refresh follows a changed device zone and deduplicates concurrent timezone writes", async t => {
  const h = harness(t); await h.ready();
  let stored = profile.timeZone;
  h.profile = config => response(config, { ...profile, timeZone: stored });
  h.saveProfile = config => { stored = JSON.parse(config.data).timeZone; return response(config, { timeZone: stored }); };
  h.deviceTimeZone = "Asia/Tokyo";
  assert.ok((await Promise.all(Array.from({ length: 8 }, () => h.authSession.refreshUser()))).every(Boolean));
  assert.equal(h.authSession.getSnapshot().user.timeZone, "Asia/Tokyo");
  assert.equal(h.calls.filter(c => c.method === "patch").length, 1);
  await h.authSession.refreshUser();
  assert.equal(h.calls.filter(c => c.method === "patch").length, 1, "unchanged zone needs no write");
});

test("existing abbreviated profiles migrate even if device detection is unavailable", async t => {
  for (const [legacy, iana] of [["EST", "America/New_York"], ["CST", "America/Chicago"],
    ["MST", "America/Denver"], ["PST", "America/Los_Angeles"]]) {
    const h = harness(t, { deviceTimeZone: null });
    h.profile = config => response(config, { ...profile, timeZone: legacy });
    await h.ready();
    assert.equal(h.authSession.getSnapshot().user.timeZone, iana);
    assert.deepEqual(JSON.parse(h.calls.find(c => c.method === "patch").data), { timeZone: iana });
  }
});

test("offline timezone sync keeps the confirmed saved zone, surfaces a retry, and later recovers", async t => {
  const h = harness(t, { deviceTimeZone: "Europe/London" });
  h.saveProfile = () => { throw new Error("offline"); };
  await h.ready();
  assert.equal(h.authSession.getSnapshot().user.timeZone, profile.timeZone);
  assert.match(h.authSession.getSnapshot().sessionError, /last confirmed time zone/);
  h.saveProfile = config => response(config, JSON.parse(config.data));
  assert.equal(await h.authSession.retrySession(), true);
  assert.equal(h.authSession.getSnapshot().user.timeZone, "Europe/London");
  assert.equal(h.authSession.getSnapshot().sessionError, null);
});

test("a timezone write finishing after logout cannot restore the old account", async t => {
  const h = harness(t); await h.ready();
  h.deviceTimeZone = "Asia/Tokyo";
  const pending = deferred();
  h.saveProfile = config => pending.promise.then(() => response(config, { timeZone: "Asia/Tokyo" }));
  const refresh = h.authSession.refreshUser(); await nextTick();
  await h.authSession.logout(); pending.resolve();
  assert.equal(await refresh, false); assert.equal(h.authSession.getSnapshot().user, null);
});

test("a late profile response cannot restore a signed-out session", async t => {
  const h = harness(t);
  await h.ready();
  const pending = deferred();
  h.profile = config => pending.promise.then(() => response(config, profile));
  const refresh = h.authSession.refreshUser();
  await nextTick();
  await h.authSession.logout();
  pending.resolve();
  assert.equal(await refresh, false);
  assert.equal(h.authSession.getSnapshot().token, null);
  assert.equal(h.authSession.getSnapshot().user, null);
});

for (const staleStatus of [200, 401]) {
  test(`a stale ${staleStatus} profile response cannot overwrite a newer login`, async t => {
    const h = harness(t);
    await h.ready();
    const pending = deferred();
    let profileCalls = 0;
    h.profile = async config => {
      profileCalls++;
      if (profileCalls === 1) {
        await pending.promise;
        if (staleStatus === 401) throw httpError(config, 401);
      }
      return response(config, { ...profile, displayName: "Second Hero" });
    };
    const refresh = h.authSession.refreshUser();
    await nextTick();
    await h.authSession.login("second@example.test", "test-password");
    pending.resolve();
    assert.equal(await refresh, false);
    assert.equal(h.authSession.getSnapshot().token, nextIdentity.token);
    assert.equal(h.authSession.getSnapshot().user.id, nextIdentity.userId);
  });
}

test("failed Cognito sign-out leaves the current account available", async t => {
  const h = harness(t);
  await h.ready();
  h.auth.signOut = async () => { throw new Error("Sign-out unavailable"); };
  await assert.rejects(h.authSession.logout());
  assert.equal(h.authSession.getSnapshot().token, identity.token);
  assert.equal(h.authSession.getSnapshot().user.id, identity.userId);
});

test("a deleted account clears local session state even if Cognito sign-out fails", async t => {
  const h = harness(t);
  await h.ready();
  h.auth.signOut = async () => { throw new Error("Identity is already deleted"); };
  await h.authSession.clearDeletedAccountSession();
  assert.equal(h.authSession.getSnapshot().token, null);
  assert.equal(h.authSession.getSnapshot().user, null);
  assert.equal(h.authSession.getSnapshot().sessionError, null);
});

test("a delayed expiry sign-out finishes before a later login starts", async t => {
  const h = harness(t);
  const signOut = deferred();
  h.profile = config => { throw httpError(config, 401); };
  h.auth.signOut = async () => {
    h.authCalls.push(["signOut"]);
    await signOut.promise;
  };
  await h.ready();
  h.profile = config => response(config, profile);
  const login = h.authSession.login("second@example.test", "test-password");
  await nextTick();
  assert.equal(h.authCalls.some(call => call[0] === "signIn"), false);
  signOut.resolve();
  await login;
  assert.equal(h.authSession.getSnapshot().token, nextIdentity.token);
});

test("profile mapping preserves progression and premium state", () => {
  const user = userFromProfile(profile, identity, { plan: "PREMIUM", subscriptionStatus: "ACTIVE" });
  assert.deepEqual(user, {
    onboardingCompleted: true,
    id: identity.userId,
    username: profile.displayName,
    email: identity.email,
    timeZone: profile.timeZone,
    totalXp: 200,
    level: 3,
    xpIntoLevel: 50,
    xpForNextLevel: 200,
    xpToNextLevel: 150,
    progressPercent: 25,
    currentStreak: 0,
    longestStreak: 0,
    coins: 20,
    premiumActive: true,
  });
});


test("Profile keeps its confirmed identity on refresh, writes display cache only on success and clears it on logout", async t => {
  const { cache } = memoryCache(); const h = harness(t, { cache }); await h.ready();
  assert.deepEqual(cache.peek(identity.userId, "profile"), profile);
  const pending = deferred(); h.profile = config => pending.promise.then(() => response(config, { ...profile, displayName: "Updated Hero" }));
  const refresh = h.authSession.refreshUser(); await nextTick();
  assert.equal(h.authSession.getSnapshot().user.username, "Test Hero"); assert.equal(h.authSession.getSnapshot().loading, false);
  pending.resolve(); await refresh; assert.equal(cache.peek(identity.userId, "profile").displayName, "Updated Hero");
  h.profile = () => { throw Error("offline"); }; assert.equal(await h.authSession.refreshUser(), false);
  assert.equal(h.authSession.getSnapshot().user.username, "Updated Hero"); assert.equal(cache.peek(identity.userId, "profile").displayName, "Updated Hero");
  await h.authSession.logout(); assert.equal(cache.peek(identity.userId, "profile"), null);
});

test("persisted Profile never establishes auth, onboarding or Premium authority without a Cognito identity", async t => {
  const { cache } = memoryCache(); cache.set(identity.userId, "profile", { ...profile, premiumActive: true });
  const h = harness(t, { cache, session: null }); h.profile = () => { throw Error("offline"); }; await h.ready();
  assert.equal(h.authSession.getSnapshot().user, null); assert.equal(h.authSession.getSnapshot().entitlements.premium, false);
  assert.equal(authDestination(h.authSession.getSnapshot().token, h.authSession.getSnapshot().user), "/login");
  assert.equal(h.calls.length, 0);
});

test("cold startup publishes the same account's disk profile and resources before AWS responds, then reconciles", async t => {
  const first = memoryCache();
  const saved = { ...profile, premiumActive: true, coins: 481 };
  for (const [resource, data] of Object.entries({ profile: saved, inventory, tasks, goals, achievements,
    shop: { player: { coins: 481, level: 3 }, items: [] } })) first.cache.set(identity.userId, resource, data);
  await nextTick();
  const cache = new PlayerCache(first.storage, "test"), network = deferred();
  const h = harness(t, { cache });
  h.profile = config => network.promise.then(() => response(config, { ...profile, coins: 99 }));
  h.entitlement = () => { throw Error("offline"); };
  await h.ready();
  assert.equal(h.authSession.getSnapshot().user.coins, 481);
  assert.equal(h.authSession.getSnapshot().user.id, identity.userId);
  assert.equal(h.authSession.getSnapshot().loading, false);
  assert.equal(h.authSession.getSnapshot().user.premiumActive, false);
  assert.equal(h.authSession.getSnapshot().entitlementsConfirmed, false);
  for (const resource of ["inventory", "shop", "tasks", "goals", "achievements"]) assert.ok(cache.peek(identity.userId, resource));
  const refresh = h.authSession.refreshUser();
  assert.equal(h.calls.filter(call => call.url === "/me").length, 1, "Home reuses the startup profile refresh");
  network.resolve(); await refresh;
  assert.equal(h.authSession.getSnapshot().user.coins, 99);
  await nextTick();
  const restarted = new PlayerCache(first.storage, "test"); await restarted.hydrateUser(identity.userId);
  assert.equal(restarted.peek(identity.userId, "profile").coins, 99);
});

test("offline cold startup keeps the last profile visible and cannot grant cached Premium", async t => {
  const first = memoryCache(); first.cache.set(identity.userId, "profile", { ...profile, premiumActive: true }); await nextTick();
  const h = harness(t, { cache: new PlayerCache(first.storage, "test") });
  h.profile = () => { throw Error("offline"); }; h.entitlement = () => { throw Error("offline"); };
  await h.ready(); await nextTick();
  assert.equal(h.authSession.getSnapshot().user.username, profile.displayName);
  assert.equal(h.authSession.getSnapshot().user.premiumActive, false);
  assert.match(h.authSession.getSnapshot().sessionError, /Couldn't refresh/);
});

test("first launch and an incomplete cached profile wait for fresh onboarding state", async t => {
  for (const saved of [null, { ...profile, onboardingCompleted: false }]) {
    const { cache } = memoryCache(); if (saved) cache.set(identity.userId, "profile", saved);
    const pending = deferred(); const h = harness(t, { cache });
    h.profile = config => pending.promise.then(() => response(config, profile));
    await nextTick(); assert.equal(h.authSession.getSnapshot().loading, true); assert.equal(h.authSession.getSnapshot().user, null);
    pending.resolve(); await h.ready(); assert.equal(h.authSession.getSnapshot().user.onboardingCompleted, true);
  }
});

test("startup never hydrates another account and late disk reads cannot resurrect logout/deleted sessions", async t => {
  const first = memoryCache(); first.cache.set(identity.userId, "profile", profile); await nextTick();
  const fresh = new PlayerCache(first.storage, "test"), pendingProfile = deferred();
  const other = harness(t, { cache: fresh, session: nextIdentity });
  other.profile = config => pendingProfile.promise.then(() => response(config, { ...profile, displayName: "Second Hero" }));
  await nextTick(); assert.equal(other.authSession.getSnapshot().user, null); assert.equal(fresh.peek(nextIdentity.userId, "profile"), null);
  pendingProfile.resolve(); await other.ready(); assert.equal(other.authSession.getSnapshot().user.id, nextIdentity.userId);
  for (const clear of ["logout", "clearDeletedAccountSession"]) {
    const disk = deferred(), cache = new PlayerCache({ getItem: () => disk.promise, setItem: async () => {}, removeItem: async () => {} }, "test");
    const h = harness(t, { cache }); await nextTick();
    await h.authSession[clear](); disk.resolve(JSON.stringify({ version: 1, data: profile })); await nextTick();
    assert.equal(h.authSession.getSnapshot().user, null); assert.equal(h.authSession.getSnapshot().token, null);
    assert.equal(cache.peek(identity.userId, "profile"), null);
  }
});

test("a cold disk response cannot overwrite a newer confirmed profile mutation", async t => {
  const disk = deferred(), network = deferred();
  const cache = new PlayerCache({ getItem: () => disk.promise, setItem: async () => {}, removeItem: async () => {} }, "test");
  const h = harness(t, { cache }); h.profile = config => network.promise.then(() => response(config, { ...profile, coins: 73 }));
  await nextTick(); cache.set(identity.userId, "profile", { ...profile, coins: 73 });
  disk.resolve(JSON.stringify({ version: 1, data: { ...profile, coins: 99999 } })); await h.ready();
  assert.equal(h.authSession.getSnapshot().user.coins, 73); network.resolve(); await h.authSession.refreshUser();
  assert.equal(h.authSession.getSnapshot().user.coins, 73);
});

test("fresh server onboarding state replaces the cached completed display profile", async t => {
  const { cache } = memoryCache(); cache.set(identity.userId, "profile", profile);
  const network = deferred(), h = harness(t, { cache });
  h.profile = config => network.promise.then(() => response(config, { ...profile, onboardingCompleted: false }));
  await h.ready(); assert.equal(h.authSession.getSnapshot().user.onboardingCompleted, true);
  network.resolve(); await h.authSession.refreshUser();
  assert.equal(authDestination(h.authSession.getSnapshot().token, h.authSession.getSnapshot().user), "/onboarding");
});

test("switching accounts during cold disk hydration cannot publish or repopulate the previous account", async t => {
  const disk = deferred();
  const cache = new PlayerCache({ getItem: key => key.includes(encodeURIComponent(identity.userId)) ? disk.promise : Promise.resolve(null),
    setItem: async () => {}, removeItem: async () => {} }, "test");
  const h = harness(t, { cache }); await nextTick();
  await h.authSession.login("second@example.test", "password");
  assert.equal(h.authSession.getSnapshot().user.id, nextIdentity.userId);
  disk.resolve(JSON.stringify({ version: 1, data: { ...profile, displayName: "Old Hero" } })); await nextTick();
  assert.equal(h.authSession.getSnapshot().user.id, nextIdentity.userId);
  assert.equal(cache.peek(identity.userId, "profile"), null);
});

test("session hydrates equipment and Base, then awaits equipped asset warm-up before cached tabs can mount", async t => {
  const first = memoryCache();
  for (const [resource, data] of Object.entries({ profile, inventory, world, baseLayout })) first.cache.set(identity.userId, resource, data);
  await nextTick();
  const cache = new PlayerCache(first.storage, "test"), sprites = deferred(), backend = deferred(); let preparations = 0;
  const h = harness(t, { cache, prepareDisplay: async userId => {
    preparations++;
    assert.equal(userId, identity.userId); assert.deepEqual(cache.peek(userId, "inventory"), inventory);
    assert.deepEqual(cache.peek(userId, "world"), world); assert.deepEqual(cache.peek(userId, "baseLayout"), baseLayout);
    await sprites.promise;
  } });
  h.profile = config => backend.promise.then(() => response(config, profile));
  await nextTick();
  assert.equal(preparations, 1); assert.equal(h.authSession.getSnapshot().loading, true);
  assert.equal(h.authSession.getSnapshot().user, null); assert.equal(h.calls.length, 0);
  sprites.resolve(); await h.ready();
  assert.equal(h.authSession.getSnapshot().user.id, identity.userId); assert.equal(h.authSession.getSnapshot().loading, false);
  backend.resolve(); await h.authSession.refreshUser();
});

test("asset warm-up failure keeps cached equipment usable and logout during warm-up cannot restore it", async t => {
  const first = memoryCache(); first.cache.set(identity.userId, "profile", profile);
  const h = harness(t, { cache: first.cache, prepareDisplay: async () => { throw Error("native image unavailable"); } });
  h.profile = () => { throw Error("offline"); }; await h.ready();
  assert.equal(h.authSession.getSnapshot().user.username, profile.displayName);
  const second = memoryCache(); second.cache.set(identity.userId, "profile", profile);
  const sprites = deferred(), g = harness(t, { cache: second.cache, prepareDisplay: () => sprites.promise });
  await nextTick(); await g.authSession.logout(); sprites.resolve(); await nextTick();
  assert.equal(g.authSession.getSnapshot().user, null); assert.equal(second.cache.peek(identity.userId, "profile"), null);
});

test("a fresh profile read waiting on sprites cannot undo a newer confirmed appearance mutation", async t => {
  const { cache } = memoryCache(), sprites = deferred(); let prepare = false;
  const h = harness(t, { cache, prepareDisplay: () => prepare ? sprites.promise : Promise.resolve() }); await h.ready();
  prepare = true;
  let data = profile; h.profile = config => response(config, data);
  const refresh = h.authSession.refreshUser(); await nextTick();
  data = { ...profile, displayName: "New appearance owner", bodyType: "GIRL" };
  cache.set(identity.userId, "profile", data); sprites.resolve(); await refresh;
  assert.equal(h.authSession.getSnapshot().user.username, "New appearance owner");
  assert.equal(cache.peek(identity.userId, "profile").bodyType, "GIRL");
});

test("an older session refresh cannot undo a confirmed profile change or use cached onboarding instead of the server", async t => {
  const { cache } = memoryCache(); const h = harness(t, { cache }); await h.ready();
  const old = deferred(); let reads = 0;
  const confirmed = { ...profile, displayName: "Saved name", coins: 73, onboardingCompleted: true };
  h.profile = config => ++reads === 1 ? old.promise.then(() => response(config, profile)) : response(config, confirmed);
  const refresh = h.authSession.refreshUser(); await nextTick();
  cache.invalidate(identity.userId, ["profile"]);
  cache.set(identity.userId, "profile", { ...profile, displayName: "Saved name", onboardingCompleted: false, coins: 99999 });
  old.resolve(); assert.equal(await refresh, true);
  assert.equal(reads, 2); assert.equal(h.authSession.getSnapshot().user.username, "Saved name");
  assert.equal(h.authSession.getSnapshot().user.coins, 73);
  assert.equal(h.authSession.getSnapshot().user.onboardingCompleted, true);
  assert.deepEqual(cache.peek(identity.userId, "profile"), confirmed);
});
