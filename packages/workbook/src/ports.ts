// The host-injected ports. Every environment (web, mobile, simulators) runs a
// workbook by implementing these and handing them to the WorkbookRunner.
import type {
  MacroCell,
  OutputDeviceResult,
} from "@repo/api/domains/workbook/workbook-cells.schema";
import type { CellNamespace } from "@repo/api/transforms/build-cell-namespace";
import type { CommandProgress, SensorFamily } from "@repo/iot";

import type { CommandFormat } from "./cells";

/** The device-driver progress shape; one definition, owned by @repo/iot. */
export type { CommandProgress } from "@repo/iot";

/** Injected time source; the reducer itself never reads a clock. */
export interface ClockPort {
  now(): number;
}

export const systemClock: ClockPort = {
  now: () => Date.now(),
};

/** Structurally compatible with @repo/iot's Logger and mobile's createLogger. */
export interface LoggerPort {
  debug(msg: string, fields?: Record<string, unknown>): void;
  info(msg: string, fields?: Record<string, unknown>): void;
  warn(msg: string, fields?: Record<string, unknown>): void;
  error(msg: string, fields?: Record<string, unknown>): void;
}

export const noopLogger: LoggerPort = {
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

export type MacroLanguage = MacroCell["payload"]["language"];

/**
 * One device's outcome from an executed producer. Exactly one of data/error
 * is set. Single-device hosts return a one-element array; the runtime
 * collapses outcomes into the output entry (flat data for one device,
 * `deviceResults` when fanned out). Shape-compatible with @repo/api's
 * OutputDeviceResult so outcomes persist onto output cells unchanged.
 */
export interface DeviceOutcome {
  deviceId: string;
  deviceLabel: string;
  family?: OutputDeviceResult["family"];
  deviceName?: string;
  data?: unknown;
  error?: string;
}

export interface MacroRunInput {
  trackId: string;
  cellId: string;
  macroId: string;
  language: MacroLanguage;
  /**
   * Set when this run is one leg of a multi-device fan-out: the connection id
   * whose measurement (and device-scoped ctx) this run reads.
   */
  deviceId?: string;
  deviceLabel?: string;
  family?: OutputDeviceResult["family"];
  deviceName?: string;
  /** Frozen device-connection subset owned by this track. */
  deviceIds: string[];
  /** Exact upstream producer whose raw rows this macro consumes. */
  producerCellId?: string;
  /**
   * Verbatim (raw, NOT normalized) output of the nearest upstream producer
   * cell (protocol or command) in the current cycle, or null. This is the
   * `json` a macro's code receives. Named values go through `ctx` instead,
   * which carries the normalized first-sample view; the asymmetry is
   * deliberate.
   */
  json: unknown;
  ctx: CellNamespace;
  params?: Record<string, unknown>;
}

export interface MacroRunnerPort {
  /** Hosts: web = backend executeMacro mutation; mobile = on-device Pyodide sandbox. */
  run(
    input: MacroRunInput,
    opts: { signal: AbortSignal; effectId?: string },
  ): Promise<Record<string, unknown>>;
}

export type ResolvedCommandValue = string | Record<string, unknown> | unknown[];

export type CommandSource =
  | { kind: "protocolCell"; protocolId: string; version: number }
  | { kind: "inlineCell"; format: CommandFormat }
  | { kind: "artifact"; artifact: "command" | "protocol"; producedBy: string };

export interface CommandRunInput {
  trackId: string;
  cellId: string;
  /** Validated/resolved value, exactly what goes on the wire. */
  command: ResolvedCommandValue;
  family: SensorFamily;
  source: CommandSource;
  timeoutMs?: number;
  /** Required device-connection subset; an empty list targets no devices. */
  deviceIds: string[];
}

export interface CommandExecutorPort {
  /**
   * Execute one command on the targeted device(s) and resolve with one
   * outcome per device (a single-device host returns a one-element array).
   * Abort via signal must map to the connector's cancel (MultispeQ sends
   * "-1+"). Late results after abort are discarded by the runtime.
   */
  execute(
    input: CommandRunInput,
    opts: {
      signal: AbortSignal;
      effectId?: string;
      onProgress: (p: CommandProgress) => void;
    },
  ): Promise<DeviceOutcome[]>;
}

export interface ProtocolCodeResolverPort {
  /** Resolve a protocol cell's id to instruction blocks; null when unknown. */
  resolveProtocolCode(
    protocolId: string,
    version?: number,
  ): Promise<Record<string, unknown>[] | null>;
}

/**
 * Optional storage for large producer outputs. Live state always holds inline
 * values; the snapshot layer offloads to this store (entries become {ref})
 * and restore inflates them back. Without a store, snapshots stay inline.
 */
export interface OutputStorePort {
  put(key: string, data: unknown): Promise<string>;
  get(ref: string): Promise<unknown>;
}
