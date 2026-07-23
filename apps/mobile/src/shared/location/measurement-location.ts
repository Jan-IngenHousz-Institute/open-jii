import * as Location from "expo-location";
import { createLogger } from "~/shared/observability/logger";

const log = createLogger("measurement-location");

export interface MeasurementLocation {
  latitude: number;
  longitude: number;
}

const LAST_KNOWN_MAX_AGE_MS = 60_000;
const FRESH_FIX_TIMEOUT_MS = 10_000;

/**
 * Best-effort GPS fix for a measurement: last-known fix if recent enough,
 * otherwise a fresh one bounded by a timeout. Only checks the permission
 * already requested by time-sync, never prompts (prompting mid-measurement
 * flaps AppState on Android). Never throws; null means "no location".
 */
export async function getMeasurementLocation(): Promise<MeasurementLocation | null> {
  try {
    const { status } = await Location.getForegroundPermissionsAsync();
    if (status !== "granted") {
      log.warn("Location permission not granted, uploading without location");
      return null;
    }

    const lastKnown = await Location.getLastKnownPositionAsync({
      maxAge: LAST_KNOWN_MAX_AGE_MS,
    });
    if (lastKnown) {
      return {
        latitude: lastKnown.coords.latitude,
        longitude: lastKnown.coords.longitude,
      };
    }

    const fresh = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), FRESH_FIX_TIMEOUT_MS)),
    ]);
    if (!fresh) {
      log.warn("Timed out waiting for a GPS fix, uploading without location");
      return null;
    }
    return { latitude: fresh.coords.latitude, longitude: fresh.coords.longitude };
  } catch (err) {
    log.warn("Could not resolve measurement location", { err: (err as Error)?.message });
    return null;
  }
}
