import type { SensorFamily } from "@repo/iot";

import type { CommandFormat } from "../cells";

/** Mirrors the device-driver progress shape used by the mobile executor. */
export interface CommandProgress {
  phase: "sent" | "receiving";
  chunks: number;
  bytes: number;
  elapsedMs: number;
  lastEventAt: number;
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
