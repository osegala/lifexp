import type { BillingProvider } from "./client";

/** Web never imports a native module or simulates a store purchase. */
export const billingProvider: BillingProvider = {
  available: false,
  identify: async () => {},
  offerings: async () => [],
  purchase: async () => { throw new Error("Native subscriptions require an iOS or Android development build."); },
  restore: async () => { throw new Error("Native subscriptions are unavailable on web."); },
  manage: async () => { throw new Error("Manage subscriptions in the app store."); },
};
