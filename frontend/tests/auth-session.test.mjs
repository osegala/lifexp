import assert from "node:assert/strict";
import { setImmediate as nextTick } from "node:timers/promises";
import test from "node:test";
import axios, { AxiosError } from "axios";
import { AuthSession } from "../src/auth/session.ts";

const user = { id: 1, username: "Test Hero", email: "hero@example.test", level: 3, totalXp: 200, coins: 20, currentStreak: 2, longestStreak: 2, xpToNextLevel: 50, progressPercent: 80, premiumActive: false };
const secondUser = { ...user, id: 2, username: "Second Hero" };
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const response = (config, data) => ({ config, data, status: 200, statusText: "OK", headers: {} });
const httpError = (config, status) => new AxiosError(`Request failed: ${status}`, "ERR_BAD_RESPONSE", config, null, { ...response(config, {}), status });

function harness(t, { token = "saved-token", profile, storage = {} } = {}) {
  const calls = [], writes = [];
  let savedToken = token;
  const h = {
    calls, writes,
    profile: profile ?? (config => response(config, user)),
    other: config => response(config, []),
    auth: config => response(config, { token: "new-token", user: secondUser }),
    get savedToken() { return savedToken; },
  };
  h.client = axios.create({ adapter: async config => {
    calls.push(config);
    if (config.url === "/users/me") return h.profile(config);
    if (config.url === "/users/login" || config.url === "/users/register") return h.auth(config);
    return h.other(config);
  } });
  h.session = new AuthSession(h.client, {
    getToken: async () => savedToken,
    setToken: async value => { writes.push(value); savedToken = value; },
    deleteToken: async () => { writes.push(null); savedToken = null; },
    ...storage,
  });
  const stop = h.session.start();
  t.after(stop);
  h.ready = async () => {
    if (h.session.getSnapshot().loading) {
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => { unsubscribe(); reject(new Error("Session did not finish restoring")); }, 1000);
        const unsubscribe = h.session.subscribe(() => {
          if (!h.session.getSnapshot().loading) {
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

test("restores saved credentials and attaches them to protected requests", async t => {
  const h = harness(t);
  await h.ready();
  assert.equal(h.session.getSnapshot().user.id, 1);
  assert.equal(h.calls[0].headers.get("Authorization"), "Bearer saved-token");
  assert.equal(h.calls[0].timeout, 15000);
  assert.deepEqual(h.writes, []);
});

for (const failure of ["offline", "timeout", 403, 429, 500]) {
  test(`preserves saved sign-in when startup encounters ${failure}`, async t => {
    const h = harness(t, { profile: config => {
      throw typeof failure === "number" ? httpError(config, failure)
        : new AxiosError(failure, failure === "timeout" ? "ECONNABORTED" : "ERR_NETWORK", config);
    } });
    await h.ready();
    assert.equal(h.session.getSnapshot().token, "saved-token");
    assert.equal(h.session.getSnapshot().user, null);
    assert.ok(h.session.getSnapshot().sessionError);
    assert.equal(h.savedToken, "saved-token");
    assert.deepEqual(h.writes, []);
    h.profile = config => response(config, user);
    assert.equal(await h.session.retrySession(), true);
    assert.equal(h.session.getSnapshot().user.id, 1);
    assert.equal(h.session.getSnapshot().sessionError, null);
  });
}

test("keeps an already loaded account during an outage and recovers on retry", async t => {
  const h = harness(t);
  await h.ready();
  const refresh = h.session.refreshUser;
  h.profile = config => { throw new AxiosError("Network Error", "ERR_NETWORK", config); };
  assert.equal(await refresh(), false);
  assert.equal(h.session.getSnapshot().user, user);
  assert.equal(h.savedToken, "saved-token");
  h.profile = config => response(config, { ...user, coins: 35 });
  assert.equal(await h.session.retrySession(), true);
  assert.equal(h.session.getSnapshot().user.coins, 35);
  assert.equal(h.session.getSnapshot().sessionError, null);
  assert.equal(h.session.refreshUser, refresh);
});

test("invalid startup credentials are cleared with an expired-session notice", async t => {
  const h = harness(t, { profile: config => { throw httpError(config, 401); } });
  await h.ready();
  assert.equal(h.session.getSnapshot().token, null);
  assert.equal(h.session.getSnapshot().user, null);
  assert.match(h.session.getSnapshot().sessionNotice, /expired/);
  assert.equal(h.savedToken, null);
  assert.deepEqual(h.writes, [null]);
});

test("a 401 from any protected screen ends the session only once", async t => {
  const h = harness(t);
  await h.ready();
  h.other = config => { throw httpError(config, 401); };
  await Promise.allSettled([h.client.get("/avatar"), h.client.get("/shop")]);
  await nextTick();
  assert.equal(h.session.getSnapshot().token, null);
  assert.deepEqual(h.writes, [null]);
});

test("wrong login details neither send old credentials nor invalidate a current session", async t => {
  const h = harness(t);
  await h.ready();
  h.auth = config => {
    assert.equal(config.headers.get("Authorization"), undefined);
    throw httpError(config, 401);
  };
  await assert.rejects(h.session.login("hero@example.test", "test-password"));
  assert.equal(h.session.getSnapshot().token, "saved-token");
  assert.deepEqual(h.writes, []);
});

test("concurrent account refreshes share one request", async t => {
  const h = harness(t);
  await h.ready();
  const pending = deferred();
  h.profile = config => pending.promise.then(() => response(config, user));
  const promises = Array.from({ length: 10 }, () => h.session.refreshUser());
  assert.ok(promises.every(promise => promise === promises[0]));
  await nextTick();
  assert.equal(h.calls.filter(call => call.url === "/users/me").length, 2);
  pending.resolve();
  assert.ok((await Promise.all(promises)).every(Boolean));
});

test("a late profile response cannot restore a logged-out user", async t => {
  const h = harness(t);
  await h.ready();
  const pending = deferred();
  h.profile = config => pending.promise.then(() => response(config, user));
  const refresh = h.session.refreshUser();
  await nextTick();
  await h.session.logout();
  pending.resolve();
  assert.equal(await refresh, false);
  assert.equal(h.session.getSnapshot().token, null);
  assert.equal(h.session.getSnapshot().user, null);
  assert.equal(h.savedToken, null);
});

for (const status of [200, 401]) {
  test(`an old ${status} response cannot overwrite or sign out a new session`, async t => {
    const h = harness(t);
    await h.ready();
    const pending = deferred();
    h.profile = async config => {
      await pending.promise;
      if (status === 401) throw httpError(config, 401);
      return response(config, user);
    };
    const refresh = h.session.refreshUser();
    await nextTick();
    await h.session.login("second@example.test", "test-password");
    pending.resolve();
    assert.equal(await refresh, false);
    assert.equal(h.session.getSnapshot().user.id, 2);
    assert.equal(h.session.getSnapshot().token, "new-token");
    assert.equal(h.savedToken, "new-token");
  });
}

test("slow credential deletion cannot erase a later successful login", async t => {
  const deletion = deferred();
  let persisted = "saved-token";
  const h = harness(t, { storage: {
    getToken: async () => persisted,
    deleteToken: async () => { await deletion.promise; persisted = null; },
    setToken: async token => { persisted = token; },
  } });
  await h.ready();
  h.other = config => { throw httpError(config, 401); };
  await assert.rejects(h.client.get("/tasks"));
  const login = h.session.login("second@example.test", "test-password");
  await nextTick();
  deletion.resolve();
  await login;
  assert.equal(persisted, "new-token");
  assert.equal(h.session.getSnapshot().user.id, 2);
});

test("a storage read failure does not delete credentials and can be retried", async t => {
  let readable = false;
  const h = harness(t, { storage: { getToken: async () => {
    if (!readable) throw new Error("Storage unavailable");
    return "saved-token";
  } } });
  await h.ready();
  assert.ok(h.session.getSnapshot().sessionError);
  assert.deepEqual(h.writes, []);
  readable = true;
  assert.equal(await h.session.retrySession(), true);
  assert.equal(h.session.getSnapshot().user.id, 1);
});

test("failed manual sign-out leaves the account available for another attempt", async t => {
  const h = harness(t, { storage: { deleteToken: async () => { throw new Error("Storage unavailable"); } } });
  await h.ready();
  await assert.rejects(h.session.logout());
  assert.equal(h.session.getSnapshot().token, "saved-token");
});

test("registration saves the session and preserves the chosen character", async t => {
  const h = harness(t, { token: null });
  await h.ready();
  await h.session.register("Test Hero", "hero@example.test", "test-password", "GIRL");
  const request = h.calls.find(call => call.url === "/users/register");
  assert.equal(JSON.parse(request.data).bodyType, "GIRL");
  assert.equal(request.headers.get("Authorization"), undefined);
  assert.equal(h.savedToken, "new-token");
});

test("a late startup read cannot restore credentials after manual logout", async t => {
  const read = deferred();
  const h = harness(t, { storage: { getToken: () => read.promise } });
  await nextTick();
  await h.session.logout();
  read.resolve("old-token");
  await h.ready();
  assert.equal(h.session.getSnapshot().token, null);
  assert.equal(h.calls.length, 0);
});

test("provider effect restart ignores the old startup request", async () => {
  const read = deferred();
  let reads = 0;
  const calls = [];
  const client = axios.create({ adapter: async config => { calls.push(config); return response(config, user); } });
  const session = new AuthSession(client, {
    getToken: async () => ++reads === 1 ? read.promise : "current-token",
    setToken: async () => {},
    deleteToken: async () => {},
  });
  const stopFirst = session.start();
  await nextTick();
  stopFirst();
  const stopSecond = session.start();
  await nextTick();
  read.resolve("old-token");
  await nextTick();
  assert.equal(session.getSnapshot().token, "current-token");
  assert.equal(session.getSnapshot().loading, false);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].headers.get("Authorization"), "Bearer current-token");
  stopSecond();
});

test("failure to persist a new login does not leave it authenticated", async t => {
  const h = harness(t, { token: null, storage: { setToken: async () => { throw new Error("Storage unavailable"); } } });
  await h.ready();
  await assert.rejects(h.session.login("hero@example.test", "test-password"));
  assert.equal(h.session.getSnapshot().token, null);
  assert.equal(h.session.getSnapshot().user, null);
  assert.match(h.session.getSnapshot().sessionNotice, /save your sign-in/);
});
