import { describe, it, expect, vi, beforeEach } from "vitest";
import { FlowNode } from "~/screens/measurement-flow-screen/types";

import { advanceWithAnswer, findNextMandatoryStep } from "./advance-with-answer";

const mockSetAnswer = vi.fn();
const mockNextStep = vi.fn();
const mockSetCurrentFlowStep = vi.fn();
const mockReturnToOverview = vi.fn();

const mockFlowAnswersState = {
  setAnswer: mockSetAnswer,
  isAutoincrementEnabled: vi.fn((_id: string) => false),
  isRememberAnswerEnabled: vi.fn((_id: string) => false),
  getAnswer: vi.fn((_iteration: number, _id: string): string | undefined => undefined),
};

const mockFlowStore = {
  iterationCount: 0,
  currentFlowStep: 0,
  nextStep: mockNextStep,
  flowNodes: [] as FlowNode[],
  setCurrentFlowStep: mockSetCurrentFlowStep,
  isFromOverview: false,
  returnToOverview: mockReturnToOverview,
};

vi.mock("~/stores/use-flow-answers-store", () => ({
  useFlowAnswersStore: { getState: () => mockFlowAnswersState },
}));

vi.mock("~/stores/use-measurement-flow-store", () => ({
  useMeasurementFlowStore: { getState: () => mockFlowStore },
}));

const makeQuestion = (id: string): FlowNode =>
  ({ id, type: "question", name: id, content: { kind: "text" } }) as FlowNode;

const makeInstruction = (id: string): FlowNode =>
  ({ id, type: "instruction", name: id, content: {} }) as FlowNode;

describe("findNextMandatoryStep", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFlowAnswersState.isAutoincrementEnabled.mockReturnValue(false);
    mockFlowAnswersState.isRememberAnswerEnabled.mockReturnValue(false);
    mockFlowAnswersState.getAnswer.mockReturnValue(undefined);
  });

  it("returns the next question index", () => {
    const nodes = [makeQuestion("q1"), makeQuestion("q2"), makeQuestion("q3")];
    expect(findNextMandatoryStep(0, nodes, 0)).toBe(1);
  });

  it("returns flowNodes.length when no mandatory step remains", () => {
    const nodes = [makeQuestion("q1")];
    expect(findNextMandatoryStep(0, nodes, 0)).toBe(1);
  });

  it("skips instructions on iterations > 0", () => {
    const nodes = [makeQuestion("q1"), makeInstruction("i1"), makeQuestion("q2")];
    expect(findNextMandatoryStep(0, nodes, 1)).toBe(2);
  });

  it("does not skip instructions on iteration 0", () => {
    const nodes = [makeQuestion("q1"), makeInstruction("i1"), makeQuestion("q2")];
    expect(findNextMandatoryStep(0, nodes, 0)).toBe(1);
  });

  it("skips questions with auto-increment enabled", () => {
    const nodes = [makeQuestion("q1"), makeQuestion("q2"), makeQuestion("q3")];
    mockFlowAnswersState.isAutoincrementEnabled.mockImplementation((id) => id === "q2");
    expect(findNextMandatoryStep(0, nodes, 0)).toBe(2);
  });

  it("skips questions with remember-answer enabled", () => {
    const nodes = [makeQuestion("q1"), makeQuestion("q2"), makeQuestion("q3")];
    mockFlowAnswersState.isRememberAnswerEnabled.mockImplementation((id) => id === "q2");
    expect(findNextMandatoryStep(0, nodes, 0)).toBe(2);
  });

  it("does not skip a required question with remember enabled when value is empty", () => {
    const nodes = [
      makeQuestion("q1"),
      { ...makeQuestion("q2"), content: { kind: "text", required: true } } as FlowNode,
      makeQuestion("q3"),
    ];
    mockFlowAnswersState.isRememberAnswerEnabled.mockImplementation((id) => id === "q2");
    mockFlowAnswersState.getAnswer.mockReturnValue(undefined);
    expect(findNextMandatoryStep(0, nodes, 0)).toBe(1);
  });

  it("skips a required question with remember enabled when it already has a value", () => {
    const nodes = [
      makeQuestion("q1"),
      { ...makeQuestion("q2"), content: { kind: "text", required: true } } as FlowNode,
      makeQuestion("q3"),
    ];
    mockFlowAnswersState.isRememberAnswerEnabled.mockImplementation((id) => id === "q2");
    mockFlowAnswersState.getAnswer.mockImplementation((_, id) =>
      id === "q2" ? "some value" : undefined,
    );
    expect(findNextMandatoryStep(0, nodes, 0)).toBe(2);
  });

  it("does not skip a required question with auto-increment enabled when value is empty", () => {
    const nodes = [
      makeQuestion("q1"),
      {
        ...makeQuestion("q2"),
        content: { kind: "multi_choice", required: true, options: ["a", "b"] },
      } as FlowNode,
      makeQuestion("q3"),
    ];
    mockFlowAnswersState.isAutoincrementEnabled.mockImplementation((id) => id === "q2");
    mockFlowAnswersState.getAnswer.mockReturnValue(undefined);
    expect(findNextMandatoryStep(0, nodes, 0)).toBe(1);
  });
});

describe("advanceWithAnswer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFlowAnswersState.isAutoincrementEnabled.mockReturnValue(false);
    mockFlowAnswersState.isRememberAnswerEnabled.mockReturnValue(false);
    mockFlowAnswersState.getAnswer.mockReturnValue(undefined);
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
    mockFlowAnswersState.isRememberAnswerEnabled.mockReturnValue(true);
    const node = makeQuestion("q1");
    advanceWithAnswer(node, "my answer");
    expect(mockSetAnswer).toHaveBeenCalledWith(1, "q1", "my answer");
  });

  it("seeds the next auto-increment option into the next iteration", () => {
    const node = {
      ...makeQuestion("q1"),
      content: { kind: "multi_choice", options: ["a", "b", "c"] },
    } as FlowNode;
    mockFlowAnswersState.isAutoincrementEnabled.mockReturnValue(true);
    advanceWithAnswer(node, "a");
    expect(mockSetAnswer).toHaveBeenCalledWith(1, "q1", "b");
  });

  it("wraps around auto-increment options", () => {
    const node = {
      ...makeQuestion("q1"),
      content: { kind: "multi_choice", options: ["a", "b", "c"] },
    } as FlowNode;
    mockFlowAnswersState.isAutoincrementEnabled.mockReturnValue(true);
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
    mockFlowAnswersState.isRememberAnswerEnabled.mockReturnValue(true);
    advanceWithAnswer(makeQuestion("q1"), "remembered");
    expect(mockSetAnswer).toHaveBeenCalledWith(1, "q1", "remembered");
    expect(mockReturnToOverview).toHaveBeenCalled();
  });
});
