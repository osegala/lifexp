import test from "node:test";
import assert from "node:assert/strict";
import {
    effectiveEntitlement,
    entitlementFromItem
} from "../functions/get-entitlements/logic.mjs";
import {
    entitlementItem,
    isDevelopmentTable,
    parseOptions
} from "../scripts/set-dev-entitlement.mjs";

const now = new Date("2026-09-23T12:00:00.000Z");

test("missing entitlement defaults to FREE with ads", () => {
    assert.deepEqual(effectiveEntitlement(null, now), {
        plan: "FREE",
        subscriptionStatus: "FREE",
        adsEnabled: true,
        expiresAt: null,
        autoRenew: false
    });
});

test("FREE entitlement enables ads regardless of stored adsEnabled", () => {
    assert.deepEqual(effectiveEntitlement({
        plan: "FREE",
        subscriptionStatus: "FREE",
        adsEnabled: false,
        autoRenew: true
    }, now), {
        plan: "FREE",
        subscriptionStatus: "FREE",
        adsEnabled: true,
        expiresAt: null,
        autoRenew: false
    });
});

test("ACTIVE PREMIUM disables ads regardless of stored adsEnabled", () => {
    assert.deepEqual(effectiveEntitlement({
        plan: "PREMIUM",
        subscriptionStatus: "ACTIVE",
        adsEnabled: true,
        expiresAt: "2026-10-23T12:00:00.000Z",
        autoRenew: true
    }, now), {
        plan: "PREMIUM",
        subscriptionStatus: "ACTIVE",
        adsEnabled: false,
        expiresAt: "2026-10-23T12:00:00.000Z",
        autoRenew: true
    });
});

test("expired PREMIUM becomes effective FREE with ads", () => {
    assert.deepEqual(effectiveEntitlement({
        plan: "PREMIUM",
        subscriptionStatus: "ACTIVE",
        expiresAt: "2026-09-23T11:59:59.000Z",
        autoRenew: true
    }, now), {
        plan: "FREE",
        subscriptionStatus: "EXPIRED",
        adsEnabled: true,
        expiresAt: "2026-09-23T11:59:59.000Z",
        autoRenew: false
    });
});

test("canceled PREMIUM remains active before expiry and cannot auto-renew", () => {
    assert.deepEqual(effectiveEntitlement({
        plan: "PREMIUM",
        subscriptionStatus: "CANCELED",
        expiresAt: "2026-09-24T12:00:00.000Z",
        autoRenew: true
    }, now), {
        plan: "PREMIUM",
        subscriptionStatus: "CANCELED",
        adsEnabled: false,
        expiresAt: "2026-09-24T12:00:00.000Z",
        autoRenew: false
    });
});

test("malformed entitlement data fails safely", () => {
    for (const record of [
        { plan: "ADMIN", subscriptionStatus: "ACTIVE" },
        { plan: "PREMIUM", subscriptionStatus: "UNKNOWN" },
        { plan: "PREMIUM", subscriptionStatus: "ACTIVE", expiresAt: "not-a-date" },
        { plan: "PREMIUM", subscriptionStatus: "CANCELED" }
    ]) {
        assert.equal(effectiveEntitlement(record, now).plan, "FREE");
        assert.equal(effectiveEntitlement(record, now).adsEnabled, true);
    }
});

test("public entitlement response excludes transaction identifiers", () => {
    const record = entitlementFromItem({
        PK: { S: "USER#user-123" },
        plan: { S: "PREMIUM" },
        subscriptionStatus: { S: "ACTIVE" },
        expiresAt: { S: "2026-10-23T12:00:00.000Z" },
        autoRenew: { BOOL: true },
        originalTransactionId: { S: "original-secret" },
        currentTransactionId: { S: "current-secret" }
    });
    assert.deepEqual(Object.keys(effectiveEntitlement(record, now)), [
        "plan",
        "subscriptionStatus",
        "adsEnabled",
        "expiresAt",
        "autoRenew"
    ]);
});

test("development entitlement script refuses non-development tables", () => {
    assert.equal(isDevelopmentTable("Evrenthia-Dev"), true);
    assert.equal(isDevelopmentTable("Evrenthia"), false);
    assert.equal(isDevelopmentTable("Evrenthia-Production-Dev"), false);
    assert.throws(() => parseOptions([
        "--table", "Evrenthia",
        "--user-sub", "user-123",
        "--plan", "PREMIUM",
        "--region", "us-east-2",
        "--profile", "evrenthia-admin"
    ]), /Refusing non-development table/);
});

test("development entitlement script defaults to dry run and builds stable keys", () => {
    const options = parseOptions([
        "--table", "Evrenthia-Dev",
        "--user-sub", "user-123",
        "--plan", "premium",
        "--region", "us-east-2",
        "--profile", "evrenthia-admin"
    ]);
    assert.equal(options.write, false);
    assert.equal(options.plan, "PREMIUM");

    const item = entitlementItem("user-123", "PREMIUM", now);
    assert.deepEqual(item.PK, { S: "USER#user-123" });
    assert.deepEqual(item.SK, { S: "ENTITLEMENTS" });
    assert.deepEqual(item.adsEnabled, { BOOL: false });
});
