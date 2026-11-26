import { ORPCError } from "@orpc/client";
import { getApiClient } from "~/shared/api/client";
import { createLogger } from "~/shared/observability/logger";
import { getEnvName } from "~/shared/stores/environment-store";
import type { Device } from "~/shared/types/device";

import {
  CONNECTED_FAMILIES,
  multispeqAddressMatches,
  normalizeMacSerial,
  normalizeMultispeqReportedId,
} from "@repo/api/domains/iot/device-identity";
import type { ConnectedFamily } from "@repo/api/domains/iot/device-identity";
import type { DeviceIdentity } from "@repo/iot";

const log = createLogger("connected-registration");

const THING_ATTRIBUTE = /^[a-zA-Z0-9_.,@/:#=[\]-]{1,64}$/;

// Placeholder and product names a unit reports when nobody named it.
const UNNAMED = new Set(["noname", "multispeq", "minipar", "co2dot", "ambit"]);

// Keyed by environment, family and serial: settled units are not asked again until the app restarts.
const settled = new Set<string>();
const inFlight = new Map<string, Promise<void>>();

export function resetConnectedRegistrations() {
  settled.clear();
  inFlight.clear();
}

export interface ConnectedRegistration {
  family: ConnectedFamily;
  serialNumber: string;
  reportedId?: string;
  firmwareVersion?: string;
  name?: string;
}

function isConnectedFamily(family: string): family is ConnectedFamily {
  return (CONNECTED_FAMILIES as readonly string[]).includes(family);
}

/**
 * What to register for a fresh connection, or null when the unit cannot be keyed
 * (decisions 8 and 13): an Ambit, MiniPAR or CO2Dot by the eFuse MAC it reports, a
 * MultispeQ only over Bluetooth, by the full address the phone holds, when the four bytes
 * it reports sit at one end of that address. Over USB a MultispeQ has no address, and
 * firmware that reports no MAC registers nothing.
 */
export function connectedRegistration(
  identity: DeviceIdentity,
  device: Device,
): ConnectedRegistration | null {
  if (!isConnectedFamily(identity.family)) return null;

  let registration: ConnectedRegistration;
  if (identity.family === "multispeq") {
    if (device.type !== "bluetooth-classic") return null;
    const address = normalizeMacSerial(device.id);
    const reportedId = normalizeMultispeqReportedId(identity.deviceId);
    if (address === null || reportedId === null) return null;
    if (!multispeqAddressMatches(reportedId, address)) {
      log.warn("MultispeQ reported bytes do not fit its Bluetooth address; not registering");
      return null;
    }
    registration = { family: "multispeq", serialNumber: address, reportedId };
  } else {
    const serialNumber = normalizeMacSerial(identity.deviceId);
    if (serialNumber === null) return null;
    registration = { family: identity.family, serialNumber };
  }

  const firmware = identity.firmwareVersion;
  const name = identity.name?.trim();
  return {
    ...registration,
    ...(firmware && THING_ATTRIBUTE.test(firmware) ? { firmwareVersion: firmware } : {}),
    ...(name && !UNNAMED.has(name.toLowerCase()) ? { name: name.slice(0, 255) } : {}),
  };
}

/**
 * Registers the physical unit behind a fresh connection, keyed on its family and the
 * serial it reported, never on the phone or the transport. Silent like the phone's own
 * registration: failures are logged and retried on the next connection.
 */
export async function ensureConnectedRegistered(
  identity: DeviceIdentity,
  device: Device,
): Promise<void> {
  const registration = connectedRegistration(identity, device);
  if (registration === null) return;

  const key = `${getEnvName()}:${registration.family}:${registration.serialNumber}`;
  if (settled.has(key)) return;
  const running = inFlight.get(key);
  if (running) return running;

  const run = (async () => {
    try {
      await getApiClient().iot.ensureConnectedDevice(registration);
      settled.add(key);
    } catch (err) {
      if (err instanceof ORPCError && (err.status === 409 || err.status === 400)) {
        // The registry refused this identity; asking again cannot change the answer.
        log.info("Connected unit refused by the registry", {
          status: err.status,
          family: registration.family,
        });
        settled.add(key);
        return;
      }
      log.warn("Connected unit registration failed; will retry on the next connection", {
        family: registration.family,
        err: err instanceof Error ? err.message : String(err),
      });
    } finally {
      inFlight.delete(key);
    }
  })();
  inFlight.set(key, run);
  return run;
}
