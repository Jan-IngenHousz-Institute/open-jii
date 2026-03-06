import * as Location from "expo-location";
import tzlookup from "@photostructure/tz-lookup";

const CACHE_DURATION_MS = 30 * 1000; // 30 seconds

interface TimeSyncResult {
  utcTimestamp: number;
  timezone: string;
}

interface TimeSyncCache extends TimeSyncResult {
  localTime: number;
}

let cache: TimeSyncCache | null = null;

async function fetchFromGps(): Promise<TimeSyncCache> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== Location.PermissionStatus.GRANTED) {
    throw new Error("Location permission denied");
  }

  const location = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Lowest,
  });

  return {
    utcTimestamp: location.timestamp,
    timezone: tzlookup(location.coords.latitude, location.coords.longitude),
    localTime: Date.now(),
  };
}

export async function getSyncedUtcTimestampWithTimezone(): Promise<TimeSyncResult> {
  const now = Date.now();

  if (cache) {
    const cacheAge = now - cache.localTime;
    if (cacheAge < CACHE_DURATION_MS) {
      return { utcTimestamp: cache.utcTimestamp + cacheAge, timezone: cache.timezone };
    }
  }

  try {
    cache = await fetchFromGps();
    return { utcTimestamp: cache.utcTimestamp, timezone: cache.timezone };
  } catch (error) {
    console.error("Failed to get GPS time and timezone, falling back to local time:", error);
    return { utcTimestamp: now, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone };
  }
}
