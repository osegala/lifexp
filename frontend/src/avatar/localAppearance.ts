import * as SecureStore from "expo-secure-store";

const BODY_TYPE_KEY = "evrenthia.avatar.bodyType";
export type BodyType = "BOY" | "GIRL";

export async function getLocalBodyType(): Promise<BodyType> {
  return (await SecureStore.getItemAsync(BODY_TYPE_KEY)) === "GIRL"
    ? "GIRL"
    : "BOY";
}

export async function setLocalBodyType(bodyType: BodyType) {
  await SecureStore.setItemAsync(BODY_TYPE_KEY, bodyType);
}
