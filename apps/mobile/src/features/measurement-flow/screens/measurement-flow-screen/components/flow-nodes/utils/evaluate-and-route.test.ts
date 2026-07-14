import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FlowNode } from "~/shared/measurements/flow-node";

import type {
  BranchCell,
  BranchCondition,
  BranchPath,
  CommandCell,
  ProtocolCell,
  QuestionCell,
  WorkbookCell,
} from "@repo/api/schemas/workbook-cells.schema";

import { evaluateAndRoute, MAX_BRANCH_VISITS } from "./evaluate-and-route";

const mockSetCurrentFlowStep = vi.fn();
const mockNextStep = vi.fn();
const mockSetLastMatchedPath = vi.fn();
const mockIncrementBranchVisit = vi.fn();
const mockRecordBranchJump = vi.fn();
const mockGetAnswer = vi.fn((_c: number, _id: string): string | undefined => undefined);

interface MockFlowState {
  flowNodes: FlowNode[];
  currentFlowStep: number;
  iterationCount: number;
  scanResult?: unknown;
  producerCellId?: string;
  cells: WorkbookCell[];
  branchVisitCounts: Record<string, number>;
  setCurrentFlowStep: typeof mockSetCurrentFlowStep;
  nextStep: typeof mockNextStep;
  setLastMatchedPath: typeof mockSetLastMatchedPath;
  incrementBranchVisit: typeof mockIncrementBranchVisit;
  recordBranchJump: typeof mockRecordBranchJump;
}

const flowState: MockFlowState = {
  flowNodes: [],
  currentFlowStep: 0,
  iterationCount: 0,
  scanResult: undefined,
  producerCellId: undefined,
  cells: [],
  branchVisitCounts: {},
  setCurrentFlowStep: mockSetCurrentFlowStep,
  nextStep: mockNextStep,
  setLastMatchedPath: mockSetLastMatchedPath,
  incrementBranchVisit: mockIncrementBranchVisit,
  recordBranchJump: mockRecordBranchJump,
};

vi.mock("~/features/measurement-flow/stores/use-measurement-flow-store", () => ({
  useMeasurementFlowStore: { getState: () => flowState },
}));
vi.mock("~/features/measurement-flow/stores/use-flow-answers-store", () => ({
  useFlowAnswersStore: { getState: () => ({ getAnswer: mockGetAnswer }) },
}));

const branchFlowNode = (id: string): FlowNode => ({
  id,
  type: "branch",
  name: "Branch",
  content: {},
  isStart: false,
});
const plainFlowNode = (id: string): FlowNode => ({
  id,
  type: "question",
  name: id,
  content: {},
  isStart: false,
});
// The active protocol is derived from the flow's measurement node (flowProtocolId).
const measurementFlowNode = (id: string, protocolId: string): FlowNode => ({
  id,
  type: "measurement",
  name: id,
  content: { protocolId },
  isStart: false,
});

const qCell = (id: string): QuestionCell => ({
  id,
  type: "question",
  isCollapsed: false,
  name: id,
  question: { kind: "number", text: id, required: false },
  isAnswered: false,
});
const pCell = (id: string, protocolId: string): ProtocolCell => ({
  id,
  type: "protocol",
  isCollapsed: false,
  payload: { protocolId, version: 1 },
});
const cCell = (id: string): CommandCell => ({
  id,
  type: "command",
  isCollapsed: false,
  payload: { format: "string", content: "battery" },
});
const cond = (
  sourceCellId: string,
  operator: BranchCondition["operator"],
  value: string,
  field = "answer",
): BranchCondition => ({
  id: `${sourceCellId}-${operator}-${value}`,
  sourceCellId,
  field,
  operator,
  value,
});
const path = (id: string, conditions: BranchCondition[], gotoCellId?: string): BranchPath => ({
  id,
  label: id.toUpperCase(),
  color: "#abcdef",
  conditions,
  gotoCellId,
});
const branch = (id: string, paths: BranchPath[], defaultPathId?: string): BranchCell => ({
  id,
  type: "branch",
  isCollapsed: false,
  paths,
  defaultPathId,
});

beforeEach(() => {
  vi.clearAllMocks();
  mockGetAnswer.mockReturnValue(undefined);
  flowState.flowNodes = [];
  flowState.currentFlowStep = 0;
  flowState.iterationCount = 0;
  flowState.scanResult = undefined;
  flowState.producerCellId = undefined;
  flowState.cells = [];
  flowState.branchVisitCounts = {};
});

describe("evaluateAndRoute", () => {
  it("jumps to the matched path's gotoCellId target (simple branch)", () => {
    mockGetAnswer.mockImplementation((_c, id) => (id === "q1" ? "yes" : undefined));
    flowState.cells = [
      qCell("q1"),
      branch("b1", [path("pa", [cond("q1", "eq", "yes")], "tgt"), path("pdef", [])], "pdef"),
    ];
    flowState.flowNodes = [branchFlowNode("b1"), plainFlowNode("y"), plainFlowNode("tgt")];
    flowState.currentFlowStep = 0;

    evaluateAndRoute(branchFlowNode("b1"));

    expect(mockIncrementBranchVisit).toHaveBeenCalledWith("b1");
    expect(mockSetLastMatchedPath).toHaveBeenCalledWith({ label: "PA", color: "#abcdef" });
    // Records the jump (for Back unwinding) before routing to the target.
    expect(mockRecordBranchJump).toHaveBeenCalledWith(2);
    expect(mockRecordBranchJump.mock.invocationCallOrder[0]).toBeLessThan(
      mockSetCurrentFlowStep.mock.invocationCallOrder[0],
    );
    expect(mockSetCurrentFlowStep).toHaveBeenCalledWith(2); // index of "tgt"
    expect(mockNextStep).not.toHaveBeenCalled();
  });

  it("does NOT record a Back-return for a backward (loop-back) gotoCellId jump", () => {
    // Branch at index 2 loops back to "loop" at index 0. Recording a return
    // here would push Back forward past the target
    mockGetAnswer.mockImplementation((_c, id) => (id === "loop" ? "yes" : undefined));
    flowState.cells = [
      qCell("loop"),
      qCell("mid"),
      branch("b1", [path("pa", [cond("loop", "eq", "yes")], "loop")], "pdef"),
    ];
    flowState.flowNodes = [plainFlowNode("loop"), plainFlowNode("mid"), branchFlowNode("b1")];
    flowState.currentFlowStep = 2; // on the branch

    evaluateAndRoute(branchFlowNode("b1"));

    expect(mockSetCurrentFlowStep).toHaveBeenCalledWith(0); // looped back to "loop"
    expect(mockRecordBranchJump).not.toHaveBeenCalled(); // backward jump records nothing
  });

  it("fires the default path when no conditions match", () => {
    mockGetAnswer.mockReturnValue("no");
    flowState.cells = [
      qCell("q1"),
      branch("b1", [path("pa", [cond("q1", "eq", "yes")], "tgt"), path("pdef", [])], "pdef"),
    ];
    flowState.flowNodes = [branchFlowNode("b1"), plainFlowNode("y"), plainFlowNode("tgt")];
    flowState.currentFlowStep = 0;

    evaluateAndRoute(branchFlowNode("b1"));

    expect(mockSetLastMatchedPath).toHaveBeenCalledWith({ label: "PDEF", color: "#abcdef" });
    // default path has no gotoCellId → sequential (index 1), not the goto target (index 2)
    expect(mockSetCurrentFlowStep).toHaveBeenCalledWith(1);
    // Fall-through still records a Back-return (landing = next index) so stepping
    // back unwinds past the auto-advancing branch instead of re-triggering it.
    expect(mockRecordBranchJump).toHaveBeenCalledWith(1);
    expect(mockRecordBranchJump.mock.invocationCallOrder[0]).toBeLessThan(
      mockSetCurrentFlowStep.mock.invocationCallOrder[0],
    );
  });

  it("records a Back-return for a mid-flow fall-through branch (Back can unwind past it)", () => {
    mockGetAnswer.mockReturnValue("no");
    // Branch sits in the middle: [q(before)=idx0, branch=idx1, q(after)=idx2].
    flowState.cells = [
      qCell("before"),
      branch("b1", [path("pa", [cond("before", "eq", "yes")], "tgt"), path("pdef", [])], "pdef"),
      qCell("after"),
    ];
    flowState.flowNodes = [plainFlowNode("before"), branchFlowNode("b1"), plainFlowNode("after")];
    flowState.currentFlowStep = 1; // active node is the branch

    evaluateAndRoute(branchFlowNode("b1"));

    // Falls through to the node after the branch (idx 2)...
    expect(mockSetCurrentFlowStep).toHaveBeenCalledWith(2);
    // ...and records the landing so Back unwinds to the step before the branch.
    expect(mockRecordBranchJump).toHaveBeenCalledWith(2);
    expect(mockNextStep).not.toHaveBeenCalled();
  });

  it("requires all conditions in a path (implicit AND), incl. measurement output", () => {
    mockGetAnswer.mockImplementation((_c, id) => (id === "q1" ? "yes" : undefined));
    flowState.producerCellId = "p1";
    flowState.scanResult = { sample: [{ phi2: 0.8 }] };
    flowState.cells = [
      qCell("q1"),
      pCell("p1", "proto-1"),
      branch(
        "b1",
        [
          path("pa", [cond("q1", "eq", "yes"), cond("p1", "gt", "0.5", "phi2")], "tgt"),
          path("pdef", []),
        ],
        "pdef",
      ),
    ];
    flowState.flowNodes = [
      branchFlowNode("b1"),
      measurementFlowNode("y", "proto-1"),
      plainFlowNode("tgt"),
    ];
    flowState.currentFlowStep = 0;

    evaluateAndRoute(branchFlowNode("b1"));

    expect(mockSetLastMatchedPath).toHaveBeenCalledWith({ label: "PA", color: "#abcdef" });
    expect(mockSetCurrentFlowStep).toHaveBeenCalledWith(2);
  });

  it("resolves a command's scalar response so a Command→Branch takes the matching path", () => {
    // Regression (Vlad, on device): mobile stored the raw command result, so the
    // branch's `response` field was undefined and it fell to the default path
    // while web (which wraps a scalar as { response }) matched. hydrateCells now
    // mirrors web for command producers.
    flowState.producerCellId = "cmd1";
    flowState.scanResult = "OK";
    flowState.cells = [
      cCell("cmd1"),
      branch(
        "b1",
        [path("pass", [cond("cmd1", "eq", "OK", "response")], "tgt"), path("pdef", [])],
        "pdef",
      ),
    ];
    flowState.flowNodes = [branchFlowNode("b1"), plainFlowNode("y"), plainFlowNode("tgt")];
    flowState.currentFlowStep = 0;

    evaluateAndRoute(branchFlowNode("b1"));

    expect(mockSetLastMatchedPath).toHaveBeenCalledWith({ label: "PASS", color: "#abcdef" });
    expect(mockSetCurrentFlowStep).toHaveBeenCalledWith(2); // "tgt" (pass), not the default fall-through
  });

  it("does not match a path when one AND condition fails", () => {
    mockGetAnswer.mockImplementation((_c, id) => (id === "q1" ? "yes" : undefined));
    flowState.producerCellId = "p1";
    flowState.scanResult = { sample: [{ phi2: 0.3 }] }; // fails the > 0.5 check
    flowState.cells = [
      qCell("q1"),
      pCell("p1", "proto-1"),
      branch(
        "b1",
        [
          path("pa", [cond("q1", "eq", "yes"), cond("p1", "gt", "0.5", "phi2")], "tgt"),
          path("pdef", []),
        ],
        "pdef",
      ),
    ];
    flowState.flowNodes = [
      branchFlowNode("b1"),
      measurementFlowNode("y", "proto-1"),
      plainFlowNode("tgt"),
    ];
    flowState.currentFlowStep = 0;

    evaluateAndRoute(branchFlowNode("b1"));

    expect(mockSetLastMatchedPath).toHaveBeenCalledWith({ label: "PDEF", color: "#abcdef" });
    expect(mockSetCurrentFlowStep).toHaveBeenCalledWith(1); // sequential fall-through
  });

  it("clears the chip and falls through when nothing matches and there is no default", () => {
    mockGetAnswer.mockReturnValue("no");
    flowState.cells = [qCell("q1"), branch("b1", [path("pa", [cond("q1", "eq", "yes")], "tgt")])];
    flowState.flowNodes = [branchFlowNode("b1"), plainFlowNode("y"), plainFlowNode("tgt")];
    flowState.currentFlowStep = 0;

    evaluateAndRoute(branchFlowNode("b1"));

    expect(mockSetLastMatchedPath).toHaveBeenCalledWith(undefined);
    expect(mockSetCurrentFlowStep).toHaveBeenCalledWith(1);
    expect(mockNextStep).not.toHaveBeenCalled();
  });

  it("stops looping once the visit cap is reached", () => {
    flowState.branchVisitCounts = { b1: MAX_BRANCH_VISITS };
    flowState.cells = [
      qCell("q1"),
      branch("b1", [path("pa", [cond("q1", "eq", "yes")], "tgt")], "pa"),
    ];
    flowState.flowNodes = [plainFlowNode("y"), branchFlowNode("b1")];
    flowState.currentFlowStep = 1; // branch is the last node

    evaluateAndRoute(branchFlowNode("b1"));

    expect(mockIncrementBranchVisit).not.toHaveBeenCalled();
    expect(mockSetLastMatchedPath).toHaveBeenCalledWith(undefined);
    expect(mockNextStep).toHaveBeenCalled(); // sequential at last index → wrap
  });

  it("caps a backward goto-loop at MAX_BRANCH_VISITS", () => {
    mockIncrementBranchVisit.mockImplementation((id: string) => {
      flowState.branchVisitCounts[id] = (flowState.branchVisitCounts[id] ?? 0) + 1;
    });
    mockGetAnswer.mockReturnValue("yes");
    // Matched path loops back to the earlier "loop" node (index 0).
    flowState.cells = [
      qCell("loop"),
      branch("b1", [path("pa", [cond("loop", "eq", "yes")], "loop")], "pdef"),
    ];
    flowState.flowNodes = [plainFlowNode("loop"), branchFlowNode("b1")];
    flowState.currentFlowStep = 1;

    for (let i = 0; i < MAX_BRANCH_VISITS + 5; i++) {
      evaluateAndRoute(branchFlowNode("b1"));
    }

    expect(mockSetCurrentFlowStep).toHaveBeenCalledWith(0);
    expect(mockSetCurrentFlowStep.mock.calls.length).toBe(MAX_BRANCH_VISITS);
    expect(mockNextStep).toHaveBeenCalled(); // overflow calls fall through at the last node
  });

  it("delegates to nextStep when a fall-through branch is the last node", () => {
    mockGetAnswer.mockReturnValue("no");
    flowState.cells = [
      qCell("q1"),
      branch("b1", [path("pa", [cond("q1", "eq", "yes")], "tgt"), path("pdef", [])], "pdef"),
    ];
    flowState.flowNodes = [plainFlowNode("tgt"), branchFlowNode("b1")];
    flowState.currentFlowStep = 1;

    evaluateAndRoute(branchFlowNode("b1"));

    expect(mockNextStep).toHaveBeenCalled();
    expect(mockSetCurrentFlowStep).not.toHaveBeenCalled();
  });

  it("no-ops when the branch is no longer the active node (stale/double invocation)", () => {
    flowState.cells = [branch("b1", [path("pa", [], "tgt")], "pa")];
    flowState.flowNodes = [plainFlowNode("other"), branchFlowNode("b1")];
    flowState.currentFlowStep = 0; // active node is "other"

    evaluateAndRoute(branchFlowNode("b1"));

    expect(mockIncrementBranchVisit).not.toHaveBeenCalled();
    expect(mockSetLastMatchedPath).not.toHaveBeenCalled();
    expect(mockSetCurrentFlowStep).not.toHaveBeenCalled();
    expect(mockNextStep).not.toHaveBeenCalled();
  });
});
