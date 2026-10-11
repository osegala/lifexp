import assert from "node:assert/strict";
import test from "node:test";
import { adDebug, adDebugError } from "../src/ads/debug.ts";

test("ad diagnostics log only in development, never in release", t => {
  const previous = globalThis.__DEV__, logs = [];
  t.after(() => { if (previous === undefined) delete globalThis.__DEV__; else globalThis.__DEV__ = previous; });
  t.mock.method(console, "info", (...args) => logs.push(args));
  delete globalThis.__DEV__; adDebug("undefined-build");
  globalThis.__DEV__ = false; adDebug("release");
  assert.deepEqual(logs, []);
  globalThis.__DEV__ = true; adDebug("rewarded.confirmation.success", { duplicate: false, remaining: 2 });
  assert.deepEqual(logs, [["[Evrenthia Ads]", "rewarded.confirmation.success", { duplicate: false, remaining: 2 }]]);
});

test("diagnostics retain only allowlisted error codes, never arbitrary names, messages or request data", () => {
  const jwt = `eyJ${"a".repeat(40)}.payload.signature`, claim = `adm:${"b".repeat(80)}`;
  const details = adDebugError(Object.assign(new Error(`Network failure Bearer short-token ${jwt} ${claim} binding=private-binding`), { code: "ERR_NETWORK" }));
  assert.deepEqual(details, { code: "ERR_NETWORK" });
  assert.doesNotMatch(JSON.stringify(details), new RegExp(`short-token|${jwt}|${claim}|private-binding`));
});

test("diagnostics allowlist API error codes and discard unknown codes or private bodies", () => {
  assert.deepEqual(adDebugError({ response: { data: { binding: "private-binding", providerEventId: "adm:private-claim",
    error: { code: "AD_DAILY_LIMIT", message: "private-user", details: { token: "private-token" } } } } }), { code: "AD_DAILY_LIMIT" });
  for (const error of [null, "private-server-body", { code: "private-transaction", name: "private-user", message: "private-claim" }])
    assert.deepEqual(adDebugError(error), { code: "UNKNOWN" });
});
