import { createHash, timingSafeEqual } from "node:crypto";
import { ApiError } from "/opt/nodejs/http.mjs";
import { effectiveEntitlement, freeEntitlement } from "/opt/nodejs/entitlements.mjs";

const unavailable = () => new ApiError(503, "BILLING_UNAVAILABLE", "Store verification is unavailable. Please retry.");
export const billingEventKey = (userId, id) => ({ PK: { S: `USER#${userId}` },
    SK: { S: `BILLING_EVENT#${createHash("sha256").update(id).digest("hex")}` } });

export function webhookAuthorized(header, secret) {
    if (typeof header !== "string" || !secret || secret.length < 32) return false;
    const a = Buffer.from(header), b = Buffer.from(secret);
    return a.length === b.length && timingSafeEqual(a, b);
}

export function revenueCatConfig(env) {
    let products;
    try { products = JSON.parse(env.REVENUECAT_PRODUCTS ?? "[]"); } catch { throw unavailable(); }
    const providerEnvironment = env.REVENUECAT_ENVIRONMENT;
    if (!env.REVENUECAT_SECRET_API_KEY || !env.REVENUECAT_PROJECT_ID || !env.REVENUECAT_ENTITLEMENT_ID
        || !["sandbox", "production"].includes(providerEnvironment)
        || (providerEnvironment === "sandbox" && env.ENVIRONMENT_NAME !== "dev")
        || !Array.isArray(products) || !products.length || products.length > 8
        || products.some(p => !p?.id || !p.appId || !p.storeIdentifier || !["app_store", "play_store"].includes(p.store))) throw unavailable();
    return { secret: env.REVENUECAT_SECRET_API_KEY, project: env.REVENUECAT_PROJECT_ID,
        entitlement: env.REVENUECAT_ENTITLEMENT_ID, environment: providerEnvironment, products };
}

/** Only the exact authenticated customer, verified premium entitlement and allowlisted native products count. */
export async function verifyCustomer(userId, config, now, request = fetch) {
    const base = `/v2/projects/${encodeURIComponent(config.project)}`;
    const signal = AbortSignal.timeout(15_000);
    const get = async (path, missingIsFree = false) => {
        try {
            const response = await request(`https://api.revenuecat.com${path}`, {
                headers: { Authorization: `Bearer ${config.secret}`, Accept: "application/json" }, signal,
                redirect: "error" });
            if (missingIsFree && response.status === 404) return null;
            if (!response.ok) throw unavailable();
            return await response.json();
        } catch { throw unavailable(); } // Never log provider payloads, customer IDs or credentials.
    };
    const entitlement = await get(`${base}/entitlements/${encodeURIComponent(config.entitlement)}`);
    if (entitlement?.id !== config.entitlement || entitlement.lookup_key !== "premium" || entitlement.project_id !== config.project) throw unavailable();
    const path = `${base}/customers/${encodeURIComponent(userId)}`;
    const customer = await get(path, true);
    if (!customer) return freeEntitlement();
    if (customer.id !== userId || customer.project_id !== config.project) throw unavailable();
    let next = `${path}/subscriptions?environment=${config.environment}&limit=100`, subscriptions = [];
    for (let page = 0; next && page < 5; page++) {
        if (!next.startsWith(`${path}/subscriptions?`)) throw unavailable();
        const data = await get(next);
        if (!Array.isArray(data?.items)) throw unavailable();
        subscriptions.push(...data.items);
        next = data.next_page;
    }
    if (next) throw unavailable(); // Incomplete provider data must never authorize access.
    const valid = [];
    for (const subscription of subscriptions) {
        if (subscription.customer_id !== userId) throw unavailable();
        const allowed = config.products.find(p => p.id === subscription.product_id && p.store === subscription.store);
        if (!allowed || subscription.environment !== config.environment || subscription.gives_access !== true) continue;
        const premium = subscription.entitlements?.items?.some(e => e.id === config.entitlement
            && e.lookup_key === "premium" && e.project_id === config.project && e.state === "active");
        if (!premium) continue;
        const product = await get(`${base}/products/${encodeURIComponent(allowed.id)}`);
        if (product.id !== allowed.id || product.app_id !== allowed.appId || product.type !== "subscription"
            || product.store_identifier !== allowed.storeIdentifier) throw unavailable();
        const activeExpiry = customer.active_entitlements?.items?.find(e => e.entitlement_id === config.entitlement)?.expires_at;
        const expires = subscription.status === "in_grace_period" ? activeExpiry : subscription.ends_at ?? subscription.current_period_ends_at;
        if (subscription.status === "in_grace_period" && (!Number.isSafeInteger(expires) || expires <= now.getTime())) throw unavailable();
        if (!Number.isSafeInteger(expires) || expires <= now.getTime()) continue;
        valid.push({ subscription, expires });
    }
    valid.sort((a, b) => b.expires - a.expires);
    if (!valid.length) return freeEntitlement(); // Refunds/revocations/gives_access=false cannot retain Premium.
    const { subscription: s, expires } = valid[0];
    const canceled = s.auto_renewal_status === "will_not_renew";
    return effectiveEntitlement({ plan: "PREMIUM", subscriptionStatus: s.status === "in_grace_period" ? "GRACE_PERIOD" : canceled ? "CANCELED" : "ACTIVE",
        expiresAt: new Date(expires).toISOString(), autoRenew: s.auto_renewal_status === "will_renew",
        source: s.store === "app_store" ? "APPLE" : "GOOGLE" }, now);
}

export function entitlementWrite(tableName, userId, entitlement, previous, now, event) {
    const revision = Number(previous?.billingRevision?.N ?? 0);
    if (!Number.isSafeInteger(revision) || revision < 0) throw unavailable();
    const item = { PK: { S: `USER#${userId}` }, SK: { S: "ENTITLEMENTS" }, plan: { S: entitlement.plan },
        subscriptionStatus: { S: entitlement.subscriptionStatus }, source: { S: entitlement.source },
        autoRenew: { BOOL: entitlement.autoRenew }, billingRevision: { N: String(revision + 1) },
        verifiedAt: { S: now.toISOString() }, ...(entitlement.expiresAt ? { expiresAt: { S: entitlement.expiresAt } } : {}),
        ...((event || previous?.lastRevenueCatEventAt) ? { lastRevenueCatEventAt: event ? { N: String(event.event_timestamp_ms) } : previous.lastRevenueCatEventAt } : {}) };
    return { Put: { TableName: tableName, Item: item,
        ConditionExpression: previous?.billingRevision ? "#revision = :revision" : "attribute_not_exists(#revision)",
        ExpressionAttributeNames: { "#revision": "billingRevision" },
        ...(previous?.billingRevision ? { ExpressionAttributeValues: { ":revision": previous.billingRevision } } : {}) } };
}
