/**
 * Device identification: probe an unidentified transport for a known sensor
 * family and hand off to the matching connector. Never throws for silence;
 * only transport send errors propagate. The transport is never disconnected.
 */
import { AmbitDriver } from "../driver/ambit/driver";
import type { IDeviceDriver } from "../driver/driver-base";
import { GenericCommandConnector } from "../driver/generic/command-connector";
import { GenericDeviceDriver } from "../driver/generic/driver";
import { MiniParDriver } from "../driver/minipar/driver";
import { MultispeqDriver } from "../driver/multispeq/driver";
import type { ITransportAdapter } from "../transport/interface";
import type { Logger } from "../utils/logger/logger";
import { defaultLogger } from "../utils/logger/logger";
import type { DeviceIdentity, SensorFamily } from "./families";
import { isSensorFamily } from "./families";

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
      return new AmbitDriver(undefined, logger);
    case "minipar":
      return new MiniParDriver(undefined, logger);
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
 * later displaces this listener). Resolves the buffered text once complete;
 * on timeout it resolves whatever arrived (possibly ""), since some devices
 * (miniPAR hello) reply without a trailing newline. Only send errors throw.
 */
function createProbeSession(transport: ITransportAdapter) {
  let buffer = "";
  let onChunk: (() => void) | undefined;
  transport.onDataReceived((chunk) => {
    buffer += chunk;
    onChunk?.();
  });

  return async function probe(payload: string, options: ProbeOptions): Promise<string> {
    buffer = "";
    await transport.send(payload);
    if (options.isComplete(buffer)) return buffer;
    return new Promise<string>((resolve) => {
      const timer = setTimeout(() => {
        onChunk = undefined;
        resolve(buffer);
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

/**
 * Classify a hello reply against the known firmware signatures, weakest
 * signature last:
 *  - miniPAR: `{"device":"MiniPAR","version":"1.1"}` (JSON mode) or
 *    `MiniPAR,1.1,1.04` (line mode)
 *  - MultispeQ: `MultispeQ Ready`, older firmware `Instrument Ready`
 *  - Ambit: any other `<name> Ready` line (firmware prints a hardcoded
 *    `NEW Name Here Ready`; never trust the name, only the sentinel)
 */
function classifyHelloReply(reply: string): DeviceIdentity | null {
  const text = reply.trim();
  if (!text) return null;
  const raw = { helloReply: text };

  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("{")) continue;
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (
        parsed !== null &&
        typeof parsed === "object" &&
        typeof (parsed as Record<string, unknown>).device === "string" &&
        /minipar/i.test((parsed as Record<string, unknown>).device as string)
      ) {
        const version = (parsed as Record<string, unknown>).version;
        return {
          family: "minipar",
          name: (parsed as Record<string, unknown>).device as string,
          firmwareVersion: typeof version === "string" ? version : undefined,
          raw,
        };
      }
    } catch {
      // not JSON, keep scanning
    }
  }

  const csvMatch = /^minipar\s*,\s*([^,\s]+)\s*(?:,\s*([^,\s]+))?/im.exec(text);
  if (csvMatch) {
    return {
      family: "minipar",
      name: "MiniPAR",
      firmwareVersion: csvMatch.at(2) ?? csvMatch.at(1),
      raw,
    };
  }

  if (/multispeq/i.test(text) || /instrument\s+ready/i.test(text)) {
    return { family: "multispeq", raw };
  }

  const readyMatch = /^(.*?)\s*\bready\b\s*$/im.exec(text);
  if (readyMatch) {
    // Ambit firmware currently hardcodes the text before "Ready".  It is a
    // family signature, not a device name, so do not leak the placeholder into
    // $device.name.
    return { family: "ambit", raw };
  }

  return null;
}

/** First buffered line that parses to an object with a "status" key, if any. */
function parseInfoReply(buffer: string): Record<string, unknown> | null {
  for (const line of buffer.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (parsed !== null && typeof parsed === "object" && "status" in parsed) {
        return parsed;
      }
    } catch {
      // not JSON, keep scanning
    }
  }
  return null;
}

/**
 * Best-effort getDeviceIdentity() merged over the probe identity. The probe
 * classification stays the family of record: fallback connectors self-report
 * "generic" and must not overwrite a probe-resolved family.
 */
async function enrichIdentity(
  connector: IDeviceDriver,
  probeIdentity: DeviceIdentity,
): Promise<DeviceIdentity> {
  if (!connector.getDeviceIdentity) return probeIdentity;
  try {
    const enriched = await connector.getDeviceIdentity();
    return {
      family: probeIdentity.family,
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
 * Probe the transport for a known family (console "hello" signatures, then
 * the generic JSON INFO contract) and hand off to the matching connector.
 * Both probes silent means the raw GenericCommandConnector fallback.
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

  // Probe 1: every known console firmware answers "hello" with a signature.
  for (let attempt = 0; attempt <= helloRetries; attempt++) {
    const reply = await probe(HELLO_PROBE, {
      timeoutMs,
      isComplete: (buffer) => buffer.includes("\n") || classifyHelloReply(buffer) !== null,
    });
    if (reply.trim() === "") continue;
    const classified = classifyHelloReply(reply);
    if (classified) {
      log.debug("identify: hello probe matched", { family: classified.family });
      probeIdentity = classified;
      connector = createConnectorForFamily(classified.family, options?.logger);
    }
    break;
  }

  // Probe 2: the openJII generic JSON contract answers INFO with a status object.
  if (!connector) {
    const reply = await probe(INFO_PROBE, {
      timeoutMs,
      isComplete: (buffer) => parseInfoReply(buffer) !== null,
    });
    const parsed = parseInfoReply(reply);
    if (parsed) {
      const data =
        parsed.data !== null && typeof parsed.data === "object"
          ? (parsed.data as Record<string, unknown>)
          : {};
      const family: SensorFamily = isSensorFamily(data.device_type) ? data.device_type : "generic";
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
