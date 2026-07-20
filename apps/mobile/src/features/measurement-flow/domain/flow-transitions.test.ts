import { describe, expect, it } from "vitest";
import type { FlowNode } from "~/shared/measurements/flow-node";

import type { FlowState } from "./flow-transitions";
import {
  flowMode,
  flowProtocolId,
  initialFlowState,
  nextStepState,
  previousStepState,
} from "./flow-transitions";

// Edge transitions the store suite doesn't reach, plus the flowMode table.
// The bulk of the transition behavior is covered through the store wrapper
// in ../stores/use-measurement-flow-store.test.ts.

const makeQuestion = (id: string): FlowNode =>
  ({ id, type: "question", name: id, content: { kind: "text" } }) as FlowNode;

const makeMeasurement = (id: string): FlowNode =>
  ({ id, type: "measurement", name: id, content: { params: {}, protocolId: "p" } }) as FlowNode;

// A command cell also rides a "measurement" node but carries no protocolId.
const makeCommand = (id: string): FlowNode =>
  ({
    id,
    type: "measurement",
    name: id,
    content: { command: { format: "string", content: "battery" } },
  }) as FlowNode;

const inFlow = (overrides: Partial<FlowState> = {}): FlowState => ({
  ...initialFlowState,
  experimentId: "exp-1",
  flowNodes: [makeQuestion("q1"), makeMeasurement("m1")],
  ...overrides,
});

describe("flowProtocolId", () => {
  it("derives the protocol from the flow's measurement node", () => {
    expect(flowProtocolId([makeQuestion("q1"), makeMeasurement("m1")])).toBe("p");
  });

  it("is undefined for questions-only flows", () => {
    expect(flowProtocolId([makeQuestion("q1"), makeQuestion("q2")])).toBeUndefined();
  });

  it("skips a leading command node so the real protocol still resolves", () => {
    expect(flowProtocolId([makeCommand("c1"), makeMeasurement("m1")])).toBe("p");
  });

  it("is undefined for a command-only flow (no protocol to upload against)", () => {
    expect(flowProtocolId([makeCommand("c1")])).toBeUndefined();
  });
});

describe("flowMode", () => {
  it.each([
    ["preFlow", initialFlowState],
    ["inFlow", inFlow()],
    ["overviewDetour", inFlow({ isFromOverview: true })],
    ["reviewPending", inFlow({ isQuestionsSubmitPending: true })],
    ["finished", inFlow({ isFlowFinished: true, currentFlowStep: 2 })],
  ] as const)("%s", (expected, state) => {
    expect(flowMode(state)).toBe(expected);
  });

  it("overviewDetour wins over finished/reviewPending (mirrors transition branch order)", () => {
    expect(
      flowMode(
        inFlow({ isFromOverview: true, isFlowFinished: true, isQuestionsSubmitPending: true }),
      ),
    ).toBe("overviewDetour");
  });
});

describe("edge transitions", () => {
  it("previousStep after finishFlow walks back from the parked step", () => {
    const state = inFlow({ currentFlowStep: 2, isFlowFinished: true });
    expect(previousStepState(state)).toEqual({ currentFlowStep: 1 });
  });

  it("nextStep while finished still wraps the iteration", () => {
    const state = inFlow({ currentFlowStep: 2, isFlowFinished: true, iterationCount: 3 });
    expect(nextStepState(state)).toEqual({
      currentFlowStep: 0,
      iterationCount: 4,
      branchVisitCounts: {},
      lastMatchedPath: undefined,
      branchReturnStack: [],
      devicePlan: undefined,
      consumedNodeIds: [],
    });
  });

  it("nextStep skips consumed dispatch targets exactly once", () => {
    const state = inFlow({
      flowNodes: [makeMeasurement("m1"), makeMeasurement("m2"), makeQuestion("q1")],
      currentFlowStep: 0,
      consumedNodeIds: ["m2"],
    });
    expect(nextStepState(state)).toEqual({ currentFlowStep: 2, consumedNodeIds: [] });
  });

  it("nextStep wraps the iteration when only consumed targets remain", () => {
    const state = inFlow({
      flowNodes: [makeQuestion("q1"), makeMeasurement("m1"), makeMeasurement("m2")],
      currentFlowStep: 1,
      iterationCount: 1,
      consumedNodeIds: ["m2"],
    });
    expect(nextStepState(state)).toMatchObject({
      currentFlowStep: 0,
      iterationCount: 2,
      consumedNodeIds: [],
      devicePlan: undefined,
    });
  });

  it("nextStep leaves unrelated consumed ids for a later skip", () => {
    const state = inFlow({
      flowNodes: [makeMeasurement("m1"), makeQuestion("q1"), makeMeasurement("m2")],
      currentFlowStep: 0,
      consumedNodeIds: ["m2"],
    });
    expect(nextStepState(state)).toEqual({ currentFlowStep: 1 });
  });

  it("previousStep from step 0 abandons the flow but leaves isFromOverview untouched", () => {
    const result = previousStepState(inFlow({ currentFlowStep: 0 }));
    expect(result.experimentId).toBeUndefined();
    expect(result.flowNodes).toEqual([]);
    expect("isFromOverview" in result).toBe(false);
  });
});
