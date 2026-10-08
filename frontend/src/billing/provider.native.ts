import Constants, { ExecutionEnvironment } from "expo-constants";
import { Linking, Platform } from "react-native";
import type { PurchasesPackage } from "react-native-purchases";
import type { BillingProvider } from "./client";

const apiKey = Platform.OS === "ios" ? process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY : process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY;
const supported = Constants.executionEnvironment !== ExecutionEnvironment.StoreClient
  && process.env.EXPO_PUBLIC_BILLING_ENABLED === "true"
  && (Platform.OS === "ios" ? /^appl_/.test(apiKey ?? "") : /^goog_/.test(apiKey ?? ""));
let configured = false, userId: string | null = null;
const packages = new Map<string, PurchasesPackage>();
const sdk = async () => (await import("react-native-purchases")).default;

export const billingProvider: BillingProvider = {
  available: supported,
  async identify(id) {
    packages.clear();
    if (!supported) return;
    const Purchases = await sdk();
    // Disable SDK logging: store payloads/user identifiers do not belong in application logs.
    Purchases.setLogHandler(() => {});
    if (!configured && id) {
      Purchases.configure({ apiKey: apiKey!, appUserID: id, shouldShowInAppMessagesAutomatically: false });
      configured = true;
    } else if (configured && id !== userId) {
      if (userId) { await Purchases.logOut(); userId = null; }
      if (id) await Purchases.logIn(id);
    }
    userId = id;
  },
  async offerings() {
    if (!userId) throw new Error("Billing identity unavailable");
    const offering = (await (await sdk()).getOfferings()).current;
    const choices = [offering?.monthly, offering?.annual].filter((p): p is PurchasesPackage => !!p);
    packages.clear(); choices.forEach(p => packages.set(p.identifier, p));
    return choices.map(p => ({ id: p.identifier, label: p.packageType === "ANNUAL" ? "Yearly" : "Monthly", price: p.product.priceString }));
  },
  async purchase(id) {
    const option = packages.get(id);
    if (!userId || !option) throw new Error("Store package unavailable");
    await (await sdk()).purchasePackage(option); // CustomerInfo is deliberately not returned.
  },
  async restore() { if (!userId) throw new Error("Billing identity unavailable"); await (await sdk()).restorePurchases(); },
  async manage() {
    if (!userId) throw new Error("Billing identity unavailable");
    if (Platform.OS === "ios") await (await sdk()).showManageSubscriptions();
    else await Linking.openURL("https://play.google.com/store/account/subscriptions");
  },
};
