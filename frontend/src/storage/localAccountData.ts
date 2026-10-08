import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { clearLocalAppearance } from "../avatar/localAppearance";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { progressKey } from "../onboarding/progress";

export const BASE_LAYOUT_STORAGE_KEY = "lifexp.base.building-layouts.v1";

export async function clearLocalAccountData(userId?: string | number) {
  const clearLayout = Platform.OS === "web"
    ? Promise.resolve(globalThis.localStorage?.removeItem(BASE_LAYOUT_STORAGE_KEY))
    : SecureStore.deleteItemAsync(BASE_LAYOUT_STORAGE_KEY);
  const appearance = userId === undefined ? Promise.resolve() : clearLocalAppearance(userId);
  const onboarding = userId === undefined ? Promise.resolve() : AsyncStorage.removeItem(progressKey(userId));
  await Promise.allSettled([appearance, clearLayout, onboarding]);
}
