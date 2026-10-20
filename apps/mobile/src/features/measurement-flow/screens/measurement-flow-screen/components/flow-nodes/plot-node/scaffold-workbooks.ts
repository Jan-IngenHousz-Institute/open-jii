import type { ScanResult } from "~/features/measurement-flow/domain/flow-transitions";
import type { FlowNode } from "~/shared/measurements/flow-node";

export const LEAF_READING_NODE_ID = "scaffold-leaf-reading";
export const LEAF_SUMMARY_NODE_ID = "scaffold-leaf-summary";

// Base64, as workbook snapshots carry macro code.
const LEAF_SUMMARY_MACRO =
  "cmV0dXJuIHsgbGVhZl90ZW1wZXJhdHVyZToganNvbi5sZWFmX3RlbXBlcmF0dXJlLCBncmVlbm5lc3NfaW5kZXg6IGpzb24uZ3JlZW5uZXNzX2luZGV4LCBzaWduYWw6IGpzb24uc2lnbmFsIH07";

/** A questions-only workbook with one single-choice question. */
export const WILTING_SCORE_WORKBOOK: FlowNode[] = [
  {
    id: "scaffold-wilting-score",
    name: "Wilting score",
    type: "question",
    isStart: true,
    content: {
      kind: "single_choice",
      text: "Wilting score",
      options: ["1", "2", "3", "4", "5"],
      required: false,
    },
  },
];

/** A device workbook: one reading, then the macro that summarizes it. */
export const LEAF_READING_WORKBOOK: FlowNode[] = [
  {
    id: LEAF_READING_NODE_ID,
    name: "Leaf reading",
    type: "measurement",
    isStart: true,
    content: {
      protocolId: LEAF_READING_NODE_ID,
      protocol: { code: [], name: "Leaf reading" },
    },
  },
  {
    id: LEAF_SUMMARY_NODE_ID,
    name: "Leaf summary",
    type: "analysis",
    isStart: false,
    content: {
      macroId: LEAF_SUMMARY_NODE_ID,
      params: {},
      macro: {
        id: LEAF_SUMMARY_NODE_ID,
        name: "Leaf summary",
        filename: "leaf_summary",
        language: "javascript",
        code: LEAF_SUMMARY_MACRO,
      },
    },
  },
];

/** What a mock device sends for one leaf reading. */
export const LEAF_READING_RESULT: ScanResult = {
  leaf_temperature: 24.6,
  greenness_index: 41.8,
  signal: [
    12, 18, 27, 39, 52, 64, 73, 79, 82, 83, 82, 80, 77, 73, 69, 65, 61, 58, 55, 52, 50, 48, 46, 45,
    44, 43, 42, 42, 41, 41,
  ],
};
