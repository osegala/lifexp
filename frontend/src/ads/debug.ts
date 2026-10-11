// Allowlist codes only: SDK/server exception messages can contain private request data.
const safeCodes = new Set(["ERR_NETWORK", "ECONNABORTED", "ETIMEDOUT", "AD_DAILY_LIMIT", "AD_COMPLETION_UNVERIFIED",
  "AD_PROVIDER_UNAVAILABLE", "AD_REWARD_CONFLICT", "REWARDED_AD_FREE_ONLY", "ONBOARDING_REQUIRED", "UNAUTHORIZED",
  "googleMobileAds/no-fill", "googleMobileAds/network-error", "googleMobileAds/internal-error", "googleMobileAds/invalid-request",
  "consent-update-failed"]);

export function adDebug(event: string, details: Record<string, unknown> = {}) {
  if (typeof __DEV__ !== "undefined" && __DEV__) console.info("[Evrenthia Ads]", event, details);
}

export function adDebugError(error: unknown) {
  const e = error as { code?: unknown; response?: { data?: { error?: { code?: unknown } } } } | null;
  const code = e?.response?.data?.error?.code ?? e?.code;
  return { code: typeof code === "string" && safeCodes.has(code) ? code : "UNKNOWN" };
}
