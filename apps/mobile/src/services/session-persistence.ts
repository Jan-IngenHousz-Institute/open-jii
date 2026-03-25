import AsyncStorage from "@react-native-async-storage/async-storage";

const SESSION_FLAG_KEY = "openjii:has-session";

/**
 * Mark that the user has an active session.
 * Called after successful login so we can trust the session on cold start
 * even when the device is offline and the server can't be reached.
 */
export async function markSessionActive(): Promise<void> {
  await AsyncStorage.setItem(SESSION_FLAG_KEY, "1");
}

/** Clear the session flag on explicit sign-out. */
export async function clearSessionFlag(): Promise<void> {
  await AsyncStorage.removeItem(SESSION_FLAG_KEY);
}

/** Check if the user had an active session before the app was closed. */
export async function hadActiveSession(): Promise<boolean> {
  const value = await AsyncStorage.getItem(SESSION_FLAG_KEY);
  return value === "1";
}
