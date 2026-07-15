import { beforeEach, describe, expect, it } from "vitest";
import type { FlowNode } from "~/shared/measurements/flow-node";

import { useMeasurementFlowStore } from "./use-measurement-flow-store";

const makeQuestion = (id: string): FlowNode =>
  ({ id, type: "question", name: id, content: { kind: "text" } }) as FlowNode;

const makeInstruction = (id: string): FlowNode =>
  ({ id, type: "instruction", name: id, content: {} }) as FlowNode;

const makeMeasurement = (id: string): FlowNode =>
  ({ id, type: "measurement", name: id, content: {} }) as FlowNode;

const makeAnalysis = (id: string): FlowNode =>
  ({ id, type: "analysis", name: id, content: {} }) as FlowNode;

const makeBranch = (id: string): FlowNode =>
  ({ id, type: "branch", name: id, content: {} }) as FlowNode;

/**
 * Reset the store to its initial state before each test.
 * Zustand stores persist across tests, so we must re-initialize.
 */
function resetStore() {
  useMeasurementFlowStore.setState({
    experimentId: undefined,
    currentStep: 0,
    flowNodes: [],
    currentFlowStep: 0,
    iterationCount: 0,
    isFlowFinished: false,
    isQuestionsSubmitPending: false,
    scanResults: undefined,
    scanResult: undefined,
    isFromOverview: false,
    cells: [],
    edges: [],
    lastMatchedPath: undefined,
    branchVisitCounts: {},
    branchReturnStack: [],
  });
}

describe("useMeasurementFlowStore", () => {
  beforeEach(() => {
    resetStore();
  });

  describe("initial state", () => {
    it("exposes the correct default values", () => {
      const state = useMeasurementFlowStore.getState();
      expect(state.experimentId).toBeUndefined();
      expect(state.currentStep).toBe(0);
      expect(state.flowNodes).toEqual([]);
      expect(state.currentFlowStep).toBe(0);
      expect(state.iterationCount).toBe(0);
      expect(state.isFlowFinished).toBe(false);
      expect(state.isQuestionsSubmitPending).toBe(false);
      expect(state.scanResult).toBeUndefined();
      expect(state.isFromOverview).toBe(false);
    });
  });

  describe("simple setters", () => {
    it("setExperimentId updates experimentId", () => {
      useMeasurementFlowStore.getState().setExperimentId("exp-1");
      expect(useMeasurementFlowStore.getState().experimentId).toBe("exp-1");
    });

    it("setCurrentStep updates currentStep", () => {
      useMeasurementFlowStore.getState().setCurrentStep(3);
      expect(useMeasurementFlowStore.getState().currentStep).toBe(3);
    });

    it("setCurrentFlowStep updates currentFlowStep", () => {
      useMeasurementFlowStore.getState().setCurrentFlowStep(2);
      expect(useMeasurementFlowStore.getState().currentFlowStep).toBe(2);
    });

    it("setScanResult updates scanResult", () => {
      const payload = { foo: "bar" };
      useMeasurementFlowStore.getState().setScanResult(payload);
      expect(useMeasurementFlowStore.getState().scanResult).toBe(payload);
    });

    it("setScanResults stores per-device results and mirrors the first into scanResult", () => {
      const device = { type: "usb", name: "MultispeQ A", id: "usb-a" } as const;
      const results = [
        { device, result: { from: "a" } },
        { device: { ...device, id: "usb-b", name: "MultispeQ B" }, result: { from: "b" } },
      ];
      useMeasurementFlowStore.getState().setScanResults(results);
      const state = useMeasurementFlowStore.getState();
      expect(state.scanResults).toBe(results);
      expect(state.scanResult).toEqual({ from: "a" });
    });

    it("setFlowNodes resets currentFlowStep to 0", () => {
      const nodes = [makeQuestion("q1"), makeQuestion("q2")];
      useMeasurementFlowStore.setState({ currentFlowStep: 5 });
      useMeasurementFlowStore.getState().setFlowNodes(nodes);
      const state = useMeasurementFlowStore.getState();
      expect(state.flowNodes).toEqual(nodes);
      expect(state.currentFlowStep).toBe(0);
    });
  });

  describe("nextStep", () => {
    it("returns to the measurement node when isFromOverview is true", () => {
      useMeasurementFlowStore.setState({
        experimentId: "exp-1",
        flowNodes: [makeQuestion("q1"), makeMeasurement("m1"), makeAnalysis("a1")],
        currentFlowStep: 0,
        isFromOverview: true,
      });
      useMeasurementFlowStore.getState().nextStep();
      const state = useMeasurementFlowStore.getState();
      expect(state.currentFlowStep).toBe(1);
      expect(state.isFromOverview).toBe(false);
    });

    it("advances to the next flow step", () => {
      useMeasurementFlowStore.setState({
        experimentId: "exp-1",
        flowNodes: [makeQuestion("q1"), makeQuestion("q2"), makeQuestion("q3")],
        currentFlowStep: 0,
      });
      useMeasurementFlowStore.getState().nextStep();
      expect(useMeasurementFlowStore.getState().currentFlowStep).toBe(1);
    });

    it("starts a new iteration when the flow completes (non-questions-only)", () => {
      useMeasurementFlowStore.setState({
        experimentId: "exp-1",
        flowNodes: [makeQuestion("q1"), makeMeasurement("m1")],
        currentFlowStep: 1,
        iterationCount: 0,
      });
      useMeasurementFlowStore.getState().nextStep();
      const state = useMeasurementFlowStore.getState();
      expect(state.currentFlowStep).toBe(0);
      expect(state.iterationCount).toBe(1);
    });

    it("pauses for review when the questions-only flow completes", () => {
      const flowNodes = [makeQuestion("q1"), makeQuestion("q2")];
      useMeasurementFlowStore.setState({
        experimentId: "exp-1",
        flowNodes,
        currentFlowStep: 1,
        iterationCount: 0,
      });
      useMeasurementFlowStore.getState().nextStep();
      const state = useMeasurementFlowStore.getState();
      expect(state.isQuestionsSubmitPending).toBe(true);
      expect(state.currentFlowStep).toBe(flowNodes.length);
    });

    it("pauses for review when a questions+branch flow completes (no data to upload)", () => {
      const flowNodes = [makeQuestion("q1"), makeBranch("b1"), makeQuestion("q2")];
      useMeasurementFlowStore.setState({
        experimentId: "exp-1",
        flowNodes,
        currentFlowStep: 2,
        iterationCount: 0,
      });
      useMeasurementFlowStore.getState().nextStep();
      const state = useMeasurementFlowStore.getState();
      expect(state.isQuestionsSubmitPending).toBe(true);
      expect(state.currentFlowStep).toBe(flowNodes.length);
    });

    it("increments currentStep when no experiment is selected", () => {
      useMeasurementFlowStore.setState({ currentStep: 2 });
      useMeasurementFlowStore.getState().nextStep();
      expect(useMeasurementFlowStore.getState().currentStep).toBe(3);
    });

    it("increments currentStep when flow has no nodes", () => {
      useMeasurementFlowStore.setState({
        experimentId: "exp-1",
        flowNodes: [],
        currentStep: 2,
      });
      useMeasurementFlowStore.getState().nextStep();
      expect(useMeasurementFlowStore.getState().currentStep).toBe(3);
    });
  });

  describe("previousStep", () => {
    it("returns to the measurement node when isFromOverview is true", () => {
      useMeasurementFlowStore.setState({
        experimentId: "exp-1",
        flowNodes: [makeQuestion("q1"), makeMeasurement("m1")],
        currentFlowStep: 0,
        isFromOverview: true,
      });
      useMeasurementFlowStore.getState().previousStep();
      const state = useMeasurementFlowStore.getState();
      expect(state.currentFlowStep).toBe(1);
      expect(state.isFromOverview).toBe(false);
    });

    it("goes back to the last question from the submit/review screen", () => {
      const flowNodes = [makeQuestion("q1"), makeQuestion("q2")];
      useMeasurementFlowStore.setState({
        experimentId: "exp-1",
        flowNodes,
        isQuestionsSubmitPending: true,
      });
      useMeasurementFlowStore.getState().previousStep();
      const state = useMeasurementFlowStore.getState();
      expect(state.isQuestionsSubmitPending).toBe(false);
      expect(state.currentFlowStep).toBe(flowNodes.length - 1);
    });

    it("goes back within the flow when currentFlowStep > 0", () => {
      useMeasurementFlowStore.setState({
        experimentId: "exp-1",
        flowNodes: [makeQuestion("q1"), makeQuestion("q2")],
        currentFlowStep: 1,
      });
      useMeasurementFlowStore.getState().previousStep();
      expect(useMeasurementFlowStore.getState().currentFlowStep).toBe(0);
    });

    it("resets to experiment selection when at first step", () => {
      useMeasurementFlowStore.setState({
        experimentId: "exp-1",
        flowNodes: [makeQuestion("q1")],
        currentFlowStep: 0,
        iterationCount: 3,
      });
      useMeasurementFlowStore.getState().previousStep();
      const state = useMeasurementFlowStore.getState();
      expect(state.experimentId).toBeUndefined();
      expect(state.flowNodes).toEqual([]);
      expect(state.currentFlowStep).toBe(0);
      expect(state.iterationCount).toBe(0);
      expect(state.isFlowFinished).toBe(false);
      expect(state.isQuestionsSubmitPending).toBe(false);
      expect(state.scanResult).toBeUndefined();
      expect(state.scanResults).toBeUndefined();
      expect(state.scanResult).toBeUndefined();
    });

    it("decrements currentStep when no experiment is selected", () => {
      useMeasurementFlowStore.setState({ currentStep: 2 });
      useMeasurementFlowStore.getState().previousStep();
      expect(useMeasurementFlowStore.getState().currentStep).toBe(1);
    });

    it("clamps currentStep at 0 when no experiment is selected", () => {
      useMeasurementFlowStore.setState({ currentStep: 0 });
      useMeasurementFlowStore.getState().previousStep();
      expect(useMeasurementFlowStore.getState().currentStep).toBe(0);
    });
  });

  describe("reset", () => {
    it("clears experimentId, currentStep and isFromOverview", () => {
      useMeasurementFlowStore.setState({
        experimentId: "exp-1",
        currentStep: 5,
        isFromOverview: true,
      });
      useMeasurementFlowStore.getState().reset();
      const state = useMeasurementFlowStore.getState();
      expect(state.experimentId).toBeUndefined();
      expect(state.currentStep).toBe(0);
      expect(state.isFromOverview).toBe(false);
    });
  });

  describe("resetFlow", () => {
    it("fully resets the flow state", () => {
      useMeasurementFlowStore.setState({
        experimentId: "exp-1",
        currentStep: 2,
        flowNodes: [makeQuestion("q1")],
        currentFlowStep: 3,
        iterationCount: 2,
        isFlowFinished: true,
        isQuestionsSubmitPending: true,
        scanResults: [{ result: { foo: "bar" } }],
        scanResult: { foo: "bar" },
        isFromOverview: true,
      });
      useMeasurementFlowStore.getState().resetFlow();
      const state = useMeasurementFlowStore.getState();
      expect(state.experimentId).toBeUndefined();
      expect(state.currentStep).toBe(0);
      expect(state.flowNodes).toEqual([]);
      expect(state.currentFlowStep).toBe(0);
      expect(state.iterationCount).toBe(0);
      expect(state.isFlowFinished).toBe(false);
      expect(state.isQuestionsSubmitPending).toBe(false);
      expect(state.scanResult).toBeUndefined();
      expect(state.scanResults).toBeUndefined();
      expect(state.scanResult).toBeUndefined();
      expect(state.isFromOverview).toBe(false);
    });
  });

  describe("retryCurrentIteration", () => {
    it("resets iteration-scoped state without incrementing iterationCount", () => {
      useMeasurementFlowStore.setState({
        currentFlowStep: 3,
        iterationCount: 2,
        isQuestionsSubmitPending: true,
        scanResults: [{ result: { foo: "bar" } }],
        scanResult: { foo: "bar" },
        isFromOverview: true,
      });
      useMeasurementFlowStore.getState().retryCurrentIteration();
      const state = useMeasurementFlowStore.getState();
      expect(state.currentFlowStep).toBe(0);
      expect(state.iterationCount).toBe(2);
      expect(state.isQuestionsSubmitPending).toBe(false);
      expect(state.scanResult).toBeUndefined();
      expect(state.scanResults).toBeUndefined();
      expect(state.scanResult).toBeUndefined();
      expect(state.isFromOverview).toBe(false);
    });
  });

  describe("finishFlow", () => {
    it("marks the flow as finished and parks the step after the last node", () => {
      const flowNodes = [makeQuestion("q1"), makeQuestion("q2"), makeQuestion("q3")];
      useMeasurementFlowStore.setState({
        flowNodes,
        isQuestionsSubmitPending: true,
        isFromOverview: true,
      });
      useMeasurementFlowStore.getState().finishFlow();
      const state = useMeasurementFlowStore.getState();
      expect(state.currentFlowStep).toBe(flowNodes.length);
      expect(state.isFlowFinished).toBe(true);
      expect(state.isQuestionsSubmitPending).toBe(false);
      expect(state.isFromOverview).toBe(false);
    });
  });

  describe("dismissQuestionsSubmit", () => {
    it("clears the submit-pending flag, resets the flow step and increments iterationCount", () => {
      useMeasurementFlowStore.setState({
        currentFlowStep: 5,
        iterationCount: 1,
        isQuestionsSubmitPending: true,
        scanResults: [{ result: { foo: "bar" } }],
        scanResult: { foo: "bar" },
      });
      useMeasurementFlowStore.getState().dismissQuestionsSubmit();
      const state = useMeasurementFlowStore.getState();
      expect(state.isQuestionsSubmitPending).toBe(false);
      expect(state.currentFlowStep).toBe(0);
      expect(state.iterationCount).toBe(2);
      expect(state.scanResult).toBeUndefined();
      expect(state.scanResults).toBeUndefined();
      expect(state.scanResult).toBeUndefined();
    });
  });

  describe("navigateToQuestionFromOverview", () => {
    it("jumps to the question and marks isFromOverview", () => {
      useMeasurementFlowStore.setState({
        isQuestionsSubmitPending: true,
      });
      useMeasurementFlowStore.getState().navigateToQuestionFromOverview(2);
      const state = useMeasurementFlowStore.getState();
      expect(state.currentFlowStep).toBe(2);
      expect(state.isFromOverview).toBe(true);
      expect(state.isQuestionsSubmitPending).toBe(false);
    });
  });

  describe("returnToOverview", () => {
    it("returns to the measurement node in a normal flow", () => {
      useMeasurementFlowStore.setState({
        flowNodes: [makeQuestion("q1"), makeMeasurement("m1"), makeAnalysis("a1")],
        currentFlowStep: 0,
        isFromOverview: true,
      });
      useMeasurementFlowStore.getState().returnToOverview();
      const state = useMeasurementFlowStore.getState();
      expect(state.currentFlowStep).toBe(1);
      expect(state.isFromOverview).toBe(false);
      expect(state.isQuestionsSubmitPending).toBe(false);
    });

    it("returns to the submit/review screen in a questions-only flow (questions + instructions)", () => {
      useMeasurementFlowStore.setState({
        flowNodes: [makeQuestion("q1"), makeQuestion("q2"), makeInstruction("i1")],
        currentFlowStep: 0,
        isFromOverview: true,
      });
      useMeasurementFlowStore.getState().returnToOverview();
      const state = useMeasurementFlowStore.getState();
      expect(state.isQuestionsSubmitPending).toBe(true);
      expect(state.isFromOverview).toBe(false);
    });

    it("returns to the submit/review screen when the flow is questions-only (no instructions)", () => {
      useMeasurementFlowStore.setState({
        flowNodes: [makeQuestion("q1"), makeQuestion("q2")],
        currentFlowStep: 0,
        isFromOverview: true,
      });
      useMeasurementFlowStore.getState().returnToOverview();
      expect(useMeasurementFlowStore.getState().isQuestionsSubmitPending).toBe(true);
    });
  });

  describe("branch state", () => {
    it("setFlowGraph sets nodes/edges/cells and resets branch + step state", () => {
      useMeasurementFlowStore.setState({
        currentFlowStep: 5,
        branchVisitCounts: { b1: 3 },
        lastMatchedPath: { label: "old", color: "#000" },
        branchReturnStack: [{ landing: 5, step: 2 }],
      });
      const nodes = [makeQuestion("q1")];
      const edges = [{ id: "e1", source: "q1", target: "q2" }];
      const cells = [
        {
          id: "q1",
          type: "question",
          isCollapsed: false,
          name: "q1",
          question: { kind: "number", text: "q1", required: false },
          isAnswered: false,
        },
      ] as never;

      useMeasurementFlowStore.getState().setFlowGraph(nodes, edges, cells);

      const state = useMeasurementFlowStore.getState();
      expect(state.flowNodes).toEqual(nodes);
      expect(state.edges).toEqual(edges);
      expect(state.cells).toEqual(cells);
      expect(state.currentFlowStep).toBe(0);
      expect(state.branchVisitCounts).toEqual({});
      expect(state.lastMatchedPath).toBeUndefined();
      expect(state.branchReturnStack).toEqual([]);
    });

    it("incrementBranchVisit accumulates per node id", () => {
      const { incrementBranchVisit } = useMeasurementFlowStore.getState();
      incrementBranchVisit("b1");
      incrementBranchVisit("b1");
      incrementBranchVisit("b2");
      expect(useMeasurementFlowStore.getState().branchVisitCounts).toEqual({ b1: 2, b2: 1 });
    });

    it("setLastMatchedPath sets and clears the chip", () => {
      useMeasurementFlowStore.getState().setLastMatchedPath({ label: "A", color: "#f00" });
      expect(useMeasurementFlowStore.getState().lastMatchedPath).toEqual({
        label: "A",
        color: "#f00",
      });
      useMeasurementFlowStore.getState().setLastMatchedPath(undefined);
      expect(useMeasurementFlowStore.getState().lastMatchedPath).toBeUndefined();
    });

    it("setFlowNodes clears branch state (legacy path)", () => {
      useMeasurementFlowStore.setState({
        cells: [{ id: "x" }] as never,
        edges: [{ id: "e1", source: "x", target: "y" }],
        branchVisitCounts: { b1: 1 },
        lastMatchedPath: { label: "x", color: "#000" },
        branchReturnStack: [{ landing: 4, step: 1 }],
      });
      useMeasurementFlowStore.getState().setFlowNodes([makeQuestion("q1")]);
      const state = useMeasurementFlowStore.getState();
      expect(state.cells).toEqual([]);
      expect(state.edges).toEqual([]);
      expect(state.branchVisitCounts).toEqual({});
      expect(state.lastMatchedPath).toBeUndefined();
      expect(state.branchReturnStack).toEqual([]);
    });

    it.each([
      "startNewIteration",
      "retryCurrentIteration",
      "resetFlow",
      "dismissQuestionsSubmit",
    ] as const)("%s clears branch visit counts, matched path and return stack", (action) => {
      useMeasurementFlowStore.setState({
        branchVisitCounts: { b1: 4 },
        lastMatchedPath: { label: "x", color: "#000" },
        branchReturnStack: [{ landing: 3, step: 0 }],
      });
      useMeasurementFlowStore.getState()[action]();
      const state = useMeasurementFlowStore.getState();
      expect(state.branchVisitCounts).toEqual({});
      expect(state.lastMatchedPath).toBeUndefined();
      expect(state.branchReturnStack).toEqual([]);
    });

    it("nextStep clears branch state when an iteration wraps", () => {
      useMeasurementFlowStore.setState({
        experimentId: "exp-1",
        flowNodes: [makeQuestion("q1"), makeMeasurement("m1")],
        currentFlowStep: 1,
        branchVisitCounts: { b1: 2 },
        lastMatchedPath: { label: "x", color: "#000" },
        branchReturnStack: [{ landing: 1, step: 0 }],
      });
      useMeasurementFlowStore.getState().nextStep();
      const state = useMeasurementFlowStore.getState();
      expect(state.currentFlowStep).toBe(0);
      expect(state.iterationCount).toBe(1);
      expect(state.branchVisitCounts).toEqual({});
      expect(state.lastMatchedPath).toBeUndefined();
      expect(state.branchReturnStack).toEqual([]);
    });
  });

  describe("branch back navigation", () => {
    it("recordBranchJump pushes the step before a sequentially-reached branch", () => {
      // User was on q1 (index 1) before the branch at index 2 jumped to 5.
      useMeasurementFlowStore.setState({ currentFlowStep: 2 });
      useMeasurementFlowStore.getState().recordBranchJump(5);
      expect(useMeasurementFlowStore.getState().branchReturnStack).toEqual([
        { landing: 5, step: 1 },
      ]);
    });

    it("recordBranchJump inherits the return target for a chained branch", () => {
      // Branch at 2 jumped to branch at 5 (return step 1); 5 then jumps to 8.
      useMeasurementFlowStore.setState({
        currentFlowStep: 5,
        branchReturnStack: [{ landing: 5, step: 1 }],
      });
      useMeasurementFlowStore.getState().recordBranchJump(8);
      expect(useMeasurementFlowStore.getState().branchReturnStack).toEqual([
        { landing: 8, step: 1 },
      ]);
    });

    it("previousStep unwinds a branch jump instead of stepping into a skipped node", () => {
      useMeasurementFlowStore.setState({
        experimentId: "exp-1",
        flowNodes: [makeQuestion("q1"), makeBranch("b1"), makeQuestion("q2"), makeQuestion("q3")],
        currentFlowStep: 3,
        branchReturnStack: [{ landing: 3, step: 0 }],
      });
      useMeasurementFlowStore.getState().previousStep();
      const state = useMeasurementFlowStore.getState();
      expect(state.currentFlowStep).toBe(0);
      expect(state.branchReturnStack).toEqual([]);
    });

    it("previousStep steps linearly when the current node is not a branch landing", () => {
      useMeasurementFlowStore.setState({
        experimentId: "exp-1",
        flowNodes: [makeQuestion("q1"), makeBranch("b1"), makeQuestion("q2"), makeQuestion("q3")],
        currentFlowStep: 3,
        // Landing was index 2; the user has since advanced to 3.
        branchReturnStack: [{ landing: 2, step: 0 }],
      });
      useMeasurementFlowStore.getState().previousStep();
      const state = useMeasurementFlowStore.getState();
      expect(state.currentFlowStep).toBe(2);
      expect(state.branchReturnStack).toEqual([{ landing: 2, step: 0 }]);
    });

    it("exits the flow when a branch jumped from before the flow start", () => {
      useMeasurementFlowStore.setState({
        experimentId: "exp-1",
        flowNodes: [makeBranch("b1"), makeQuestion("q1"), makeQuestion("q2")],
        currentFlowStep: 2,
        branchReturnStack: [{ landing: 2, step: -1 }],
      });
      useMeasurementFlowStore.getState().previousStep();
      const state = useMeasurementFlowStore.getState();
      expect(state.experimentId).toBeUndefined();
      expect(state.flowNodes).toEqual([]);
      expect(state.branchReturnStack).toEqual([]);
    });

    it("steps linearly back from a loop-back target when no return was recorded", () => {
      useMeasurementFlowStore.setState({
        experimentId: "exp-1",
        flowNodes: [makeQuestion("q1"), makeMeasurement("m1"), makeBranch("b1")],
        currentFlowStep: 1, // looped back here; no branchReturnStack entry
        branchReturnStack: [],
      });
      useMeasurementFlowStore.getState().previousStep();
      expect(useMeasurementFlowStore.getState().currentFlowStep).toBe(0);
    });
  });
});
