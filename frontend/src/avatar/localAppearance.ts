import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

import { DEFAULT_APPEARANCE, normalizeAppearance } from "./appearance";
import type { AvatarAppearance } from "./appearance";

export function appearanceStorageKey(userId: string | number) {
  return `evrenthia.avatar.${encodeURIComponent(String(userId))}.appearance`;
}

async function readAppearanceValue(key: string) {
  try {
    return Platform.OS === "web"
      ? globalThis.localStorage?.getItem(key) ?? null
      : await SecureStore.getItemAsync(key);
  } catch (error) {
    if (__DEV__) console.warn(`Could not read local appearance setting ${key}.`, error);
    return null;
  }
}

async function writeAppearanceValue(key: string, value: string | null) {
  try {
    if (Platform.OS === "web") {
      if (value === null) globalThis.localStorage?.removeItem(key);
      else globalThis.localStorage?.setItem(key, value);
    } else if (value === null) {
      await SecureStore.deleteItemAsync(key);
    } else {
      await SecureStore.setItemAsync(key, value);
    }
  } catch (error) {
    if (__DEV__) console.warn(`Could not save local appearance setting ${key}.`, error);
  }
}

export async function getLocalAppearance(userId: string | number): Promise<AvatarAppearance> {
  const stored = await readAppearanceValue(appearanceStorageKey(userId));
  if (!stored) return DEFAULT_APPEARANCE;
  try {
    return normalizeAppearance(JSON.parse(stored));
  } catch {
    return DEFAULT_APPEARANCE;
  }
}

export async function setLocalAppearance(userId: string | number, appearance: AvatarAppearance) {
  await writeAppearanceValue(
    appearanceStorageKey(userId),
    JSON.stringify(normalizeAppearance(appearance)),
  );
}

export async function clearLocalAppearance(userId: string | number) {
  await writeAppearanceValue(appearanceStorageKey(userId), null);
}
