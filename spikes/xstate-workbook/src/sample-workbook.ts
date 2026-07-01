import type { z } from "zod";

import { zWorkbookCellArray } from "@repo/api/schemas/workbook-cells.schema";
import type { WorkbookCell } from "@repo/api/schemas/workbook-cells.schema";

import type { MacroRegistry } from "./runtime";

const PHI2_MACRO_ID = "22222222-2222-4222-8222-222222222222";

// A representative photosynthesis workbook exercising every executable cell type
// plus a loop-back branch. This is the "snapshot" the spike feeds in as-is:
// the exact cell array a saved workbook version persists. Typed as the schema's
// INPUT (optional defaults like isCollapsed omitted); parse() fills them in.
const sampleWorkbookCells: z.input<typeof zWorkbookCellArray> = [
  {
    id: "md_intro",
    type: "markdown",
    content: "## Photosynthesis run\nClip the leaf into the MultispeQ, then start.",
  },
  {
    id: "q_sunlight",
    type: "question",
    name: "measured_in_sunlight",
    question: { kind: "yes_no", text: "Was the leaf in direct sunlight?", required: true },
  },
  {
    id: "proto_psii",
    type: "protocol",
    payload: {
      protocolId: "11111111-1111-4111-8111-111111111111",
      version: 1,
      name: "PSII / Phi2",
    },
  },
  {
    id: "macro_phi2",
    type: "macro",
    payload: {
      macroId: PHI2_MACRO_ID,
      language: "javascript",
      name: "Compute Phi2",
    },
  },
  // Output cells hold a producer's result; data is empty in the static snapshot
  // and filled at runtime (the machine writes context.outputs[producedBy] here).
  { id: "out_phi2", type: "output", producedBy: "macro_phi2" },
  {
    id: "branch_quality",
    type: "branch",
    paths: [
      {
        id: "path_remeasure",
        label: "Phi2 too low - remeasure",
        color: "#ef4444",
        conditions: [
          { id: "c1", sourceCellId: "macro_phi2", field: "Phi2", operator: "lt", value: "0.5" },
        ],
        gotoCellId: "proto_psii",
      },
      {
        id: "path_continue",
        label: "Good reading - continue",
        color: "#22c55e",
        conditions: [],
      },
    ],
    defaultPathId: "path_continue",
  },
  {
    id: "md_done",
    type: "markdown",
    content: "Done. Thanks for the reading!",
  },
];

// Proves the fixture is a valid workbook snapshot per the production schema.
export const sampleWorkbook: WorkbookCell[] = zWorkbookCellArray.parse(sampleWorkbookCells);

// The macro source the macro cell references by id. Reads the upstream scan
// (`json.raw_fluorescence`) AND the ctx namespace (`ctx.answers`), computes Phi2,
// and returns derived fields + messages (the shape the sandbox/mobile produce).
// The downstream branch routes on this computed value: genuine state pass-through.
export const sampleMacroRegistry: MacroRegistry = {
  [PHI2_MACRO_ID]: {
    language: "javascript",
    code: `
      const raw = (json && json.raw_fluorescence) || [];
      const fs = raw[0];
      const fmPrime = Math.max.apply(null, raw);
      const phi2 = fmPrime > 0 ? (fmPrime - fs) / fmPrime : 0;
      const sunlit = ctx.answers.q_sunlight === "yes";
      const out = {
        Phi2: Number(phi2.toFixed(3)),
        sunlit: sunlit,
        messages: { info: ["computed Phi2 from " + raw.length + " points (sunlit=" + sunlit + ")"] },
      };
      // A good reading: construct a follow-up confirmation protocol for the flow
      // to dispatch next. This is a macro "passing a thing" that drives the flow.
      if (phi2 >= 0.5) {
        out.__dispatch = {
          kind: "protocol",
          family: "multispeq",
          code: [{ _protocol_set_: [{ pulses: [20], pulse_distance: [1000], detectors: [[1, 2, 3]] }], set_repeats: 1 }],
        };
        out.messages.info.push("good reading - queued confirmation scan");
      }
      return out;
    `,
  },
};
