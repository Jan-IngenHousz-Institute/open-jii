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
type LocalSession = z.infer<typeof sessionSchema>;

const listeners = new Set<() => void>();
let revision = 0;
let credentialGeneration = 0;
const departed = new Set<string>();
const leftFlags = new Map<string, boolean>();
const guestClocks = new Map<string, number>();
let cached: { value: LocalSession | null } | undefined;
let clock = Date.now();

export const hasExpiredGuestSession = () => SecureStore.getItem("openjii_guest_expired") === "true";
export const sessionGeneration = () => credentialGeneration;
export const sessionRevision = () => revision;
export const sessionClock = () => clock;

function emit() {
  revision++;
  for (const listener of listeners) listener();
}

export function advanceSessionClock(now = Date.now()) {
  clock = now;
  emit();
}

export function subscribeSessionCache(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function notifySessionCache() {
  cached = undefined;
  emit();
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

function hasLeft(userId: string) {
  if (departed.has(userId)) return true;
  let left = leftFlags.get(userId);
  if (left === undefined) {
    left = SecureStore.getItem(`openjii_left_${userId}`) === "true";
    leftFlags.set(userId, left);
  }
  return left;
}

function guestHighWater(userId: string) {
  let highWater = guestClocks.get(userId);
  if (highWater === undefined) {
    const stored = Number(SecureStore.getItem(`openjii_guest_clock_${userId}`) ?? 0);
    highWater = Number.isFinite(stored) ? stored : 0;
    guestClocks.set(userId, highWater);
  }
  return highWater;
}

export function assessLocalSession(value: unknown, now = Date.now()) {
  const parsed = sessionSchema.safeParse(value);
  if (!parsed.success) return { session: null, expired: false };
  const user = parsed.data.user;
  if (hasLeft(user.id)) return { session: null, expired: false };
  if (user.isAnonymous && !guestLifetime(user.createdAt, now, guestHighWater(user.id)).valid)
    return { session: null, expired: true };
  return { session: parsed.data, expired: false };
}

export function validLocalSession(value: unknown, now = Date.now()) {
  return assessLocalSession(value, now).session;
}

type Assessment = ReturnType<typeof assessLocalSession>;
let assessment: { value: unknown; revision: number; result: Assessment } | undefined;

/** Judged once per change of session, store or clock, however many readers render it. */
export function currentSession(value: unknown) {
  if (assessment && assessment.value === value && assessment.revision === revision)
    return assessment.result;
  const result = assessLocalSession(value, clock);
  assessment = { value, revision, result };
  return result;
}

/** Keeps the latest time a guest was seen, so winding the clock back cannot extend the session. */
export function recordGuestClock(userId: string, now = Date.now()) {
  if (now <= guestHighWater(userId)) return;
  guestClocks.set(userId, now);
  SecureStore.setItem(`openjii_guest_clock_${userId}`, String(now));
}

function readStoredSession() {
  try {
    const raw = readValue(SESSION_CACHE_KEY);
    if (!raw) return null;
    const parsed = sessionSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function readCachedSession() {
  cached ??= { value: readStoredSession() };
  return cached.value;
}

export function isSessionCacheKey(key: string) {
  return key === SESSION_CACHE_KEY || key.startsWith(`${SESSION_CACHE_KEY}.`);
}

export function getCachedSession() {
  return validLocalSession(readStoredSession());
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
  if (userId) {
    departed.add(userId);
    leftFlags.set(userId, true);
  }
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

/** Once, however many readers notice the expiry. */
export function expireGuest(userId: string) {
  if (!departed.has(userId)) clearLocalCredentials(userId, true);
}

export function acceptNewSession(userId: string) {
  departed.delete(userId);
  leftFlags.set(userId, false);
  SecureStore.setItem(`openjii_left_${userId}`, "false");
  SecureStore.setItem("openjii_guest_expired", "false");
  notifySessionCache();
}

// Tests that wipe secure storage between cases reset its in-memory mirror here.
export function _resetSessionCacheForTests(): void {
  leftFlags.clear();
  guestClocks.clear();
  cached = undefined;
  assessment = undefined;
  clock = Date.now();
}
