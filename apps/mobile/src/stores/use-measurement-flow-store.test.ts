import { beforeEach, describe, expect, it } from "vitest";
import type { FlowNode } from "~/screens/measurement-flow-screen/types";

import { useMeasurementFlowStore } from "./use-measurement-flow-store";

const makeQuestion = (id: string): FlowNode =>
  ({ id, type: "question", name: id, content: { kind: "text" } }) as FlowNode;

const makeInstruction = (id: string): FlowNode =>
  ({ id, type: "instruction", name: id, content: {} }) as FlowNode;

const makeMeasurement = (id: string): FlowNode =>
  ({ id, type: "measurement", name: id, content: {} }) as FlowNode;

const makeAnalysis = (id: string): FlowNode =>
  ({ id, type: "analysis", name: id, content: {} }) as FlowNode;

/**
 * Reset the store to its initial state before each test.
 * Zustand stores persist across tests, so we must re-initialize.
 */
function resetStore() {
  useMeasurementFlowStore.setState({
    experimentId: undefined,
    protocolId: undefined,
    currentStep: 0,
    flowNodes: [],
    currentFlowStep: 0,
    iterationCount: 0,
    isFlowFinished: false,
    isQuestionsSubmitPending: false,
    scanResult: undefined,
    isFromOverview: false,
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
      expect(state.protocolId).toBeUndefined();
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

    it("setProtocolId updates protocolId", () => {
      useMeasurementFlowStore.getState().setProtocolId("proto-1");
      expect(useMeasurementFlowStore.getState().protocolId).toBe("proto-1");
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
        protocolId: "p-1",
        flowNodes: [makeQuestion("q1")],
        currentFlowStep: 0,
        iterationCount: 3,
      });
      useMeasurementFlowStore.getState().previousStep();
      const state = useMeasurementFlowStore.getState();
      expect(state.experimentId).toBeUndefined();
      expect(state.protocolId).toBeUndefined();
      expect(state.flowNodes).toEqual([]);
      expect(state.currentFlowStep).toBe(0);
      expect(state.iterationCount).toBe(0);
      expect(state.isFlowFinished).toBe(false);
      expect(state.isQuestionsSubmitPending).toBe(false);
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
    it("clears experimentId, protocolId, currentStep and isFromOverview", () => {
      useMeasurementFlowStore.setState({
        experimentId: "exp-1",
        protocolId: "p-1",
        currentStep: 5,
        isFromOverview: true,
      });
      useMeasurementFlowStore.getState().reset();
      const state = useMeasurementFlowStore.getState();
      expect(state.experimentId).toBeUndefined();
      expect(state.protocolId).toBeUndefined();
      expect(state.currentStep).toBe(0);
      expect(state.isFromOverview).toBe(false);
    });
  });

  describe("resetFlow", () => {
    it("fully resets the flow state", () => {
      useMeasurementFlowStore.setState({
        experimentId: "exp-1",
        protocolId: "p-1",
        currentStep: 2,
        flowNodes: [makeQuestion("q1")],
        currentFlowStep: 3,
        iterationCount: 2,
        isFlowFinished: true,
        isQuestionsSubmitPending: true,
        scanResult: { foo: "bar" },
        isFromOverview: true,
      });
      useMeasurementFlowStore.getState().resetFlow();
      const state = useMeasurementFlowStore.getState();
      expect(state.experimentId).toBeUndefined();
      expect(state.protocolId).toBeUndefined();
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

  describe("startNewIteration", () => {
    it("increments iterationCount and resets iteration-scoped state", () => {
      useMeasurementFlowStore.setState({
        currentFlowStep: 3,
        iterationCount: 1,
        isQuestionsSubmitPending: true,
        scanResult: { foo: "bar" },
        isFromOverview: true,
      });
      useMeasurementFlowStore.getState().startNewIteration();
      const state = useMeasurementFlowStore.getState();
      expect(state.currentFlowStep).toBe(0);
      expect(state.iterationCount).toBe(2);
      expect(state.isQuestionsSubmitPending).toBe(false);
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
        scanResult: { foo: "bar" },
        isFromOverview: true,
      });
      useMeasurementFlowStore.getState().retryCurrentIteration();
      const state = useMeasurementFlowStore.getState();
      expect(state.currentFlowStep).toBe(0);
      expect(state.iterationCount).toBe(2);
      expect(state.isQuestionsSubmitPending).toBe(false);
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
        scanResult: { foo: "bar" },
      });
      useMeasurementFlowStore.getState().dismissQuestionsSubmit();
      const state = useMeasurementFlowStore.getState();
      expect(state.isQuestionsSubmitPending).toBe(false);
      expect(state.currentFlowStep).toBe(0);
      expect(state.iterationCount).toBe(2);
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
});
