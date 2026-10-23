import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { PlayerCache, SupersededCacheRead } from "../src/cache/PlayerCache.ts";
import { memoryCache, deferred, profile, inventory, tasks, goals, achievements, world, baseLayout } from "./cache-test-support.mjs";
const tick = () => new Promise(setImmediate);
const catalog = { player: { coins: 481, level: 2 }, items: [{ itemId: "top", name: "Top", category: "tunic", assetKey: "forest-tunic.png",
  owned: false, canPurchase: true, effectivePrice: 73, effectiveRequiredLevel: 1 }] };

test("memory immediately supplies all successful server snapshots including actual equipment; disk survives a new cache instance", async () => {
  const { cache, storage } = memoryCache();
  const equipped = { ...inventory, equipped: { ...inventory.equipped, tunic: "top" } };
  for (const [key, data] of Object.entries({ profile, inventory: equipped, shop: catalog })) {
    await cache.refresh("alice", key, async () => data);
    assert.deepEqual(cache.peek("alice", key), data);
  }
  await tick();
  const restarted = new PlayerCache(storage, "test");
  assert.equal(restarted.peek("alice", "inventory"), null);
  await restarted.hydrateUser("alice");
  assert.equal(restarted.peek("alice", "inventory").equipped.tunic, "top");
  assert.equal(restarted.peek("alice", "profile").bodyType, "GIRL");
  assert.deepEqual(restarted.peek("alice", "shop"), catalog);
});

test("stale data remains readable during a deduplicated refresh and a network failure never replaces it", async () => {
  const { cache } = memoryCache(); cache.set("alice", "shop", catalog);
  const request = deferred(); let calls = 0;
  const load = () => { calls++; return request.promise; };
  const first = cache.refresh("alice", "shop", load), second = cache.refresh("alice", "shop", load);
  assert.equal(first, second); assert.equal(calls, 1);
  assert.deepEqual(cache.peek("alice", "shop"), catalog);
  request.reject(new Error("offline")); await assert.rejects(first, /offline/);
  assert.deepEqual(cache.peek("alice", "shop"), catalog);
  const updated = { ...catalog, player: { coins: 408, level: 2 }, items: [{ ...catalog.items[0], owned: true, canPurchase: false }] };
  await cache.refresh("alice", "shop", async () => updated);
  assert.deepEqual(cache.peek("alice", "shop"), updated);
});

test("accounts and backend environments cannot share snapshots", async () => {
  const { cache, storage } = memoryCache("dev"); cache.set("alice", "shop", catalog); await tick();
  assert.equal(cache.peek("bob", "shop"), null); await cache.hydrateUser("bob");
  assert.equal(cache.peek("bob", "shop"), null);
  const prod = new PlayerCache(storage, "prod"); await prod.hydrateUser("alice");
  assert.equal(prod.peek("alice", "shop"), null);
});

test("missing, malformed and incompatible disk data are misses; failed or invalid responses keep the last valid cache", async () => {
  const { cache, values } = memoryCache();
  await cache.hydrateUser("alice"); assert.equal(cache.peek("alice", "profile"), null);
  cache.set("alice", "shop", catalog); await tick();
  const key = [...values.keys()][0];
  for (const raw of ["invalid json", "null", JSON.stringify({ version: 2, data: catalog }),
    JSON.stringify({ version: 1, data: { ...catalog, items: [{}] } }), JSON.stringify({ version: 1, data: {} })]) {
    values.set(key, raw); const restarted = memoryCache("test", values).cache;
    assert.equal(await restarted.hydrate("alice", "shop"), null);
  }
  await assert.rejects(cache.refresh("alice", "shop", async () => ({ items: [] })), /Invalid shop/);
  assert.deepEqual(cache.peek("alice", "shop"), catalog);
});

test("a late pre-purchase/equip read cannot overwrite a newer confirmed response", async () => {
  const { cache } = memoryCache(); cache.set("alice", "inventory", inventory);
  const old = deferred(); const read = cache.refresh("alice", "inventory", () => old.promise);
  cache.invalidate("alice", ["inventory"]);
  const equipped = { ...inventory, equipped: { ...inventory.equipped, background: "garden" } };
  await cache.refresh("alice", "inventory", async () => equipped);
  old.resolve(inventory); await assert.rejects(read, SupersededCacheRead);
  assert.deepEqual(cache.peek("alice", "inventory"), equipped);
});

test("late disk hydration cannot undo a confirmed response or resurrect a cleared account", async () => {
  const disk = deferred();
  const storage = { getItem: () => disk.promise, setItem: async () => {}, removeItem: async () => {} };
  const cache = new PlayerCache(storage, "test");
  const hydration = cache.hydrate("alice", "shop"); await tick();
  cache.set("alice", "shop", catalog);
  disk.resolve(JSON.stringify({ version: 1, data: { ...catalog, player: { coins: 1, level: 1 } } }));
  await hydration; assert.deepEqual(cache.peek("alice", "shop"), catalog);
  const request = deferred(); const read = cache.refresh("alice", "shop", () => request.promise);
  const accountCurrent = cache.accountCurrent("alice");
  await cache.clearUser("alice"); request.resolve(catalog);
  await assert.rejects(read, SupersededCacheRead); assert.equal(accountCurrent(), false);
  assert.equal(cache.peek("alice", "shop"), null);
});

test("clearing waits behind pending disk writes and removes all snapshots without touching other users", async () => {
  const { cache, storage, values } = memoryCache();
  cache.set("alice", "profile", profile); cache.set("alice", "inventory", inventory); cache.set("alice", "shop", catalog);
  cache.set("bob", "profile", profile);
  await cache.clearUser("alice");
  const restarted = new PlayerCache(storage, "test"); await restarted.hydrateUser("alice"); await restarted.hydrateUser("bob");
  assert.equal(restarted.peek("alice", "profile"), null); assert.equal(restarted.peek("alice", "inventory"), null);
  assert.equal(restarted.peek("alice", "shop"), null); assert.deepEqual(restarted.peek("bob", "profile"), profile);
  assert.equal([...values.keys()].length, 1);
});

test("storage failures do not block authoritative in-memory responses, and snapshots do not alias mutable inputs", async () => {
  const cache = new PlayerCache({ getItem: async () => { throw Error("disk unavailable"); },
    setItem: async () => { throw Error("disk full"); }, removeItem: async () => { throw Error("disk unavailable"); } }, "test");
  assert.equal(await cache.hydrate("alice", "shop"), null);
  const response = structuredClone(catalog); await cache.refresh("alice", "shop", async () => response);
  response.player.coins = 0; response.items.length = 0;
  assert.deepEqual(cache.peek("alice", "shop"), catalog); await cache.clearUser("alice");
  assert.equal(cache.peek("alice", "shop"), null);
});

test("direct session/profile reads must not overwrite confirmed appearance mutations", () => {
  const { cache } = memoryCache(); cache.set("alice", "profile", profile);
  const current = cache.checkpoint("alice", "profile");
  cache.invalidate("alice", ["profile"]);
  cache.set("alice", "profile", { ...profile, hairId: "hair_style_2" });
  assert.equal(current(), false);
});

test("all Home display resources survive restart, revalidate successfully and retain good data on failure", async () => {
  const first = memoryCache(), snapshots = { profile, inventory, shop: catalog, tasks, goals, achievements };
  for (const [key, data] of Object.entries(snapshots)) await first.cache.refresh("alice", key, async () => data);
  await tick();
  const restarted = new PlayerCache(first.storage, "test"); await restarted.hydrateUser("alice");
  for (const [key, data] of Object.entries(snapshots)) {
    assert.deepEqual(restarted.peek("alice", key), data);
    const pending = deferred(), refresh = restarted.refresh("alice", key, () => pending.promise);
    assert.deepEqual(restarted.peek("alice", key), data);
    pending.reject(Error("offline")); await assert.rejects(refresh, /offline/);
    assert.deepEqual(restarted.peek("alice", key), data);
    const fresh = { ...data, serverVersion: 2 };
    await restarted.refresh("alice", key, async () => fresh);
    assert.deepEqual(restarted.peek("alice", key), fresh);
  }
  await tick();
  const again = new PlayerCache(first.storage, "test"); await again.hydrateUser("alice");
  assert.equal(again.peek("alice", "goals").serverVersion, 2);
  assert.equal(again.peek("alice", "achievements").serverVersion, 2);
});

test("the full 34-item Premium catalog persists without caching entitlement authority", async () => {
  const premium = JSON.parse(readFileSync(new URL("../../backend/seeds/cosmetics.json", import.meta.url), "utf8"))
    .filter(item => item.requiresPremium).map(item => ({ ...item, owned: false, canPurchase: true,
      effectivePrice: item.price, effectiveRequiredLevel: item.requiredLevel }));
  assert.equal(premium.length, 34);
  const first = memoryCache(); first.cache.set("alice", "shop", { ...catalog, items: premium }); await tick();
  const restarted = new PlayerCache(first.storage, "test"); await restarted.hydrateUser("alice");
  assert.deepEqual(restarted.peek("alice", "shop").items, premium);
  assert.equal(restarted.peek("bob", "shop"), null);
  assert.equal(restarted.peek("alice", "entitlements"), null);
});

test("each corrupt Home resource fails independently while valid profile and equipment hydrate", async () => {
  for (const [key, valid, invalid] of [["tasks", tasks, { ...tasks, tasks: [{}] }],
    ["goals", goals, { ...goals, daily: {} }], ["achievements", achievements, { ...achievements, achievements: [{}] }]]) {
    const first = memoryCache();
    first.cache.set("alice", "profile", profile); first.cache.set("alice", "inventory", inventory); first.cache.set("alice", key, valid); await tick();
    const storageKey = [...first.values.keys()].find(value => value.endsWith(`.${key}`));
    for (const raw of ["broken JSON", JSON.stringify({ version: 1, data: invalid })]) {
      first.values.set(storageKey, raw);
      const restarted = new PlayerCache(first.storage, "test"); await restarted.hydrateUser("alice");
      assert.equal(restarted.peek("alice", key), null);
      assert.deepEqual(restarted.peek("alice", "profile"), profile);
      assert.deepEqual(restarted.peek("alice", "inventory"), inventory);
    }
  }
});

test("late cold reads cannot replace confirmed Home snapshots or restore a cleared account", async () => {
  for (const [key, data] of Object.entries({ tasks, goals, achievements })) {
    const disk = deferred(), cache = new PlayerCache({ getItem: () => disk.promise, setItem: async () => {}, removeItem: async () => {} }, "test");
    const hydration = cache.hydrate("alice", key); await tick();
    cache.set("alice", key, { ...data, confirmedMutation: true });
    disk.resolve(JSON.stringify({ version: 1, data })); await hydration;
    assert.equal(cache.peek("alice", key).confirmedMutation, true);
    const network = deferred(), read = cache.refresh("alice", key, () => network.promise);
    await cache.clearUser("alice"); network.resolve(data);
    await assert.rejects(read, SupersededCacheRead); assert.equal(cache.peek("alice", key), null);
  }
});

test("world and account-specific map placement survive restart and stay isolated across users/environments", async () => {
  const first = memoryCache(); first.cache.set("alice", "world", world); first.cache.set("alice", "baseLayout", baseLayout); await tick();
  const restarted = new PlayerCache(first.storage, "test"); await restarted.hydrateUser("alice"); await restarted.hydrateUser("bob");
  assert.deepEqual(restarted.peek("alice", "world"), world); assert.deepEqual(restarted.peek("alice", "baseLayout"), baseLayout);
  assert.equal(restarted.peek("bob", "world"), null); assert.equal(restarted.peek("bob", "baseLayout"), null);
  const otherEnvironment = new PlayerCache(first.storage, "prod"); await otherEnvironment.hydrateUser("alice");
  assert.equal(otherEnvironment.peek("alice", "world"), null); assert.equal(otherEnvironment.peek("alice", "baseLayout"), null);
  await restarted.clearUser("alice");
  const again = new PlayerCache(first.storage, "test"); await again.hydrateUser("alice");
  assert.equal(again.peek("alice", "world"), null); assert.equal(again.peek("alice", "baseLayout"), null);
});

test("world and layout validation reject malformed data without dropping valid cached state", async () => {
  const { cache } = memoryCache(); cache.set("alice", "world", world); cache.set("alice", "baseLayout", baseLayout);
  for (const value of [{ worldPoints: 412, buildings: [{}] }, { ...world, worldPoints: NaN }]) {
    assert.throws(() => cache.set("alice", "world", value), /Invalid world/);
    assert.deepEqual(cache.peek("alice", "world"), world);
  }
  for (const value of [{}, { ...baseLayout, Workshop: { x: Infinity, y: 0, width: 300, height: 300 } },
    { ...baseLayout, Workshop: { ...baseLayout.Workshop, height: 0 } }]) assert.throws(() => cache.set("alice", "baseLayout", value), /Invalid baseLayout/);
  assert.deepEqual(cache.peek("alice", "baseLayout"), baseLayout);
});

test("late world/layout hydration cannot replace a confirmed upgrade or newly moved building", async () => {
  for (const [resource, before, confirmed] of [["world", world, { ...world, worldPoints: 312 }],
    ["baseLayout", baseLayout, { ...baseLayout, Workshop: { ...baseLayout.Workshop, x: 2500 } }]]) {
    const disk = deferred(), cache = new PlayerCache({ getItem: () => disk.promise, setItem: async () => {}, removeItem: async () => {} }, "test");
    const hydration = cache.hydrate("alice", resource); await tick(); cache.set("alice", resource, confirmed);
    disk.resolve(JSON.stringify({ version: 1, data: before })); await hydration;
    assert.deepEqual(cache.peek("alice", resource), confirmed);
    const old = deferred(), refresh = cache.refresh("alice", resource, () => old.promise);
    cache.set("alice", resource, confirmed); old.resolve(before); await assert.rejects(refresh, SupersededCacheRead);
    assert.deepEqual(cache.peek("alice", resource), confirmed);
  }
});
