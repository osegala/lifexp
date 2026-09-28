import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { clearLocalAppearance } from "../avatar/localAppearance";

export const BASE_LAYOUT_STORAGE_KEY = "lifexp.base.building-layouts.v1";

export async function clearLocalAccountData(userId?: string | number) {
  const clearLayout = Platform.OS === "web"
    ? Promise.resolve(globalThis.localStorage?.removeItem(BASE_LAYOUT_STORAGE_KEY))
    : SecureStore.deleteItemAsync(BASE_LAYOUT_STORAGE_KEY);
  const appearance = userId === undefined ? Promise.resolve() : clearLocalAppearance(userId);
  await Promise.allSettled([appearance, clearLayout]);
}
