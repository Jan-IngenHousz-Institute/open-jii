import { ORPCError } from "@orpc/client";
import * as ExpoDevice from "expo-device";
import { getApiClient } from "~/shared/api/client";
import { createLogger } from "~/shared/observability/logger";
import {
  getDeviceIdentity,
  useDeviceIdentityStore,
  whenDeviceIdentityLoaded,
} from "~/shared/stores/device-identity-store";
import { getEnvName } from "~/shared/stores/environment-store";

const log = createLogger("device-identity");

let inFlight: Promise<void> | null = null;
let lastRunAt = 0;
const MIN_RERUN_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Silently registers this phone as an IoT device (idempotent server ensure).
 * Called after login and (throttled) on foreground/reconnect; every run also
 * re-attaches the caller's Cognito identity server-side, so the binding
 * self-heals. Failures never surface to the user: publishing works with the
 * locally derived thing name either way, and the next trigger retries.
 */
export async function ensureDeviceRegistered(options?: { throttle?: boolean }): Promise<void> {
  if (inFlight) return inFlight;
  if (options?.throttle && Date.now() - lastRunAt < MIN_RERUN_INTERVAL_MS) return;

  inFlight = (async () => {
    try {
      await whenDeviceIdentityLoaded();
      const envName = getEnvName();
      const identity = getDeviceIdentity();

      const device = await getApiClient().iot.ensureMobileDevice({
        installId: identity.installId,
        ...(ExpoDevice.modelName ? { name: ExpoDevice.modelName } : {}),
      });

      useDeviceIdentityStore
        .getState()
        .setRegistered(envName, { thingName: device.thingName, deviceId: device.id });
      lastRunAt = Date.now();
    } catch (err) {
      if (err instanceof ORPCError && err.status === 409) {
        // A shared or handed-over phone already registered by someone else:
        // keep publishing under the phone's stable thing name, never rotate.
        log.info("Phone already registered by another user; keeping local identity");
        lastRunAt = Date.now();
        return;
      }

      if (err instanceof ORPCError && err.status === 403) {
        // Feature flag off for this user: a resolved answer, so the throttle
        // applies; without it every foreground fires a doomed call.
        log.debug("Device registry disabled; skipping registration");
        lastRunAt = Date.now();
        return;
      }

      log.warn("Device registration attempt failed; will retry", {
        err: err instanceof Error ? err.message : String(err),
      });
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
}
