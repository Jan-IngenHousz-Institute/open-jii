import { describe, it, expect } from "vitest";
import {
  convertCycleAnswersToArray,
  parseQuestions,
} from "~/shared/measurements/convert-cycle-answers-to-array";
import type { FlowNode } from "~/shared/measurements/flow-node";

const makeQuestion = (id: string, name: string, text = "question text"): FlowNode =>
  ({ id, type: "question", name, content: { kind: "text", text } }) as FlowNode;

const makeInstruction = (id: string): FlowNode =>
  ({ id, type: "instruction", name: id, content: {} }) as FlowNode;

describe("convertCycleAnswersToArray", () => {
  it("saves measurements when a hydrated question has a missing or future kind", () => {
    for (const kind of [undefined, "future_kind"]) {
      const node = { ...makeQuestion("q", "Question"), content: { kind, text: "Question?" } };
      expect(convertCycleAnswersToArray({ q: "answer" }, [node])).toEqual([
        { question_label: "Question", question_text: "Question?", question_answer: "answer" },
      ]);
    }
  });
  it.each(["number", "text", "single_choice", "multi_choice", "open_ended", "yes_no"])(
    "emits null for unanswered or cleared %s questions",
    (kind) => {
      const node = { ...makeQuestion("q", "Question"), content: { kind, text: "Question?" } };
      const cases: (Record<string, string> | undefined)[] = [undefined, {}, { q: "" }, { q: "  " }];
      for (const answers of cases) {
        expect(convertCycleAnswersToArray(answers, [node])[0]).toMatchObject({
          question_kind: kind,
          question_answer: null,
        });
      }
    },
  );

  it("keeps Yes/No English text and rejects malformed number answers defensively", () => {
    const yesNo = {
      ...makeQuestion("q", "Healthy"),
      content: { kind: "yes_no", text: "Healthy?" },
    };
    expect(convertCycleAnswersToArray({ q: "Yes" }, [yesNo])[0].question_answer).toBe("Yes");
    expect(convertCycleAnswersToArray({ q: "No" }, [yesNo])[0].question_answer).toBe("No");
    const number = { ...yesNo, content: { kind: "number", text: "Height?" } };
    expect(convertCycleAnswersToArray({ q: "1.2.3" }, [number])[0].question_answer).toBeNull();
  });
  it("carries the number kind and serializes cleared answers as JSON null", () => {
    const height = {
      ...makeQuestion("height", "Height"),
      content: { kind: "number", text: "Height?" },
    };
    expect(convertCycleAnswersToArray({ height: "12.5" }, [height])).toEqual([
      {
        question_label: "Height",
        question_text: "Height?",
        question_kind: "number",
        question_answer: "12.5",
      },
    ]);
    expect(convertCycleAnswersToArray({ height: "" }, [height])[0].question_answer).toBeNull();
  });

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
    cycleAnswers.q1 = "Solanum";
    cycleAnswers.q2 = "Healthy";
    cycleAnswers.q3 = "Plot-7";

    const result = convertCycleAnswersToArray(cycleAnswers, flowNodes);

    expect(result).toEqual([
      {
        question_label: "Plot",
        question_text: "Which plot?",
        question_kind: "text",
        question_answer: "Plot-7",
      },
      {
        question_label: "Genotype",
        question_text: "Which genotype?",
        question_kind: "text",
        question_answer: "Solanum",
      },
      {
        question_label: "Health",
        question_text: "Plant health?",
        question_kind: "text",
        question_answer: "Healthy",
      },
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

  it("includes null for unanswered questions", () => {
    const flowNodes = [
      makeQuestion("q1", "Plot"),
      makeQuestion("q2", "Genotype"),
      makeQuestion("q3", "Health"),
    ];
    const cycleAnswers = { q1: "Plot-1", q3: "Good" };

    const result = convertCycleAnswersToArray(cycleAnswers, flowNodes);

    expect(result).toHaveLength(3);
    expect(result[1]).toMatchObject({ question_label: "Genotype", question_answer: null });
    expect(result[2].question_label).toBe("Health");
  });

  it("uses default text when node content has no text", () => {
    const node = {
      id: "q1",
      type: "question",
      name: "Plot",
      content: { kind: "text" },
    } as FlowNode;
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
      questions: [{ question_label: "Plot", question_text: "Which?", question_answer: "1" }],
    });
    expect(result).toHaveLength(1);
    expect(result[0].question_label).toBe("Plot");
  });
});
