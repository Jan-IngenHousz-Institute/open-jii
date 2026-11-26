import { ORPCError } from "@orpc/client";
import { getApiClient } from "~/shared/api/client";
import { createLogger } from "~/shared/observability/logger";
import { getEnvName } from "~/shared/stores/environment-store";

import { canonicalMultispeqSerial } from "@repo/api/domains/iot/multispeq-identity";
import type { DeviceIdentity } from "@repo/iot";

const log = createLogger("multispeq-registration");

const THING_ATTRIBUTE = /^[a-zA-Z0-9_.,@/:#=[\]-]{1,64}$/;

// Keyed by environment and serial: settled units are not asked again until the app restarts.
const settled = new Set<string>();
const inFlight = new Map<string, Promise<void>>();

export function resetMultispeqRegistrations() {
  settled.clear();
  inFlight.clear();
}

/**
 * Registers the physical MultispeQ behind a fresh connection, keyed on the identity its
 * firmware reported, never on the phone or the transport. Silent like the phone's own
 * registration: failures are logged and retried on the next connection.
 */
export async function ensureMultispeqRegistered(identity: DeviceIdentity): Promise<void> {
  if (identity.family !== "multispeq") return;
  const serialNumber = canonicalMultispeqSerial(identity.deviceId);
  if (serialNumber === null) return;

  const key = `${getEnvName()}:${serialNumber}`;
  if (settled.has(key)) return;
  const running = inFlight.get(key);
  if (running) return running;

  const run = (async () => {
    try {
      const firmware = identity.firmwareVersion;
      const name = identity.name?.trim();
      await getApiClient().iot.ensureMultispeqDevice({
        serialNumber,
        ...(firmware && THING_ATTRIBUTE.test(firmware) ? { firmwareVersion: firmware } : {}),
        ...(name ? { name: name.slice(0, 255) } : {}),
      });
      settled.add(key);
    } catch (err) {
      if (err instanceof ORPCError && (err.status === 409 || err.status === 400)) {
        // The registry refused this identity; asking again cannot change the answer.
        log.info("MultispeQ identity refused by the registry", { status: err.status });
        settled.add(key);
        return;
      }
      log.warn("MultispeQ registration failed; will retry on the next connection", {
        err: err instanceof Error ? err.message : String(err),
      });
    } finally {
      inFlight.delete(key);
    }
  })();
  inFlight.set(key, run);
  return run;
}
