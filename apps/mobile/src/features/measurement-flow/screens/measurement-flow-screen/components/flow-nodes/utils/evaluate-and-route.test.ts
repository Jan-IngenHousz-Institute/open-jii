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
} from "@repo/api/domains/workbook/workbook-cells.schema";

import { evaluateAndRoute, MAX_BRANCH_VISITS } from "./evaluate-and-route";

const mockSetCurrentFlowStep = vi.fn();
const mockNextStep = vi.fn();
const mockSetLastMatchedPath = vi.fn();
const mockIncrementBranchVisit = vi.fn();
const mockRecordBranchJump = vi.fn();
const mockSetDevicePlan = vi.fn();
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
  setDevicePlan: typeof mockSetDevicePlan;
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
  setDevicePlan: mockSetDevicePlan,
};

vi.mock("~/features/measurement-flow/stores/use-measurement-flow-store", () => ({
  useMeasurementFlowStore: { getState: () => flowState },
}));
vi.mock("~/features/measurement-flow/stores/use-flow-answers-store", () => ({
  useFlowAnswersStore: { getState: () => ({ getAnswer: mockGetAnswer }) },
}));

// Primary-device registry backing the $device branch source.
const scannerState: { executors: Map<string, unknown> } = { executors: new Map() };
vi.mock("~/features/connection/stores/use-scanner-command-executor-store", () => ({
  useScannerCommandExecutorStore: { getState: () => scannerState },
}));

function connectDevice(id: string, name: string, identity?: Record<string, unknown>) {
  scannerState.executors.set(id, {
    device: { type: "usb", name, id },
    identity,
  });
}

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
  scannerState.executors = new Map();
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

  it.each([
    ["an empty sample envelope", { sample: [] }],
    ["an empty top-level array", []],
  ])("stops routing on %s instead of taking a dependent or default path", (_label, raw) => {
    flowState.producerCellId = "p1";
    flowState.scanResult = raw;
    flowState.cells = [
      pCell("p1", "proto-1"),
      branch(
        "b1",
        [path("dependent", [cond("p1", "gt", "0.5", "phi2")], "tgt"), path("pdef", [])],
        "pdef",
      ),
    ];
    flowState.flowNodes = [branchFlowNode("b1"), plainFlowNode("default"), plainFlowNode("tgt")];
    flowState.currentFlowStep = 0;

    const error = evaluateAndRoute(branchFlowNode("b1"));

    expect(error).toMatchObject({
      name: "OutputDataNormalizationError",
      code: "empty-envelope",
    });
    expect(mockSetLastMatchedPath).toHaveBeenCalledWith(undefined);
    expect(mockSetDevicePlan).toHaveBeenCalledWith(undefined, []);
    expect(mockSetCurrentFlowStep).not.toHaveBeenCalled();
    expect(mockRecordBranchJump).not.toHaveBeenCalled();
    expect(mockNextStep).not.toHaveBeenCalled();
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

describe("$device branch = dispatcher", () => {
  // Family-split fixture: multispeq devices go to protocol "pm", ambit
  // devices to protocol "pa"; both targets ride measurement flow nodes.
  const familyBranch = () =>
    branch(
      "b1",
      [
        path("pms", [cond("$device", "eq", "multispeq", "family")], "pm"),
        path("pam", [cond("$device", "eq", "ambit", "family")], "pa"),
      ],
      undefined,
    );
  const familyFixture = () => {
    flowState.cells = [familyBranch(), pCell("pm", "proto-m"), pCell("pa", "proto-a")];
    flowState.flowNodes = [
      branchFlowNode("b1"),
      measurementFlowNode("pm", "proto-m"),
      measurementFlowNode("pa", "proto-a"),
      plainFlowNode("after"),
    ];
    flowState.currentFlowStep = 0;
  };

  it("builds a per-device plan and routes to the earliest target, consuming the rest", () => {
    connectDevice("usb-1", "MultispeQ A", { family: "multispeq", deviceId: "aa", raw: {} });
    connectDevice("usb-2", "Ambit B", { family: "ambit", deviceId: "bb", raw: {} });
    familyFixture();

    evaluateAndRoute(branchFlowNode("b1"));

    expect(mockSetDevicePlan).toHaveBeenCalledWith(
      [
        { deviceId: "usb-1", targetCellId: "pm" },
        { deviceId: "usb-2", targetCellId: "pa" },
      ],
      ["pa"],
    );
    // A dispatcher matches several paths at once: no single ACTIVE chip.
    expect(mockSetLastMatchedPath).toHaveBeenCalledWith(undefined);
    expect(mockRecordBranchJump).toHaveBeenCalledWith(1);
    expect(mockSetCurrentFlowStep).toHaveBeenCalledWith(1); // earliest target "pm"
  });

  it("groups devices on the same path onto one target with nothing consumed", () => {
    connectDevice("usb-1", "MultispeQ A", { family: "multispeq", deviceId: "aa", raw: {} });
    connectDevice("usb-2", "MultispeQ B", { family: "multispeq", deviceId: "bb", raw: {} });
    familyFixture();

    evaluateAndRoute(branchFlowNode("b1"));

    expect(mockSetDevicePlan).toHaveBeenCalledWith(
      [
        { deviceId: "usb-1", targetCellId: "pm" },
        { deviceId: "usb-2", targetCellId: "pm" },
      ],
      [],
    );
    expect(mockSetCurrentFlowStep).toHaveBeenCalledWith(1);
  });

  it("skips a device matching no path; the rest still dispatch", () => {
    connectDevice("usb-1", "Ambit A", { family: "ambit", deviceId: "aa", raw: {} });
    connectDevice("usb-2", "Mystery", { family: "ambyte", deviceId: "bb", raw: {} });
    familyFixture();

    evaluateAndRoute(branchFlowNode("b1"));

    expect(mockSetDevicePlan).toHaveBeenCalledWith([{ deviceId: "usb-1", targetCellId: "pa" }], []);
    expect(mockSetCurrentFlowStep).toHaveBeenCalledWith(2); // "pa" is the only target
  });

  it("falls back to family multispeq while the identity handshake is pending", () => {
    connectDevice("usb-1", "MultispeQ A", undefined);
    familyFixture();

    evaluateAndRoute(branchFlowNode("b1"));

    expect(mockSetDevicePlan).toHaveBeenCalledWith([{ deviceId: "usb-1", targetCellId: "pm" }], []);
    expect(mockSetCurrentFlowStep).toHaveBeenCalledWith(1);
  });

  it("clears the plan and falls through sequentially when no device matches", () => {
    connectDevice("usb-1", "Mystery", { family: "ambyte", deviceId: "aa", raw: {} });
    familyFixture();

    evaluateAndRoute(branchFlowNode("b1"));

    expect(mockSetDevicePlan).toHaveBeenCalledWith(undefined, []);
    expect(mockRecordBranchJump).toHaveBeenCalledWith(1);
    expect(mockSetCurrentFlowStep).toHaveBeenCalledWith(1); // sequential, not a dispatch jump
  });

  it("clears the plan and falls through when no device is connected", () => {
    familyFixture();

    evaluateAndRoute(branchFlowNode("b1"));

    expect(mockSetDevicePlan).toHaveBeenCalledWith(undefined, []);
    expect(mockSetLastMatchedPath).toHaveBeenCalledWith(undefined);
    expect(mockSetCurrentFlowStep).toHaveBeenCalledWith(1);
  });

  it("skips a device whose matched path targets a non-measurement cell", () => {
    connectDevice("usb-1", "MultispeQ A", { family: "multispeq", deviceId: "aa", raw: {} });
    flowState.cells = [
      qCell("q1"),
      branch("b1", [path("pms", [cond("$device", "eq", "multispeq", "family")], "q1")], undefined),
    ];
    flowState.flowNodes = [plainFlowNode("q1"), branchFlowNode("b1"), plainFlowNode("after")];
    flowState.currentFlowStep = 1;

    evaluateAndRoute(branchFlowNode("b1"));

    expect(mockSetDevicePlan).toHaveBeenCalledWith(undefined, []);
    expect(mockSetCurrentFlowStep).toHaveBeenCalledWith(2);
  });

  it("dispatches command-cell targets too", () => {
    connectDevice("usb-1", "MultispeQ A", { family: "multispeq", deviceId: "aa", raw: {} });
    flowState.cells = [
      branch(
        "b1",
        [path("pms", [cond("$device", "eq", "multispeq", "family")], "cmd1")],
        undefined,
      ),
      cCell("cmd1"),
    ];
    flowState.flowNodes = [
      branchFlowNode("b1"),
      measurementFlowNode("cmd1", ""),
      plainFlowNode("after"),
    ];
    flowState.currentFlowStep = 0;

    evaluateAndRoute(branchFlowNode("b1"));

    expect(mockSetDevicePlan).toHaveBeenCalledWith(
      [{ deviceId: "usb-1", targetCellId: "cmd1" }],
      [],
    );
    expect(mockSetCurrentFlowStep).toHaveBeenCalledWith(1);
  });

  it("stops device dispatch when a dependent measurement envelope is empty", () => {
    connectDevice("usb-1", "MultispeQ A", {
      family: "multispeq",
      deviceId: "aa",
      raw: {},
    });
    flowState.producerCellId = "p1";
    flowState.scanResult = { sample: [] };
    flowState.cells = [
      pCell("p1", "proto-source"),
      branch(
        "b1",
        [
          path(
            "dependent",
            [cond("$device", "eq", "multispeq", "family"), cond("p1", "gt", "0.5", "phi2")],
            "pm",
          ),
        ],
        undefined,
      ),
      pCell("pm", "proto-target"),
    ];
    flowState.flowNodes = [branchFlowNode("b1"), measurementFlowNode("pm", "proto-target")];
    flowState.currentFlowStep = 0;

    const error = evaluateAndRoute(branchFlowNode("b1"));

    expect(error).toMatchObject({
      name: "OutputDataNormalizationError",
      code: "empty-envelope",
    });
    expect(mockSetDevicePlan).toHaveBeenCalledWith(undefined, []);
    expect(mockSetCurrentFlowStep).not.toHaveBeenCalled();
    expect(mockRecordBranchJump).not.toHaveBeenCalled();
  });

  it("leaves non-device branches untouched (no plan writes)", () => {
    mockGetAnswer.mockImplementation((_c, id) => (id === "q1" ? "yes" : undefined));
    flowState.cells = [
      qCell("q1"),
      branch("b1", [path("pa", [cond("q1", "eq", "yes")], "tgt"), path("pdef", [])], "pdef"),
    ];
    flowState.flowNodes = [branchFlowNode("b1"), plainFlowNode("y"), plainFlowNode("tgt")];
    flowState.currentFlowStep = 0;

    evaluateAndRoute(branchFlowNode("b1"));

    expect(mockSetDevicePlan).not.toHaveBeenCalled();
    expect(mockSetCurrentFlowStep).toHaveBeenCalledWith(2);
  });
});
