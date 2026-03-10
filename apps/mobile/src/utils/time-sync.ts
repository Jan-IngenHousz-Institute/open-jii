import tzLookup from "@photostructure/tz-lookup";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Debouncer } from "@tanstack/pacer";
import * as Location from "expo-location";
import { DateTime } from "luxon";
import { AppState } from "react-native";
import type { AppStateStatus } from "react-native";
import { toast } from "sonner-native";
import { getApiClient } from "~/api/client";

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

const MISSED_PING_WARN_THRESHOLD = 3;
const STORAGE_KEY = "TIME_SYNC_STATE";

let state: TimeSyncState = {
  offsetMs: 0,
  timezone: "UTC",
  isSynced: false,
  missedPings: 0,
  lastSyncedAt: 0,
};

let appStateSubscription: ReturnType<typeof AppState.addEventListener> | null = null;

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
    console.warn("[time-sync] Failed to persist state:", err);
  }
}

async function restoreState(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return;

    const restored: TimeSyncState = JSON.parse(raw);
    state = { ...restored, missedPings: 0 };

    console.log("[time-sync] Restored state from storage", {
      offsetMs: state.offsetMs,
      timezone: state.timezone,
      isSynced: state.isSynced,
      lastSyncedAt: new Date(state.lastSyncedAt).toISOString(),
    });
  } catch (err) {
    console.warn("[time-sync] Failed to restore state:", err);
  }
}

async function resolveTimezone(): Promise<string> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      console.warn("[time-sync] Location permission not granted, falling back to UTC");
      return "UTC";
    }

    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Low,
    });

    return tzLookup(location.coords.latitude, location.coords.longitude);
  } catch (err) {
    console.warn("[time-sync] Could not resolve timezone from GPS:", err);
    return "UTC";
  }
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
  try {
    const timezone = await resolveTimezone();
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

    console.log("[time-sync] Sync successful", {
      localDeviceTime: new Date().toISOString(),
      syncedUtc: new Date(Date.now() + offsetMs).toISOString(),
      offsetMs,
      roundTripMs,
      timezone,
      lastSyncedAt: new Date(state.lastSyncedAt).toISOString(),
    });

    await persistState();

    // Resolve any callers waiting for the first sync.
    for (const resolve of syncWaiters) resolve();
    syncWaiters = [];
  } catch (err) {
    console.warn("[time-sync] Sync failed:", err);
    state = { ...state, missedPings: state.missedPings + 1 };

    console.log("[time-sync] State after failure", {
      ...state,
      localDeviceTime: new Date().toISOString(),
      missedPings: state.missedPings,
      lastSyncedAt: state.lastSyncedAt ? new Date(state.lastSyncedAt).toISOString() : "never",
    });

    if (isInitial) {
      toast.warning("Unable to synchronize time.");
    } else if (state.missedPings >= MISSED_PING_WARN_THRESHOLD) {
      toast.warning("Time sync lost. Please check your phone's date and time settings.");
    }
  }
}

function handleAppStateChange(nextState: AppStateStatus) {
  if (nextState === "active") {
    console.log("[time-sync] App foregrounded, requesting sync");
    debouncedSync.maybeExecute();
  }
}

/** Start the time sync service. Call once at app startup. */
export function startTimeSync() {
  if (appStateSubscription) return;
  restoreState().then(() => performSync(true));
  appStateSubscription = AppState.addEventListener("change", handleAppStateChange);
}

/** Stop the time sync service. */
export function stopTimeSync() {
  if (appStateSubscription) {
    appStateSubscription.remove();
    appStateSubscription = null;
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

/** Get the current synced time as an ISO string in the user's resolved timezone. */
export function getSyncedLocalISO(): string {
  const iso = DateTime.fromMillis(getSyncedUtcNow(), { zone: state.timezone }).toISO();
  return iso ?? new Date().toISOString();
}

const ENSURE_SYNCED_TIMEOUT_MS = 10_000;

/**
 * Returns immediately if a sync has already completed.
 * Otherwise triggers an on-demand sync and waits for it (with a timeout).
 * Use this to gate SigV4 signing so we never sign with an unsynced clock.
 */
export async function ensureSynced(): Promise<void> {
  if (state.isSynced) return;

  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      syncWaiters = syncWaiters.filter((r) => r !== resolve);
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
