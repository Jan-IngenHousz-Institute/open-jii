import type { RunnerCell } from "../cells";
import type { MacroFn } from "./simulators";

export const PROTO_PSII_ID = "5f1f9c1a-2c1e-4f6a-9d1b-000000000001";
export const MACRO_PHI2_ID = "5f1f9c1a-2c1e-4f6a-9d1b-000000000002";
export const MACRO_CONSTRUCT_ID = "5f1f9c1a-2c1e-4f6a-9d1b-000000000003";

export const PSII_PROTOCOL_CODE: Record<string, unknown>[] = [
  { _protocol_set_: [{ pulses: [20, 50, 20], pulse_distance: [1500] }], averages: 1 },
];

/**
 * The demo/spec program, extending the spike's sample: instruction, required
 * question, protocol scan, analysis macro, quality branch that loops back on
 * a noisy reading, a constructor macro that returns a protocol artifact, an
 * inline console command, and a closing instruction.
 */
export const sampleWorkbook: RunnerCell[] = [
  { id: "md_intro", type: "markdown", isCollapsed: false, content: "# Leaf check\nClamp a leaf." },
  {
    id: "q_sunlight",
    type: "question",
    isCollapsed: false,
    name: "Measured in sunlight",
    question: { kind: "yes_no", text: "Is the leaf in direct sunlight?", required: true },
    isAnswered: false,
  },
  {
    id: "proto_psii",
    type: "protocol",
    isCollapsed: false,
    payload: { protocolId: PROTO_PSII_ID, version: 1, name: "PSII scan" },
  },
  {
    id: "macro_phi2",
    type: "macro",
    isCollapsed: false,
    payload: { macroId: MACRO_PHI2_ID, language: "javascript", name: "Phi2 analysis" },
  },
  {
    id: "branch_quality",
    type: "branch",
    isCollapsed: false,
    paths: [
      {
        id: "path_noisy",
        label: "Noisy reading",
        color: "#f43f5e",
        conditions: [
          {
            id: "cond_phi2_low",
            sourceCellId: "macro_phi2",
            field: "Phi2",
            operator: "lt",
            value: "0.5",
          },
        ],
        gotoCellId: "proto_psii",
      },
      { id: "path_ok", label: "Good reading", color: "#22c55e", conditions: [] },
    ],
    defaultPathId: "path_ok",
  },
  {
    id: "macro_construct",
    type: "macro",
    isCollapsed: false,
    payload: { macroId: MACRO_CONSTRUCT_ID, language: "javascript", name: "Follow-up builder" },
  },
  {
    id: "cmd_battery",
    type: "command",
    isCollapsed: false,
    payload: { format: "string", content: "battery", name: "Battery check" },
  },
  { id: "md_done", type: "markdown", isCollapsed: false, content: "Done. Release the leaf." },
];

function mean(values: number[]): number {
  return values.length === 0 ? 0 : values.reduce((a, b) => a + b, 0) / values.length;
}

/**
 * Phi2 analysis: reads the raw scan (`json`) and the sunlight answer from the
 * ctx namespace. Pure data output; routing happens on the branch cell.
 */
const phi2Macro: MacroFn = (json, ctx) => {
  const scan = (json ?? {}) as { raw_fluorescence?: number[] };
  const raw = scan.raw_fluorescence ?? [];
  const sunlit =
    (ctx.ctx.measured_in_sunlight as { answer?: string } | undefined)?.answer === "yes";
  return {
    Phi2: Number(mean(raw).toFixed(3)),
    sunlit,
    samples: raw.length,
  };
};

/**
 * Constructor macro: builds a follow-up protocol from prior outputs and
 * returns it as a tagged artifact. The host validates it against @repo/iot
 * before anything reaches a device.
 */
const constructMacro: MacroFn = (_json, ctx) => {
  const phi2 = (ctx.ctx.phi2_analysis as { Phi2?: number } | undefined)?.Phi2 ?? 0;
  return {
    __ojArtifact: "protocol",
    version: 1,
    code: [{ _protocol_set_: [{ pulses: [10], target_phi2: phi2 }], averages: 1 }],
  };
};

export const sampleMacroRegistry: Partial<Record<string, MacroFn>> = {
  [MACRO_PHI2_ID]: phi2Macro,
  [MACRO_CONSTRUCT_ID]: constructMacro,
};

export const sampleProtocolCode: Partial<Record<string, Record<string, unknown>[]>> = {
  [PROTO_PSII_ID]: PSII_PROTOCOL_CODE,
};

/** Scan responses per attempt: noisy first (mean 0.475), clean second (0.747). */
export const scanAttempts: Record<string, unknown>[] = [
  { raw_fluorescence: [0.21, 0.83, 0.79, 0.07], detectors: 3 },
  { raw_fluorescence: [0.71, 0.78, 0.75], detectors: 3 },
];
