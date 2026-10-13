import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const KEY = "atm.token";

/** The JWT goes in the OS keychain/keystore on a phone. The browser build (used for development) has no
 *  keychain, so it falls back to localStorage. */
export const tokenStorage = {
  async get(): Promise<string | null> {
    return Platform.OS === "web" ? localStorage.getItem(KEY) : SecureStore.getItemAsync(KEY);
  },
  async set(value: string): Promise<void> {
    if (Platform.OS === "web") localStorage.setItem(KEY, value);
    else await SecureStore.setItemAsync(KEY, value);
  },
  async clear(): Promise<void> {
    if (Platform.OS === "web") localStorage.removeItem(KEY);
    else await SecureStore.deleteItemAsync(KEY);
  },
};
