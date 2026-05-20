import tzLookup from "@photostructure/tz-lookup";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Debouncer } from "@tanstack/pacer";
import * as Location from "expo-location";
import * as Network from "expo-network";
import { DateTime } from "luxon";
import { toast } from "sonner-native";
import { getApiClient } from "~/shared/api/client";
import { onAppForeground } from "~/shared/utils/app-lifecycle";
import { createLogger } from "~/shared/utils/logger";

const log = createLogger("time-sync");

export interface TimeSyncState {
  /** Offset in ms: serverUtc - localDeviceTime at moment of sync */
  offsetMs: number;
  /** IANA timezone resolved from GPS */
  timezone: string;
  /** Whether at least one successful sync has happened */
  isSynced: boolean;
  /** Consecutive missed pings */
  missedPings: number;
  /** Timestamp (device clock) of last successful sync */
  lastSyncedAt: number;
}

const STORAGE_KEY = "TIME_SYNC_STATE";

let state: TimeSyncState = {
  offsetMs: 0,
  timezone: "UTC",
  isSynced: false,
  missedPings: 0,
  lastSyncedAt: 0,
};

let unsubscribeAppForeground: (() => void) | null = null;

/** Resolvers waiting for the first successful sync. */
let syncWaiters: (() => void)[] = [];

const SYNC_DEBOUNCE_MS = 5_000;

/** Single debouncer for all sync triggers (interval, foreground).
 *  Fires on the leading edge, then ignores further calls within the wait
 *  window so overlapping triggers never pile up. */
const debouncedSync = new Debouncer(() => void performSync(), {
  wait: SYNC_DEBOUNCE_MS,
  leading: true,
  trailing: false,
});

export function getTimeSyncState(): TimeSyncState {
  return state;
}

async function persistState(): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    log.warn("Failed to persist state", { err: (err as Error)?.message });
  }
}

async function restoreState(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return;

    const restored: TimeSyncState = JSON.parse(raw);
    state = { ...restored, missedPings: 0 };

    log.info("restored state from storage", {
      offset_ms: state.offsetMs,
      timezone: state.timezone,
      is_synced: state.isSynced,
      last_synced_at: new Date(state.lastSyncedAt).toISOString(),
    });
  } catch (err) {
    log.warn("Failed to restore state", { err: (err as Error)?.message });
  }
}

async function resolveTimezone(): Promise<string> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      log.warn("Location permission not granted, falling back to UTC");
      return "UTC";
    }

    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Low,
    });

    return tzLookup(location.coords.latitude, location.coords.longitude);
  } catch (err) {
    log.warn("Could not resolve timezone from GPS", { err: (err as Error)?.message });
    return "UTC";
  }
}

// Reuse the cached timezone until it is stale. GPS calls on Android briefly
// background the app (permission/location dialogs), which fires
// AppState.background→active and re-enters performSync — a cascade that
// hammers upload rehydrate and re-syncs. The timezone almost never changes
// per session, so reuse it.
const TIMEZONE_REFRESH_MS = 24 * 60 * 60 * 1000;

async function maybeResolveTimezone(): Promise<string> {
  const haveTz = state.timezone && state.timezone !== "UTC";
  const fresh =
    state.lastSyncedAt > 0 && Date.now() - state.lastSyncedAt < TIMEZONE_REFRESH_MS;
  if (haveTz && fresh) {
    log.debug("reusing cached timezone", { timezone: state.timezone });
    return state.timezone;
  }
  return resolveTimezone();
}

async function fetchServerTime(): Promise<number> {
  const client = getApiClient();
  const result = await client.health.getTime();

  if (result.status !== 200) {
    throw new Error(`Server time request failed: ${result.status}`);
  }

  return result.body.utcTimestampMs;
}

async function performSync(isInitial = false): Promise<void> {
  const t0 = Date.now();
  const networkState = await Network.getNetworkStateAsync();
  if (!networkState.isInternetReachable) {
    log.info("skipping sync — device is offline", { is_initial: isInitial });
    return;
  }

  try {
    const timezone = await maybeResolveTimezone();
    const beforeFetch = Date.now();
    const serverUtcMs = await fetchServerTime();
    const afterFetch = Date.now();

    const roundTripMs = afterFetch - beforeFetch;
    const estimatedServerNow = serverUtcMs + roundTripMs / 2;
    const offsetMs = estimatedServerNow - afterFetch;

    state = {
      offsetMs,
      timezone,
      isSynced: true,
      missedPings: 0,
      lastSyncedAt: Date.now(),
    };

    log.info("sync successful", {
      is_initial: isInitial,
      offset_ms: offsetMs,
      round_trip_ms: roundTripMs,
      tz_resolve_ms: beforeFetch - t0,
      total_ms: Date.now() - t0,
      timezone,
    });

    await persistState();

    // Resolve any callers waiting for the first sync.
    for (const resolve of syncWaiters) resolve();
    syncWaiters = [];
  } catch (err) {
    state = { ...state, missedPings: state.missedPings + 1 };

    log.warn("sync failed", {
      is_initial: isInitial,
      missed_pings: state.missedPings,
      last_synced_at: state.lastSyncedAt ? new Date(state.lastSyncedAt).toISOString() : "never",
      err: (err as Error)?.message,
    });
  }
}

// Tracks whether the one-shot startup chain (restore + initial sync) has
// been kicked off this process. Survives stopTimeSync so a strict-mode
// mount→cleanup→remount of TimeSyncProvider doesn't fire two initial syncs.
let startupKicked = false;

/** Start the time sync service. Call once at app startup. */
export function startTimeSync() {
  if (unsubscribeAppForeground) return;
  if (!startupKicked) {
    startupKicked = true;
    restoreState().then(() => performSync(true));
  }
  unsubscribeAppForeground = onAppForeground(() => {
    log.debug("app foregrounded, requesting sync");
    debouncedSync.maybeExecute();
  });
}

/** Stop the time sync service. */
export function stopTimeSync() {
  if (unsubscribeAppForeground) {
    unsubscribeAppForeground();
    unsubscribeAppForeground = null;
  }
  debouncedSync.cancel();
}

/** Get the current synced UTC timestamp in milliseconds. */
export function getSyncedUtcNow(): number {
  return Date.now() + state.offsetMs;
}

/** Get the current synced time as a Luxon DateTime in UTC. */
export function getSyncedUtcDateTime(): DateTime {
  return DateTime.fromMillis(getSyncedUtcNow(), { zone: "utc" });
}

/** Get the current synced time as an ISO string in the user's resolved timezone.
 *
 * ⚠️ Use this for display purposes only — never send this value as a timestamp.
 *
 * For values that need to be sent to the server use `getSyncedUtcISO`
 **/
export function getSyncedLocalISO(): string {
  const iso = DateTime.fromMillis(getSyncedUtcNow(), { zone: state.timezone }).toISO();
  return iso ?? new Date().toISOString();
}

/**
 * Get the current synced time as a normalized UTC ISO string (e.g. "2026-03-16T13:00:18.022Z").
 *
 * NOTE: `timestamp` in all uploaded payloads === normalized UTC timestamp.
 * It is always UTC — never a local time with an offset suffix.
 * The companion `timezone` field (IANA name) is what enables local-time derivation downstream.
 */
export function getSyncedUtcISO(): string {
  const iso = getSyncedUtcDateTime().toISO();
  return iso ?? new Date().toISOString();
}

const ENSURE_SYNCED_TIMEOUT_MS = 10_000;

/**
 * Returns immediately if a sync has already completed.
 * Otherwise triggers an on-demand sync and waits for it (with a timeout).
 * Use this to gate SigV4 signing so we never sign with an unsynced clock.
 */
export async function ensureSynced(): Promise<void> {
  log.debug("ensureSynced called", {
    is_synced: state.isSynced,
    last_synced_at: state.lastSyncedAt ? new Date(state.lastSyncedAt).toISOString() : "never",
    waiters_before: syncWaiters.length,
  });
  if (state.isSynced) return;

  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      syncWaiters = syncWaiters.filter((r) => r !== resolve);
      log.warn("ensureSynced timed out");
      toast.error("Time sync unavailable. Please check your connection and try again.");
      reject(new Error("[time-sync] Timed out waiting for initial sync"));
    }, ENSURE_SYNCED_TIMEOUT_MS);

    syncWaiters.push(() => {
      clearTimeout(timer);
      resolve();
    });

    // Kick off a sync in case startTimeSync hasn't been called yet.
    // Must come *after* the waiter is registered so a fast resolve isn't missed.
    performSync(true);
  });
}
