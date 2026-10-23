import AsyncStorage from "@react-native-async-storage/async-storage";
import { environment } from "../config/environment";
import { PlayerCache } from "./PlayerCache";

export const playerCache = new PlayerCache(AsyncStorage, environment.apiUrl);
