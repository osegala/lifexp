const PLANS = new Set(["FREE", "PREMIUM"]);
const STATUSES = new Set([
    "FREE",
    "ACTIVE",
    "EXPIRED",
    "CANCELED",
    "GRACE_PERIOD"
]);

export function freeEntitlement() {
    return {
        plan: "FREE",
        subscriptionStatus: "FREE",
        adsEnabled: true,
        expiresAt: null,
        autoRenew: false
    };
}

function expiredEntitlement(expiresAt) {
    return {
        ...freeEntitlement(),
        subscriptionStatus: "EXPIRED",
        expiresAt
    };
}

export function entitlementFromItem(item) {
    if (!item?.PK) return null;

    return {
        plan: item.plan?.S,
        subscriptionStatus: item.subscriptionStatus?.S,
        expiresAt: item.expiresAt?.S ?? null,
        autoRenew: item.autoRenew?.BOOL
    };
}

export function effectiveEntitlement(record, now = new Date()) {
    if (!record) return freeEntitlement();

    const { plan, subscriptionStatus } = record;
    if (!PLANS.has(plan) || !STATUSES.has(subscriptionStatus)) {
        return freeEntitlement();
    }

    const expiresAt = record.expiresAt ?? null;
    const expiresAtMs = expiresAt === null ? null : Date.parse(expiresAt);
    if (expiresAt !== null && (typeof expiresAt !== "string" || !Number.isFinite(expiresAtMs))) {
        return freeEntitlement();
    }

    if (plan === "FREE") {
        return freeEntitlement();
    }

    if (subscriptionStatus === "EXPIRED" || (expiresAtMs !== null && expiresAtMs <= now.getTime())) {
        return expiredEntitlement(expiresAt);
    }

    const premiumStatus = new Set(["ACTIVE", "CANCELED", "GRACE_PERIOD"]);
    if (!premiumStatus.has(subscriptionStatus)) {
        return freeEntitlement();
    }

    if (subscriptionStatus === "CANCELED" && expiresAtMs === null) {
        return freeEntitlement();
    }

    return {
        plan: "PREMIUM",
        subscriptionStatus,
        adsEnabled: false,
        expiresAt,
        autoRenew: subscriptionStatus === "CANCELED"
            ? false
            : record.autoRenew === true
    };
}
