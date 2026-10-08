import { useAuth } from "../context/AuthContext";
import { isPremium } from "./model";

/** AuthSession owns the only fetched entitlement state; this hook does not fetch or persist a second copy. */
export function useEntitlements() {
  const { entitlements, entitlementsLoading, entitlementsConfirmed, entitlementsError, refreshEntitlements } = useAuth();
  return { ...entitlements, premium: isPremium(entitlements), loading: entitlementsLoading,
    confirmed: entitlementsConfirmed, error: entitlementsError, refresh: refreshEntitlements };
}
