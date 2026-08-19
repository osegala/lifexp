import { create } from "axios";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { getToken } from "../utils/tokenStorage";

type ExpoConstantsWithManifest = typeof Constants & {
  manifest2?: {
    extra?: {
      expoClient?: {
        hostUri?: string;
      };
    };
  };
};

function getNativeApiHost() {
  const constants = Constants as ExpoConstantsWithManifest;
  const hostUri =
    Constants.expoConfig?.hostUri ?? constants.manifest2?.extra?.expoClient?.hostUri;

  return hostUri?.split(":")[0] ?? "localhost";
}

const apiHost = Platform.OS === "web" ? "localhost" : getNativeApiHost();
export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ?? `http://${apiHost}:8080/api`;

export const api = create({
  baseURL: API_BASE_URL,
});

api.interceptors.request.use(async (config) => {
  const token = await getToken();

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});
