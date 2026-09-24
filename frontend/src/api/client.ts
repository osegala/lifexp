import { create } from "axios";
import { environment } from "../config/environment";

export const API_BASE_URL = environment.apiUrl;

export const api = create({
  baseURL: API_BASE_URL,
});
