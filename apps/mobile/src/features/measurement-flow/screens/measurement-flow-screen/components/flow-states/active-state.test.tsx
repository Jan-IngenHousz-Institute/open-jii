import { render } from "@testing-library/react-native";
import React, { useEffect, useRef } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FlowNode } from "~/shared/measurements/flow-node";

import { ActiveState } from "./active-state";

const mountedAnalysisNodes: string[] = [];

// Records mounts, not prop changes: a reused instance keeps its first nodeId.
function RecordingAnalysisNode({ nodeId }: { nodeId: string }) {
  const mountedAs = useRef(nodeId);
  useEffect(() => {
    mountedAnalysisNodes.push(mountedAs.current);
  }, []);
  return null;
}

vi.mock("../flow-nodes/analysis-node/analysis-node", () => ({
  AnalysisNode: RecordingAnalysisNode,
}));
vi.mock("../flow-nodes/branch-node/branch-node", () => ({ BranchNode: () => null }));
vi.mock("../flow-nodes/command-node/command-node", () => ({ CommandNode: () => null }));
vi.mock("../flow-nodes/instruction-node", () => ({ InstructionNode: () => null }));
vi.mock("../flow-nodes/measurement-node/measurement-node", () => ({
  MeasurementNode: () => null,
}));
vi.mock("../flow-nodes/question-node/question-node", () => ({ QuestionNode: () => null }));

function analysisNode(id: string): FlowNode {
  return { id, name: id, type: "analysis", content: { macroId: `macro-${id}` }, isStart: false };
}

beforeEach(() => {
  mountedAnalysisNodes.length = 0;
});

describe("ActiveState", () => {
  it("gives each analysis step its own AnalysisNode, so an accepted step cannot block the next", () => {
    const { rerender } = render(<ActiveState currentNode={analysisNode("macro-js")} />);
    rerender(<ActiveState currentNode={analysisNode("macro-py")} />);

    expect(mountedAnalysisNodes).toEqual(["macro-js", "macro-py"]);
  });
});
