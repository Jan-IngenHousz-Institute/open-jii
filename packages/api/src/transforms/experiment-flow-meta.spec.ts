import { describe, expect, it } from "vitest";

import type { ExperimentFlowGraph } from "../domains/experiment/experiment.schema";
import { deriveExperimentFlowMeta } from "./experiment-flow-meta";

const protocolId = "11111111-1111-1111-1111-111111111111";

describe("deriveExperimentFlowMeta", () => {
  it("derives the picker metadata from the reachable flow", () => {
    const graph: ExperimentFlowGraph = {
      nodes: [
        {
          id: "instruction",
          type: "instruction",
          name: "Prepare",
          content: { text: "Prepare" },
          isStart: true,
        },
        {
          id: "question",
          type: "question",
          name: "Leaf age",
          content: { kind: "number", text: "Leaf age?", required: true },
          isStart: false,
        },
        {
          id: "measurement",
          type: "measurement",
          name: "Scan",
          content: { protocolId },
          isStart: false,
        },
      ],
      edges: [
        { id: "e1", source: "instruction", target: "question", label: null },
        { id: "e2", source: "question", target: "measurement", label: null },
      ],
    };

    expect(deriveExperimentFlowMeta(graph)).toEqual({
      requiresDevice: true,
      questionsOnly: false,
      nodeCount: 3,
      durationMin: 3,
    });
  });

  it("does not treat inline commands as minute-long protocol scans", () => {
    const graph: ExperimentFlowGraph = {
      nodes: [
        {
          id: "command",
          type: "measurement",
          name: "Battery",
          content: { command: { format: "string", content: "battery" } },
          isStart: true,
        },
      ],
      edges: [],
    };

    expect(deriveExperimentFlowMeta(graph)).toEqual({
      requiresDevice: true,
      questionsOnly: false,
      nodeCount: 1,
      durationMin: 1,
    });
  });

  it("recognizes question-only flows and rounds their duration", () => {
    const graph: ExperimentFlowGraph = {
      nodes: [
        {
          id: "q1",
          type: "question",
          name: "One",
          content: { kind: "yes_no", text: "One?", required: false },
          isStart: true,
        },
        {
          id: "q2",
          type: "question",
          name: "Two",
          content: { kind: "yes_no", text: "Two?", required: false },
          isStart: false,
        },
        {
          id: "q3",
          type: "question",
          name: "Three",
          content: { kind: "yes_no", text: "Three?", required: false },
          isStart: false,
        },
      ],
      edges: [
        { id: "e1", source: "q1", target: "q2", label: null },
        { id: "e2", source: "q2", target: "q3", label: null },
      ],
    };

    expect(deriveExperimentFlowMeta(graph)).toEqual({
      requiresDevice: false,
      questionsOnly: true,
      nodeCount: 3,
      durationMin: 2,
    });
  });
});
