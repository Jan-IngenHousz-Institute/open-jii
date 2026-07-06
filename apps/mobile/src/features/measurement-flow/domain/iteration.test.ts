import { describe, expect, it } from "vitest";
import type { FlowNode } from "~/shared/measurements/flow-node";

import type { AnswersSnapshot } from "./iteration";
import {
  autoAdvanceDecision,
  carryForwardAnswers,
  firstManualQuestionNodeId,
  seedNextIterationAnswer,
} from "./iteration";

const makeQuestion = (id: string): FlowNode =>
  ({ id, type: "question", name: id, content: { kind: "text" } }) as FlowNode;

const makeInstruction = (id: string): FlowNode =>
  ({ id, type: "instruction", name: id, content: {} }) as FlowNode;

const answers = (overrides: Partial<AnswersSnapshot> = {}): AnswersSnapshot => ({
  answersHistory: [],
  autoincrementSettings: {},
  rememberAnswerSettings: {},
  ...overrides,
});

describe("autoAdvanceDecision", () => {
  const decide = (
    questionId: string,
    required: boolean,
    iterationCount: number,
    a: AnswersSnapshot = answers(),
  ) => autoAdvanceDecision({ questionId, required, iterationCount, answers: a });

  it("parks on a plain manual question", () => {
    expect(decide("q1", false, 0)).toEqual({ kind: "park" });
  });

  it("commits the stored value for an auto-increment question", () => {
    const a = answers({
      autoincrementSettings: { q1: true },
      answersHistory: [{ q1: "plot-2" }],
    });
    expect(decide("q1", false, 0, a)).toEqual({ kind: "commit", value: "plot-2" });
  });

  it("commits the stored value for a remembered question", () => {
    const a = answers({
      rememberAnswerSettings: { q1: true },
      answersHistory: [{}, { q1: "kept" }],
    });
    expect(decide("q1", true, 1, a)).toEqual({ kind: "commit", value: "kept" });
  });

  it("skips an optional auto question with no value", () => {
    const a = answers({ rememberAnswerSettings: { q1: true } });
    expect(decide("q1", false, 0, a)).toEqual({ kind: "skip" });
  });

  it("parks a required auto question with no value yet", () => {
    const a = answers({ autoincrementSettings: { q1: true } });
    expect(decide("q1", true, 0, a)).toEqual({ kind: "park" });
  });

  it("treats a blank stored value as missing", () => {
    const a = answers({
      rememberAnswerSettings: { q1: true },
      answersHistory: [{ q1: "   " }],
    });
    expect(decide("q1", true, 0, a)).toEqual({ kind: "park" });
  });
});

describe("seedNextIterationAnswer", () => {
  const multiChoice = (id: string, options: string[]): FlowNode =>
    ({ id, type: "question", name: id, content: { kind: "multi_choice", options } }) as FlowNode;

  it("rotates a multi_choice to the next option when auto-increment is on", () => {
    const a = answers({ autoincrementSettings: { q1: true } });
    const seed = seedNextIterationAnswer({
      node: multiChoice("q1", ["a", "b", "c"]),
      answerValue: "b",
      iterationCount: 0,
      answers: a,
    });
    expect(seed).toEqual({ cycle: 1, name: "q1", value: "c" });
  });

  it("wraps the rotation past the last option", () => {
    const a = answers({ autoincrementSettings: { q1: true } });
    const seed = seedNextIterationAnswer({
      node: multiChoice("q1", ["a", "b"]),
      answerValue: "b",
      iterationCount: 2,
      answers: a,
    });
    expect(seed).toEqual({ cycle: 3, name: "q1", value: "a" });
  });

  it("returns null for a multi_choice without auto-increment", () => {
    const seed = seedNextIterationAnswer({
      node: multiChoice("q1", ["a", "b"]),
      answerValue: "a",
      iterationCount: 0,
      answers: answers(),
    });
    expect(seed).toBeNull();
  });

  it("copies a remembered answer into the next iteration", () => {
    const a = answers({ rememberAnswerSettings: { q1: true } });
    const seed = seedNextIterationAnswer({
      node: makeQuestion("q1"),
      answerValue: "P-001",
      iterationCount: 1,
      answers: a,
    });
    expect(seed).toEqual({ cycle: 2, name: "q1", value: "P-001" });
  });

  it("returns null when nothing should carry", () => {
    expect(
      seedNextIterationAnswer({
        node: makeQuestion("q1"),
        answerValue: "P-001",
        iterationCount: 0,
        answers: answers(),
      }),
    ).toBeNull();
  });
});

describe("carryForwardAnswers", () => {
  const multiChoice = (id: string, options: string[]): FlowNode =>
    ({ id, type: "question", name: id, content: { kind: "multi_choice", options } }) as FlowNode;

  it("copies remembered answers from the previous iteration", () => {
    const a = answers({
      rememberAnswerSettings: { q1: true },
      answersHistory: [{ q1: "P-001" }],
    });
    expect(
      carryForwardAnswers({ flowNodes: [makeQuestion("q1")], iterationCount: 1, answers: a }),
    ).toEqual([{ cycle: 1, name: "q1", value: "P-001" }]);
  });

  it("rotates auto-increment multi_choice answers", () => {
    const a = answers({
      autoincrementSettings: { q1: true },
      answersHistory: [{ q1: "a" }],
    });
    const nodes = [multiChoice("q1", ["a", "b"])];
    expect(carryForwardAnswers({ flowNodes: nodes, iterationCount: 1, answers: a })).toEqual([
      { cycle: 1, name: "q1", value: "b" },
    ]);
  });

  it("keeps an existing non-blank answer for the new iteration", () => {
    const a = answers({
      rememberAnswerSettings: { q1: true },
      answersHistory: [{ q1: "old" }, { q1: "already set" }],
    });
    expect(
      carryForwardAnswers({ flowNodes: [makeQuestion("q1")], iterationCount: 1, answers: a }),
    ).toEqual([]);
  });

  it("skips a rotation when the previous value is not a known option", () => {
    const a = answers({
      autoincrementSettings: { q1: true },
      answersHistory: [{ q1: "zzz" }],
    });
    const nodes = [multiChoice("q1", ["a", "b"])];
    expect(carryForwardAnswers({ flowNodes: nodes, iterationCount: 1, answers: a })).toEqual([]);
  });

  it("carries nothing without a previous answer or settings", () => {
    expect(
      carryForwardAnswers({
        flowNodes: [makeQuestion("q1")],
        iterationCount: 1,
        answers: answers(),
      }),
    ).toEqual([]);
  });
});

describe("firstManualQuestionNodeId", () => {
  it("returns undefined when there are no nodes", () => {
    expect(firstManualQuestionNodeId([], answers())).toBeUndefined();
  });

  it("returns the id of the first manual question node", () => {
    const nodes = [makeQuestion("q1"), makeQuestion("q2")];
    expect(firstManualQuestionNodeId(nodes, answers())).toBe("q1");
  });

  it("ignores instruction nodes", () => {
    const nodes = [makeInstruction("i1"), makeQuestion("q1"), makeQuestion("q2")];
    expect(firstManualQuestionNodeId(nodes, answers())).toBe("q1");
  });

  it("skips autoincrement question nodes", () => {
    const nodes = [makeQuestion("q1"), makeQuestion("q2"), makeQuestion("q3")];
    expect(firstManualQuestionNodeId(nodes, answers({ autoincrementSettings: { q1: true } }))).toBe(
      "q2",
    );
  });

  it("skips remember-answer question nodes", () => {
    const nodes = [makeQuestion("q1"), makeQuestion("q2"), makeQuestion("q3")];
    expect(
      firstManualQuestionNodeId(nodes, answers({ rememberAnswerSettings: { q1: true } })),
    ).toBe("q2");
  });

  it("returns undefined when all questions are autoincrement or remembered", () => {
    const nodes = [makeQuestion("q1"), makeQuestion("q2")];
    const a = answers({
      autoincrementSettings: { q1: true },
      rememberAnswerSettings: { q2: true },
    });
    expect(firstManualQuestionNodeId(nodes, a)).toBeUndefined();
  });
});
