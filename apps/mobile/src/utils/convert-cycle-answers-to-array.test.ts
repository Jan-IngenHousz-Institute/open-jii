import { describe, it, expect } from "vitest";
import type { FlowNode } from "~/screens/measurement-flow-screen/types";

import { convertCycleAnswersToArray, parseQuestions } from "./convert-cycle-answers-to-array";

const makeQuestion = (id: string, name: string, text = "question text"): FlowNode =>
  ({ id, type: "question", name, content: { kind: "text", text } }) as FlowNode;

const makeInstruction = (id: string): FlowNode =>
  ({ id, type: "instruction", name: id, content: {} }) as FlowNode;

describe("convertCycleAnswersToArray", () => {
  it("returns empty array when cycleAnswers is undefined", () => {
    expect(convertCycleAnswersToArray(undefined, [])).toEqual([]);
  });

  it("returns answers in flowNodes order, not insertion order", () => {
    const flowNodes = [
      makeQuestion("q3", "Plot", "Which plot?"),
      makeQuestion("q1", "Genotype", "Which genotype?"),
      makeQuestion("q2", "Health", "Plant health?"),
    ];

    // Insert answers in a different order than flowNodes
    const cycleAnswers: Record<string, string> = {};
    cycleAnswers["q1"] = "Solanum";
    cycleAnswers["q2"] = "Healthy";
    cycleAnswers["q3"] = "Plot-7";

    const result = convertCycleAnswersToArray(cycleAnswers, flowNodes);

    expect(result).toEqual([
      { question_label: "Plot", question_text: "Which plot?", question_answer: "Plot-7" },
      { question_label: "Genotype", question_text: "Which genotype?", question_answer: "Solanum" },
      { question_label: "Health", question_text: "Plant health?", question_answer: "Healthy" },
    ]);
  });

  it("skips non-question nodes", () => {
    const flowNodes = [
      makeInstruction("i1"),
      makeQuestion("q1", "Plot", "Which plot?"),
      makeInstruction("i2"),
      makeQuestion("q2", "Health", "Plant health?"),
    ];
    const cycleAnswers = { q1: "Plot-1", q2: "Good" };

    const result = convertCycleAnswersToArray(cycleAnswers, flowNodes);

    expect(result).toHaveLength(2);
    expect(result[0].question_label).toBe("Plot");
    expect(result[1].question_label).toBe("Health");
  });

  it("skips questions that have no answer in cycleAnswers", () => {
    const flowNodes = [
      makeQuestion("q1", "Plot"),
      makeQuestion("q2", "Genotype"),
      makeQuestion("q3", "Health"),
    ];
    const cycleAnswers = { q1: "Plot-1", q3: "Good" };

    const result = convertCycleAnswersToArray(cycleAnswers, flowNodes);

    expect(result).toHaveLength(2);
    expect(result[0].question_label).toBe("Plot");
    expect(result[1].question_label).toBe("Health");
  });

  it("uses default text when node content has no text", () => {
    const node = { id: "q1", type: "question", name: "Plot", content: { kind: "text" } } as FlowNode;
    const result = convertCycleAnswersToArray({ q1: "answer" }, [node]);

    expect(result[0].question_text).toBe("question text");
  });
});

describe("parseQuestions", () => {
  it("returns empty array for invalid input", () => {
    expect(parseQuestions(null)).toEqual([]);
    expect(parseQuestions(undefined)).toEqual([]);
    expect(parseQuestions("string")).toEqual([]);
  });

  it("returns empty array when questions field is missing", () => {
    expect(parseQuestions({})).toEqual([]);
  });

  it("parses valid measurement result", () => {
    const result = parseQuestions({
      questions: [
        { question_label: "Plot", question_text: "Which?", question_answer: "1" },
      ],
    });
    expect(result).toHaveLength(1);
    expect(result[0].question_label).toBe("Plot");
  });
});
