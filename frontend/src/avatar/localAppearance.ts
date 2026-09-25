import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const BODY_TYPE_KEY = "evrenthia.avatar.bodyType";
const HAIR_ID_KEY = "evrenthia.avatar.hairId";
export type BodyType = "BOY" | "GIRL";

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

export async function getLocalBodyType(): Promise<BodyType> {
  return (await readAppearanceValue(BODY_TYPE_KEY)) === "GIRL"
    ? "GIRL"
    : "BOY";
}

export async function setLocalBodyType(bodyType: BodyType) {
  await writeAppearanceValue(BODY_TYPE_KEY, bodyType);
}

export async function getLocalHairId() {
  return readAppearanceValue(HAIR_ID_KEY);
}

export async function setLocalHairId(hairId: string | null) {
  await writeAppearanceValue(HAIR_ID_KEY, hairId);
}

export async function clearLocalAppearance() {
  await Promise.all([
    writeAppearanceValue(BODY_TYPE_KEY, null),
    writeAppearanceValue(HAIR_ID_KEY, null),
  ]);
}
