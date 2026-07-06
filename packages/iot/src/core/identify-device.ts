/**
 * Device identification: probe an unidentified transport for a known sensor
 * family and hand off to the matching connector. Never throws for silence;
 * only transport send errors propagate. The transport is never disconnected.
 */
import { AmbitConnector } from "../driver/ambit/connector";
import type { IDeviceDriver } from "../driver/driver-base";
import { GenericCommandConnector } from "../driver/generic/command-connector";
import { GenericDeviceDriver } from "../driver/generic/driver";
import { MultispeqDriver } from "../driver/multispeq/driver";
import type { ITransportAdapter } from "../transport/interface";
import type { Logger } from "../utils/logger/logger";
import { defaultLogger } from "../utils/logger/logger";
import type { DeviceIdentity, SensorFamily } from "./families";

export interface IdentifyDeviceOptions {
  /** Per-probe reply timeout in ms (default 2000). */
  probeTimeoutMs?: number;
  /** Extra hello attempts after a silent first one (default 1). */
  helloRetries?: number;
  /** Skip probing entirely and connect as this family. */
  assumeFamily?: SensorFamily;
  logger?: Logger;
}

export interface IdentifiedDevice {
  family: SensorFamily;
  info: DeviceIdentity;
  connector: IDeviceDriver;
}

const HELLO_PROBE = "hello\r\n";
const INFO_PROBE = '{"command":"INFO"}\n';
const DEFAULT_PROBE_TIMEOUT_MS = 2000;
const DEFAULT_HELLO_RETRIES = 1;

/** Instantiate the concrete connector for a known sensor family. */
export function createConnectorForFamily(family: SensorFamily, logger?: Logger): IDeviceDriver {
  switch (family) {
    case "multispeq":
      return new MultispeqDriver(logger);
    case "ambit":
      return new AmbitConnector(undefined, logger);
    case "generic":
      return new GenericDeviceDriver(undefined, logger);
  }
}

interface ProbeOptions {
  timeoutMs: number;
  isComplete: (buffer: string) => boolean;
}

/**
 * Serial probe session over the transport's single data callback (concrete
 * adapters use replace semantics, so the handoff connector's initialize()
 * later displaces this listener). Resolves the buffered text once complete,
 * or null on timeout; only send errors throw.
 */
function createProbeSession(transport: ITransportAdapter) {
  let buffer = "";
  let onChunk: (() => void) | undefined;
  transport.onDataReceived((chunk) => {
    buffer += chunk;
    onChunk?.();
  });

  return async function probe(payload: string, options: ProbeOptions): Promise<string | null> {
    buffer = "";
    await transport.send(payload);
    if (options.isComplete(buffer)) return buffer;
    return new Promise<string | null>((resolve) => {
      const timer = setTimeout(() => {
        onChunk = undefined;
        resolve(null);
      }, options.timeoutMs);
      onChunk = () => {
        if (!options.isComplete(buffer)) return;
        clearTimeout(timer);
        onChunk = undefined;
        resolve(buffer);
      };
    });
  };
}

/** First buffered line that parses to an object with a "status" key, if any. */
function parseInfoReply(buffer: string): Record<string, unknown> | null {
  for (const line of buffer.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (parsed !== null && typeof parsed === "object" && "status" in parsed) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // not JSON, keep scanning
    }
  }
  return null;
}

/** Best-effort getDeviceIdentity() merged over the probe identity. */
async function enrichIdentity(
  connector: IDeviceDriver,
  probeIdentity: DeviceIdentity,
): Promise<DeviceIdentity> {
  if (!connector.getDeviceIdentity) return probeIdentity;
  try {
    const enriched = await connector.getDeviceIdentity();
    return {
      family: enriched.family,
      name: enriched.name ?? probeIdentity.name,
      deviceId: enriched.deviceId ?? probeIdentity.deviceId,
      firmwareVersion: enriched.firmwareVersion ?? probeIdentity.firmwareVersion,
      batteryPercent: enriched.batteryPercent ?? probeIdentity.batteryPercent,
      raw: { ...probeIdentity.raw, ...enriched.raw },
    };
  } catch {
    return probeIdentity;
  }
}

/**
 * Probe the transport for a known family (MultispeQ console hello, then the
 * generic JSON INFO contract) and hand off to the matching connector. Both
 * probes silent means the raw GenericCommandConnector fallback.
 */
export async function identifyDevice(
  transport: ITransportAdapter,
  options?: IdentifyDeviceOptions,
): Promise<IdentifiedDevice> {
  const log = options?.logger ?? defaultLogger;

  if (options?.assumeFamily) {
    const connector = createConnectorForFamily(options.assumeFamily, options.logger);
    await connector.initialize(transport);
    return {
      family: options.assumeFamily,
      info: { family: options.assumeFamily, raw: {} },
      connector,
    };
  }

  const timeoutMs = options?.probeTimeoutMs ?? DEFAULT_PROBE_TIMEOUT_MS;
  const helloRetries = options?.helloRetries ?? DEFAULT_HELLO_RETRIES;
  const probe = createProbeSession(transport);

  let probeIdentity: DeviceIdentity | undefined;
  let connector: IDeviceDriver | undefined;

  // Probe 1: a MultispeQ answers console "hello" with a "* Ready" line.
  for (let attempt = 0; attempt <= helloRetries; attempt++) {
    const reply = await probe(HELLO_PROBE, {
      timeoutMs,
      isComplete: (buffer) => buffer.endsWith("\n"),
    });
    if (reply === null) continue;
    if (/ready/i.test(reply)) {
      log.debug("identify: hello probe matched multispeq");
      probeIdentity = { family: "multispeq", raw: {} };
      connector = createConnectorForFamily("multispeq", options?.logger);
    }
    break;
  }

  // Probe 2: the openJII generic JSON contract answers INFO with a status object.
  if (!connector) {
    const reply = await probe(INFO_PROBE, {
      timeoutMs,
      isComplete: (buffer) => parseInfoReply(buffer) !== null,
    });
    const parsed = reply === null ? null : parseInfoReply(reply);
    if (parsed) {
      const data =
        parsed.data !== null && typeof parsed.data === "object"
          ? (parsed.data as Record<string, unknown>)
          : {};
      const family: SensorFamily = data.device_type === "ambit" ? "ambit" : "generic";
      log.debug("identify: INFO probe matched", { family });
      probeIdentity = {
        family,
        name: typeof data.device_name === "string" ? data.device_name : undefined,
        deviceId: typeof data.device_id === "string" ? data.device_id : undefined,
        firmwareVersion:
          typeof data.firmware_version === "string" ? data.firmware_version : undefined,
        raw: data,
      };
      connector = createConnectorForFamily(family, options?.logger);
    }
  }

  // Both probes silent: last-resort verbatim connector.
  if (!connector || !probeIdentity) {
    log.debug("identify: probes silent, falling back to raw command connector");
    probeIdentity = { family: "generic", raw: {} };
    connector = new GenericCommandConnector(undefined, options?.logger);
  }

  // Handoff: initialize() re-registers onDataReceived, replacing the probe listener.
  await connector.initialize(transport);

  const info = await enrichIdentity(connector, probeIdentity);
  return { family: info.family, info, connector };
}
