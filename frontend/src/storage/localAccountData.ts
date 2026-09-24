import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { clearLocalBodyType } from "../avatar/localAppearance";

export const BASE_LAYOUT_STORAGE_KEY = "lifexp.base.building-layouts.v1";

export async function clearLocalAccountData() {
  const clearLayout = Platform.OS === "web"
    ? Promise.resolve(globalThis.localStorage?.removeItem(BASE_LAYOUT_STORAGE_KEY))
    : SecureStore.deleteItemAsync(BASE_LAYOUT_STORAGE_KEY);
  await Promise.allSettled([clearLocalBodyType(), clearLayout]);
}
