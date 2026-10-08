import { ApiError } from "./http.mjs";

const PREMIUM_STATUSES = new Set(["ACTIVE", "CANCELED", "GRACE_PERIOD"]);
const SOURCES = new Set(["NONE", "APPLE", "GOOGLE", "ADMIN", "TEST"]);

export function freeEntitlement() {
    return { plan: "FREE", premium: false, subscriptionStatus: "FREE", adsEnabled: true,
        expiresAt: null, autoRenew: false, source: "NONE" };
}

export function entitlementFromItem(item) {
    if (!item?.PK) return null;
    return { plan: item.plan?.S, subscriptionStatus: item.subscriptionStatus?.S,
        expiresAt: item.expiresAt?.S ?? null, autoRenew: item.autoRenew?.BOOL,
        source: item.source?.S ?? item.provider?.S };
}

/** Only server-written ENTITLEMENTS records are input to this normalization. */
export function effectiveEntitlement(record, now = new Date()) {
    if (!record || record.plan !== "PREMIUM") return freeEntitlement();
    const expiresAt = record.expiresAt ?? null;
    const expiry = expiresAt === null ? null : Date.parse(expiresAt);
    if (expiresAt !== null && (typeof expiresAt !== "string" || !Number.isFinite(expiry))) return freeEntitlement();
    if (record.subscriptionStatus === "EXPIRED" || (expiry !== null && expiry <= now.getTime())) {
        return { ...freeEntitlement(), subscriptionStatus: "EXPIRED", expiresAt };
    }
    if (!PREMIUM_STATUSES.has(record.subscriptionStatus)
        || (record.subscriptionStatus === "CANCELED" && expiry === null)) return freeEntitlement();
    const source = record.source === "DEVELOPMENT" ? "TEST" : record.source;
    return { plan: "PREMIUM", premium: true, subscriptionStatus: record.subscriptionStatus,
        adsEnabled: false, expiresAt, autoRenew: record.subscriptionStatus !== "CANCELED" && record.autoRenew === true,
        source: SOURCES.has(source) ? source : "NONE" };
}

export const isPremium = entitlement => entitlement?.plan === "PREMIUM" && entitlement?.premium === true;
export const shouldShowAds = entitlement => entitlement?.adsEnabled === true && !isPremium(entitlement);

export async function readEntitlement(client, tableName, userId, GetItemCommand) {
    const result = await client.send(new GetItemCommand({ TableName: tableName,
        Key: { PK: { S: `USER#${userId}` }, SK: { S: "ENTITLEMENTS" } }, ConsistentRead: true }));
    return effectiveEntitlement(entitlementFromItem(result.Item));
}

/** Read freshly for an authenticated server action; never accept a client entitlement. */
export async function requirePremium(client, tableName, userId, GetItemCommand) {
    const entitlement = await readEntitlement(client, tableName, userId, GetItemCommand);
    if (!isPremium(entitlement)) throw new ApiError(403, "PREMIUM_REQUIRED", "Evrenthia Premium is required for this item.");
    return entitlement;
}
