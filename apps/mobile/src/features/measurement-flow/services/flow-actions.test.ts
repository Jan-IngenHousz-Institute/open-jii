import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FlowNode } from "~/shared/measurements/flow-node";

import { advanceWithAnswer, teardownFlow } from "./flow-actions";

const mockSetAnswer = vi.fn();
const mockNextStep = vi.fn();
const mockSetCurrentFlowStep = vi.fn();
const mockReturnToOverview = vi.fn();
const mockResetFlow = vi.fn();
const mockClearHistory = vi.fn();
const mockSetSelectedExperimentId = vi.fn();

const mockFlowAnswersState = {
  setAnswer: mockSetAnswer,
  clearHistory: mockClearHistory,
  answersHistory: [] as Record<string, string>[],
  autoincrementSettings: {} as Record<string, boolean>,
  rememberAnswerSettings: {} as Record<string, boolean>,
};

const mockFlowStore = {
  iterationCount: 0,
  currentFlowStep: 0,
  nextStep: mockNextStep,
  flowNodes: [] as FlowNode[],
  setCurrentFlowStep: mockSetCurrentFlowStep,
  isFromOverview: false,
  returnToOverview: mockReturnToOverview,
  resetFlow: mockResetFlow,
};

vi.mock("~/features/measurement-flow/stores/use-flow-answers-store", () => ({
  useFlowAnswersStore: { getState: () => mockFlowAnswersState },
}));

vi.mock("~/features/measurement-flow/stores/use-measurement-flow-store", () => ({
  useMeasurementFlowStore: { getState: () => mockFlowStore },
}));

vi.mock("~/features/experiments/stores/use-experiment-selection-store", () => ({
  useExperimentSelectionStore: {
    getState: () => ({ setSelectedExperimentId: mockSetSelectedExperimentId }),
  },
}));

const makeQuestion = (id: string): FlowNode =>
  ({ id, type: "question", name: id, content: { kind: "text" } }) as FlowNode;

describe("advanceWithAnswer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFlowAnswersState.answersHistory = [];
    mockFlowAnswersState.autoincrementSettings = {};
    mockFlowAnswersState.rememberAnswerSettings = {};
    mockFlowStore.isFromOverview = false;
    mockFlowStore.flowNodes = [makeQuestion("q1"), makeQuestion("q2")];
    mockFlowStore.currentFlowStep = 0;
    mockFlowStore.iterationCount = 0;
  });

  it("moves to the next mandatory step", () => {
    advanceWithAnswer(makeQuestion("q1"), "yes");
    expect(mockSetCurrentFlowStep).toHaveBeenCalledWith(1);
  });

  it("calls nextStep when no mandatory steps remain", () => {
    mockFlowStore.flowNodes = [makeQuestion("q1")];
    advanceWithAnswer(makeQuestion("q1"), "yes");
    expect(mockNextStep).toHaveBeenCalled();
  });

  it("seeds remember-answer into the next iteration", () => {
    mockFlowAnswersState.rememberAnswerSettings = { q1: true };
    advanceWithAnswer(makeQuestion("q1"), "my answer");
    expect(mockSetAnswer).toHaveBeenCalledWith(1, "q1", "my answer");
  });

  it("seeds the next auto-increment option into the next iteration", () => {
    const node = {
      ...makeQuestion("q1"),
      content: { kind: "multi_choice", options: ["a", "b", "c"] },
    };
    mockFlowAnswersState.autoincrementSettings = { q1: true };
    advanceWithAnswer(node, "a");
    expect(mockSetAnswer).toHaveBeenCalledWith(1, "q1", "b");
  });

  it("wraps around auto-increment options", () => {
    const node = {
      ...makeQuestion("q1"),
      content: { kind: "multi_choice", options: ["a", "b", "c"] },
    };
    mockFlowAnswersState.autoincrementSettings = { q1: true };
    advanceWithAnswer(node, "c");
    expect(mockSetAnswer).toHaveBeenCalledWith(1, "q1", "a");
  });

  it("calls returnToOverview and skips normal advance when isFromOverview is true", () => {
    mockFlowStore.isFromOverview = true;
    advanceWithAnswer(makeQuestion("q1"), "yes");
    expect(mockReturnToOverview).toHaveBeenCalled();
    expect(mockSetCurrentFlowStep).not.toHaveBeenCalled();
    expect(mockNextStep).not.toHaveBeenCalled();
  });

  it("still seeds the answer before returning to overview", () => {
    mockFlowStore.isFromOverview = true;
    mockFlowAnswersState.rememberAnswerSettings = { q1: true };
    advanceWithAnswer(makeQuestion("q1"), "remembered");
    expect(mockSetAnswer).toHaveBeenCalledWith(1, "q1", "remembered");
    expect(mockReturnToOverview).toHaveBeenCalled();
  });
});

describe("teardownFlow", () => {
  it("resets the flow, the answer history, and the experiment selection", () => {
    vi.clearAllMocks();
    teardownFlow();
    expect(mockResetFlow).toHaveBeenCalled();
    expect(mockClearHistory).toHaveBeenCalled();
    expect(mockSetSelectedExperimentId).toHaveBeenCalledWith(undefined);
  });
});
