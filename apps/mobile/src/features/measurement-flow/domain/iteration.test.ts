import { describe, expect, it } from "vitest";
import type { FlowNode } from "~/shared/measurements/flow-node";

import type { AnswersSnapshot } from "./iteration";
import { findNextMandatoryStep, firstManualQuestionNodeId } from "./iteration";

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

describe("findNextMandatoryStep", () => {
  const next = (
    fromIndex: number,
    flowNodes: FlowNode[],
    iterationCount: number,
    a: AnswersSnapshot = answers(),
  ) => findNextMandatoryStep({ fromIndex, flowNodes, iterationCount, answers: a });

  it("returns the next question index", () => {
    const nodes = [makeQuestion("q1"), makeQuestion("q2"), makeQuestion("q3")];
    expect(next(0, nodes, 0)).toBe(1);
  });

  it("returns flowNodes.length when no mandatory step remains", () => {
    const nodes = [makeQuestion("q1")];
    expect(next(0, nodes, 0)).toBe(1);
  });

  it("skips instructions on iterations > 0", () => {
    const nodes = [makeQuestion("q1"), makeInstruction("i1"), makeQuestion("q2")];
    expect(next(0, nodes, 1)).toBe(2);
  });

  it("does not skip instructions on iteration 0", () => {
    const nodes = [makeQuestion("q1"), makeInstruction("i1"), makeQuestion("q2")];
    expect(next(0, nodes, 0)).toBe(1);
  });

  it("skips questions with auto-increment enabled", () => {
    const nodes = [makeQuestion("q1"), makeQuestion("q2"), makeQuestion("q3")];
    expect(next(0, nodes, 0, answers({ autoincrementSettings: { q2: true } }))).toBe(2);
  });

  it("skips questions with remember-answer enabled", () => {
    const nodes = [makeQuestion("q1"), makeQuestion("q2"), makeQuestion("q3")];
    expect(next(0, nodes, 0, answers({ rememberAnswerSettings: { q2: true } }))).toBe(2);
  });

  it("does not skip a required question with remember enabled when value is empty", () => {
    const nodes = [
      makeQuestion("q1"),
      { ...makeQuestion("q2"), content: { kind: "text", required: true } },
      makeQuestion("q3"),
    ];
    expect(next(0, nodes, 0, answers({ rememberAnswerSettings: { q2: true } }))).toBe(1);
  });

  it("skips a required question with remember enabled when it already has a value", () => {
    const nodes = [
      makeQuestion("q1"),
      { ...makeQuestion("q2"), content: { kind: "text", required: true } },
      makeQuestion("q3"),
    ];
    const a = answers({
      rememberAnswerSettings: { q2: true },
      answersHistory: [{ q2: "some value" }],
    });
    expect(next(0, nodes, 0, a)).toBe(2);
  });

  it("does not skip a required question with auto-increment enabled when value is empty", () => {
    const nodes = [
      makeQuestion("q1"),
      {
        ...makeQuestion("q2"),
        content: { kind: "multi_choice", required: true, options: ["a", "b"] },
      },
      makeQuestion("q3"),
    ];
    expect(next(0, nodes, 0, answers({ autoincrementSettings: { q2: true } }))).toBe(1);
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
