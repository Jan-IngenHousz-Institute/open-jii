import {
  estimateProtocolDurationMs,
  protocolRequiresInteraction,
} from "@repo/iot";

// The two async side effects a workbook step can trigger. In production these are
// a BLE/serial device scan and a sandboxed macro execution; the machine treats
// them as invoked actors, so the spike only needs these injectable adapters.

// The "ctx namespace": upstream answers + outputs a step can read. Mirrors the
// state-propagation work (macros read upstream outputs via an implicit ctx).
export interface Ctx {
  answers: Record<string, string>;
  outputs: Record<string, unknown>;
}

// A protocol a macro builds at runtime (vs a protocol cell's fixed id). Shape
// mirrors the @repo/api protocol: a device `family` + a `code` instruction array.
export interface ConstructedProtocol {
  kind: "protocol";
  family: "multispeq" | "ambit" | "generic";
  code: Record<string, unknown>[];
}

// The envelope key a macro uses to hand a constructed protocol back to the flow.
// Stand-in for the real "constructor builder" contract on the state-propagation branch.
export const DISPATCH_KEY = "__dispatch";

export function getConstructedProtocol(output: unknown): ConstructedProtocol | null {
  if (output === null || typeof output !== "object") return null;
  const d = (output as Record<string, unknown>)[DISPATCH_KEY];
  if (d === null || typeof d !== "object") return null;
  const candidate = d as Partial<ConstructedProtocol>;
  return candidate.kind === "protocol" && Array.isArray(candidate.code)
    ? (d as ConstructedProtocol)
    : null;
}

export interface ProtocolInput {
  cellId: string;
  protocolId?: string; // a protocol cell's fixed id
  protocol?: ConstructedProtocol; // a macro-constructed protocol to dispatch
  params?: Record<string, unknown>;
  ctx: Ctx;
}

export interface MacroInput {
  cellId: string;
  macroId: string;
  // The upstream scan sample the macro runs against (nearest preceding
  // measurement output), exposed to macro code as `json` - exactly what
  // production passes. null if no measurement precedes this macro.
  json: Record<string, unknown> | null;
  ctx: Ctx;
  params?: Record<string, unknown>;
}

export interface WorkbookRuntime {
  runProtocol: (input: ProtocolInput) => Promise<Record<string, unknown>>;
  runMacro: (input: MacroInput) => Promise<Record<string, unknown>>;
}

// --- macro executor --------------------------------------------------------

export interface MacroDefinition {
  code: string;
  language?: "javascript" | "python" | "r";
}

// macroId -> macro source. In production the macro entity is fetched by id; here
// the workbook fixture supplies the registry.
export type MacroRegistry = Record<string, MacroDefinition>;

// Mirrors mobile's executeMacro: run the macro body (which uses `return`) with
// the scan sample as `json`, plus the ctx namespace. JS only in the spike;
// python/r would route to the macro-sandbox.
function runJsMacro(
  code: string,
  json: Record<string, unknown>,
  ctx: Ctx,
): Record<string, unknown> {
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  const fn = new Function("json", "ctx", code) as (
    j: Record<string, unknown>,
    c: Ctx,
  ) => Record<string, unknown> | undefined;
  return fn(structuredClone(json), structuredClone(ctx)) ?? {};
}

export function createMacroExecutor(registry: MacroRegistry): WorkbookRuntime["runMacro"] {
  return async ({ macroId, json, ctx }) => {
    const def = registry[macroId];
    if (!def) throw new Error(`No macro registered for ${macroId}`);
    const language = def.language ?? "javascript";
    if (language !== "javascript") {
      throw new Error(`Spike executes JS macros only; ${language} would route to the macro-sandbox`);
    }
    return runJsMacro(def.code, json ?? {}, ctx);
  };
}

// --- protocol (device scan) simulator --------------------------------------

// A measurement returns raw traces. The default returns a noisy reading first
// (low computed Phi2) then a clean one, so a quality branch on the macro output
// loops back to remeasure exactly once - and the decision is driven by the
// macro genuinely computing over each scan, not a hardcoded sequence.
export function createProtocolSimulator(
  rawByAttempt: number[][] = [
    [0.21, 0.4, 0.38, 0.36],
    [0.21, 0.83, 0.79, 0.74],
  ],
): WorkbookRuntime["runProtocol"] {
  let attempt = 0;
  return async ({ protocolId, protocol }) => {
    // A macro-constructed protocol: validate + inspect it with the real @repo/iot
    // functions before "running" it, exactly as a dispatch path would.
    if (protocol) {
      if (!Array.isArray(protocol.code) || protocol.code.length === 0) {
        throw new Error("constructed protocol has empty code");
      }
      return {
        dispatched: true,
        family: protocol.family,
        estimateMs: estimateProtocolDurationMs(protocol.code),
        requiresInteraction: protocolRequiresInteraction(protocol.code),
      };
    }
    const raw = rawByAttempt[Math.min(attempt, rawByAttempt.length - 1)];
    attempt += 1;
    return { protocolId, raw_fluorescence: raw, detectors: 3 };
  };
}

export function createRuntime(registry: MacroRegistry, rawByAttempt?: number[][]): WorkbookRuntime {
  return {
    runProtocol: createProtocolSimulator(rawByAttempt),
    runMacro: createMacroExecutor(registry),
  };
}
