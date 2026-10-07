import "react-native-get-random-values";
import { Alert, Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import Constants from "expo-constants";
import { api } from "../api/client";
import { apiRoutes } from "../api/routes";

const DEVICE_KEY = "evrenthia.push.device.v1";
const OPT_IN_KEY = "evrenthia.push.opt-in.v1";
const DENIED_KEY = "evrenthia.push.denied.v1";
export type PermissionState = "ready" | "denied" | "web" | "cancelled" | "unavailable";
export const permissionMessage: Record<PermissionState, string> = {
  ready: "This device is registered for notifications.",
  denied: "Notifications are blocked on this device. Enable them in system settings; tasks and saved reminders still work.",
  web: "Push notifications are available in the iOS/Android app. You can save preferences and reminders here.",
  cancelled: "Device notifications are not enabled. You can enable them later in Profile.",
  unavailable: "Device registration is unavailable. Use a notification-capable development build and try again. Your tasks are unaffected.",
};
let pending: Promise<PermissionState> | undefined;
let suspended = false;

async function register(ask: boolean): Promise<PermissionState> {
  if (Platform.OS === "web") return "web";
  try {
    if (!ask && await SecureStore.getItemAsync(OPT_IN_KEY) !== "yes") return "cancelled";
    const notifications = await import("expo-notifications");
    let permission = await notifications.getPermissionsAsync();
    if (!permission.granted) {
      if (permission.status === "denied" || !permission.canAskAgain || await SecureStore.getItemAsync(DENIED_KEY) === "yes") return "denied";
      if (!ask) return "cancelled";
      const accepted = await new Promise<boolean>(resolve => Alert.alert("Enable reminders?",
        "Evrenthia can remind you about tasks, unfinished daily quests and your activity streak. You control the times in Profile.",
        [{ text: "Not now", style: "cancel", onPress: () => resolve(false) }, { text: "Continue", onPress: () => resolve(true) }],
        { cancelable: true, onDismiss: () => resolve(false) }));
      if (!accepted) return "cancelled";
      if (Platform.OS === "android") await notifications.setNotificationChannelAsync("default", { name: "Reminders", importance: notifications.AndroidImportance.DEFAULT });
      permission = await notifications.requestPermissionsAsync();
      if (!permission.granted) { await SecureStore.setItemAsync(DENIED_KEY, "yes"); return "denied"; }
    }
    let deviceId = await SecureStore.getItemAsync(DEVICE_KEY);
    if (!deviceId) {
      deviceId = `device-${Array.from(crypto.getRandomValues(new Uint8Array(16)), value => value.toString(16).padStart(2, "0")).join("")}`;
      await SecureStore.setItemAsync(DEVICE_KEY, deviceId);
    }
    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (!projectId) return "unavailable";
    const { data: pushToken } = await notifications.getExpoPushTokenAsync({ projectId });
    await api.post(apiRoutes.devices, { deviceId, pushProvider: "EXPO", pushToken, platform: Platform.OS.toUpperCase() });
    await SecureStore.setItemAsync(OPT_IN_KEY, "yes");
    return "ready";
  } catch { return "unavailable"; } // Never render/log native errors containing tokens.
}

export function enableDeviceNotifications(ask = true): Promise<PermissionState> {
  if (ask) suspended = false;
  if (suspended) return Promise.resolve("cancelled");
  pending ??= register(ask).finally(() => { pending = undefined; });
  return pending;
}

export async function disableCurrentDevice() {
  suspended = true;
  if (Platform.OS === "web") return;
  await pending;
  const deviceId = await SecureStore.getItemAsync(DEVICE_KEY);
  if (deviceId) {
    try { await api.delete(apiRoutes.device(deviceId)); }
    catch (error) {
      const status = (error as { response?: { status?: number } }).response?.status;
      if (status !== 404 && status !== 403) throw new Error("Could not disable this device. Reconnect and try signing out again.");
    }
  }
  await SecureStore.deleteItemAsync(OPT_IN_KEY);
}

// No permission prompt on launch/resume. Refresh only an explicitly opted-in
// registration, including native token rotations. No local notification scheduler.
export async function watchDeviceToken() {
  if (Platform.OS === "web") return () => {};
  try {
    const notifications = await import("expo-notifications");
    const subscription = notifications.addPushTokenListener(() => { void enableDeviceNotifications(false); });
    return () => subscription.remove();
  } catch { return () => {}; }
}
