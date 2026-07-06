// The host-injected ports. Every environment (web, mobile, simulators) runs a
// workbook by implementing these and handing them to the WorkbookRunner.
import type { MacroCell } from "@repo/api/schemas/workbook-cells.schema";
import type { CommandProgress, SensorFamily } from "@repo/iot";

import type { CommandFormat } from "./cells";
import type { CellNamespace } from "./namespace/build-cell-namespace";

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

export interface MacroRunInput {
  cellId: string;
  macroId: string;
  language: MacroLanguage;
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
  run(input: MacroRunInput, opts: { signal: AbortSignal }): Promise<Record<string, unknown>>;
}

export type ResolvedCommandValue = string | Record<string, unknown> | unknown[];

export type CommandSource =
  | { kind: "protocolCell"; protocolId: string; version: number }
  | { kind: "inlineCell"; format: CommandFormat }
  | { kind: "artifact"; artifact: "command" | "protocol"; producedBy: string };

export interface CommandRunInput {
  cellId: string;
  /** Validated/resolved value, exactly what goes on the wire. */
  command: ResolvedCommandValue;
  family: SensorFamily;
  source: CommandSource;
  timeoutMs?: number;
}

export interface CommandExecutorPort {
  /**
   * Execute one command on the connected device and resolve with the parsed
   * response. Abort via signal must map to the connector's cancel (MultispeQ
   * sends "-1+"). Late results after abort are discarded by the runtime.
   */
  execute(
    input: CommandRunInput,
    opts: { signal: AbortSignal; onProgress: (p: CommandProgress) => void },
  ): Promise<unknown>;
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
