import * as SecureStore from "expo-secure-store";

// Written by the Expo client plugin (storagePrefix "openjii") on every getSession.
const SESSION_CACHE_KEY = "openjii_session_data";

export function getCachedSession() {
  const raw = SecureStore.getItem(SESSION_CACHE_KEY);
  if (!raw || raw === "{}") return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function clearCachedSession() {
  SecureStore.setItem(SESSION_CACHE_KEY, "{}");
}
