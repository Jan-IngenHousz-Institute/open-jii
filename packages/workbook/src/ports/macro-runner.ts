import type { MacroCell } from "@repo/api/schemas/workbook-cells.schema";

import type { CellNamespace } from "../namespace/build-cell-namespace";

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
