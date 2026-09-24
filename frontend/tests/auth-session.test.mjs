import assert from "node:assert/strict";
import { setImmediate as nextTick } from "node:timers/promises";
import test from "node:test";
import axios, { AxiosError } from "axios";
import { AuthSession, userFromProfile } from "../src/auth/session.ts";

const identity = { token: "saved-id-token", userId: "user-sub-1", email: "hero@example.test" };
const nextIdentity = { token: "new-id-token", userId: "user-sub-2", email: "second@example.test" };
const profile = {
  displayName: "Test Hero", level: 3, xp: 200, xpIntoLevel: 50,
  xpForNextLevel: 200, xpToNextLevel: 150, coins: 20, timeZone: "America/New_York",
};
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const response = (config, data) => ({ config, data, status: 200, statusText: "OK", headers: {} });
const httpError = (config, status) => new AxiosError(`Request failed: ${status}`, "ERR_BAD_RESPONSE", config, null, { ...response(config, {}), status });

function harness(t, { session = identity } = {}) {
  const calls = [], authCalls = [];
  const h = {
    calls,
    authCalls,
    session,
    profile: config => response(config, profile),
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
    if (config.url === "/me") return h.profile(config);
    if (config.url === "/entitlements") return h.entitlement(config);
    return response(config, {});
  } });
  h.authSession = new AuthSession(h.client, h.auth);
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
    id: identity.userId,
    username: profile.displayName,
    email: identity.email,
    timeZone: profile.timeZone,
    totalXp: 200,
    level: 3,
    xpToNextLevel: 150,
    progressPercent: 25,
    currentStreak: 0,
    longestStreak: 0,
    coins: 20,
    premiumActive: true,
  });
});
