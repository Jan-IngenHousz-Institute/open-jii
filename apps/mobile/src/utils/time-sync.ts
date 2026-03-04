import { getEnvVar } from "~/stores/environment-store";

const CACHE_DURATION_MS = 30 * 1000; // 30 seconds

interface TimeSyncCache {
  serverTime: number;
  localTime: number;
}

let timeSyncCache: TimeSyncCache | null = null;

/**
 * Fetches the current time from the backend server
 */
async function fetchServerTime(): Promise<number> {
  const backendUri = getEnvVar("BACKEND_URI");
  const response = await fetch(`${backendUri}/health/time`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch server time: ${response.status}`);
  }

  const data = await response.json();
  return data.unixTimestamp;
}

/**
 * Gets the synchronized time based on server time.
 * Caches the server time for some time and calculates drift to minimize network requests.
 */
export async function getSyncedTime(): Promise<Date> {
  try {
    const now = Date.now();

    // Check if we have a valid cached server time
    if (timeSyncCache) {
      const cacheAge = now - timeSyncCache.localTime;
      if (cacheAge < CACHE_DURATION_MS) {
        // Calculate current server time based on cached offset
        const estimatedServerTime = timeSyncCache.serverTime + cacheAge;
        return new Date(estimatedServerTime);
      }
    }

    // Fetch fresh server time
    const serverTime = await fetchServerTime();

    // Cache the server time and local time when we fetched it
    timeSyncCache = {
      serverTime,
      localTime: now,
    };

    return new Date(serverTime);
  } catch (error) {
    console.error("Failed to fetch server time, falling back to local time:", error);
    // Fallback to local time if server is unreachable
    return new Date();
  }
}

/**
 * Clears the time sync cache, forcing a fresh sync on next call
 */
export function clearTimeSyncCache(): void {
  timeSyncCache = null;
}
