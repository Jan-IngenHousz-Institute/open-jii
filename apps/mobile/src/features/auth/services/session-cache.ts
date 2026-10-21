import * as SecureStore from "expo-secure-store";
import { z } from "zod";
import { guestLifetime } from "~/features/auth/domain/guest-lifetime";

const SESSION_CACHE_KEY = "openjii_session_data";
const sessionSchema = z.object({
  user: z
    .object({
      id: z.string(),
      name: z.string().optional(),
      email: z.string().optional(),
      image: z
        .string()
        .nullish()
        .transform((value) => value ?? undefined),
      isAnonymous: z.boolean().optional(),
      createdAt: z.union([z.string(), z.date()]).optional(),
    })
    .passthrough(),
  session: z.object({ expiresAt: z.union([z.string(), z.date()]).optional() }).passthrough(),
});
const listeners = new Set<() => void>();
let revision = 0;
let credentialGeneration = 0;
const departed = new Set<string>();
export const hasExpiredGuestSession = () => SecureStore.getItem("openjii_guest_expired") === "true";
export const sessionGeneration = () => credentialGeneration;
export const sessionRevision = () => revision;
export function subscribeSessionCache(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
export function notifySessionCache() {
  revision++;
  for (const listener of listeners) listener();
}

function readValue(key: string) {
  const raw = SecureStore.getItem(key);
  if (!raw?.startsWith("\u0001ba-chunks:")) return raw;
  const count = Number(raw.slice(11));
  if (!Number.isInteger(count) || count < 1 || count > 100) return null;
  let value = "";
  for (let i = 0; i < count; i++) {
    const chunk = SecureStore.getItem(`${key}.${i}`);
    if (chunk === null) return null;
    value += chunk;
  }
  return value;
}

export function validLocalSession(value: unknown) {
  const parsed = sessionSchema.safeParse(value);
  if (!parsed.success) return null;
  const user = parsed.data.user;
  if (departed.has(user.id) || SecureStore.getItem(`openjii_left_${user.id}`) === "true")
    return null;
  if (user.isAnonymous) {
    const key = `openjii_guest_clock_${user.id}`;
    const stored = Number(SecureStore.getItem(key) ?? 0);
    const lifetime = guestLifetime(
      user.createdAt,
      Date.now(),
      Number.isFinite(stored) ? stored : 0,
    );
    if (!lifetime.valid) return null;
    SecureStore.setItem(key, String(lifetime.highWater));
  }
  return parsed.data;
}

export function readCachedSession() {
  try {
    const raw = readValue(SESSION_CACHE_KEY);
    if (!raw) return null;
    const parsed = sessionSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function getCachedSession() {
  return validLocalSession(readCachedSession());
}

function clearSecureValue(key: string) {
  const raw = SecureStore.getItem(key);
  SecureStore.setItem(key, "{}");
  if (!raw?.startsWith("\u0001ba-chunks:")) return;
  const count = Number(raw.slice(11));
  if (!Number.isInteger(count) || count < 1 || count > 100) return;
  for (let i = 0; i < count; i++) SecureStore.setItem(`${key}.${i}`, "");
}

export function clearCachedSession() {
  clearSecureValue(SESSION_CACHE_KEY);
  notifySessionCache();
}

export function clearLocalCredentials(userId?: string, expired = false) {
  credentialGeneration++;
  if (userId) departed.add(userId);
  const operations = [
    () => {
      if (userId) SecureStore.setItem(`openjii_left_${userId}`, "true");
    },
    () => clearSecureValue("openjii_cookie"),
    () => clearSecureValue(SESSION_CACHE_KEY),
    () => {
      if (expired) SecureStore.setItem("openjii_guest_expired", "true");
    },
  ];
  let failure: unknown;
  for (const operation of operations) {
    try {
      operation();
    } catch (error) {
      failure = error;
    }
  }
  notifySessionCache();
  if (failure)
    throw failure instanceof Error ? failure : new Error("Could not clear local credentials");
}

export function acceptNewSession(userId: string) {
  departed.delete(userId);
  SecureStore.setItem(`openjii_left_${userId}`, "false");
  SecureStore.setItem("openjii_guest_expired", "false");
  notifySessionCache();
}
