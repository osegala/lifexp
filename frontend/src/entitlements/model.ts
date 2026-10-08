import type { EntitlementResponse } from "../types";

export const FREE_ENTITLEMENTS: EntitlementResponse = {
  plan: "FREE", premium: false, subscriptionStatus: "FREE", adsEnabled: true,
  expiresAt: null, autoRenew: false, source: "NONE",
};

/** Validate the server response, including the existing response before premium/source were added. */
export function normalizeEntitlements(value: unknown): EntitlementResponse {
  if (!value || typeof value !== "object") throw new Error("Invalid entitlement response.");
  const record = value as Partial<EntitlementResponse>;
  if (!["FREE", "PREMIUM"].includes(record.plan ?? "")
    || !["FREE", "ACTIVE", "EXPIRED", "CANCELED", "GRACE_PERIOD"].includes(record.subscriptionStatus ?? "")) {
    throw new Error("Invalid entitlement response.");
  }
  const expiresAt = record.expiresAt ?? null;
  if (expiresAt !== null && (typeof expiresAt !== "string" || !Number.isFinite(Date.parse(expiresAt)))) {
    throw new Error("Invalid entitlement expiry.");
  }
  const premium = record.plan === "PREMIUM" && ["ACTIVE", "CANCELED", "GRACE_PERIOD"].includes(record.subscriptionStatus!)
    && (record.subscriptionStatus !== "CANCELED" || expiresAt !== null);
  if ((record.premium !== undefined && record.premium !== premium)
    || (record.adsEnabled !== undefined && record.adsEnabled !== !premium)) throw new Error("Inconsistent entitlement response.");
  if (!premium) return { ...FREE_ENTITLEMENTS, subscriptionStatus: record.subscriptionStatus === "EXPIRED" ? "EXPIRED" : "FREE", expiresAt: record.subscriptionStatus === "EXPIRED" ? expiresAt : null };
  return { plan: "PREMIUM", premium: true, subscriptionStatus: record.subscriptionStatus!, adsEnabled: false,
    expiresAt, autoRenew: record.subscriptionStatus !== "CANCELED" && record.autoRenew === true,
    source: ["NONE", "APPLE", "GOOGLE", "ADMIN", "TEST"].includes(record.source ?? "") ? record.source! : "NONE" };
}

export const isPremium = (entitlements: EntitlementResponse) => entitlements.plan === "PREMIUM" && entitlements.premium === true;
export const shouldShowAds = (entitlements: EntitlementResponse) => entitlements.adsEnabled === true && !isPremium(entitlements);
