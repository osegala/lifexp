import { create } from "axios";
import { getToken } from "../utils/tokenStorage";

export const api = create({
  baseURL: "http://localhost:8080/api",
});

api.interceptors.request.use(async (config) => {
  const token = await getToken();

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});
