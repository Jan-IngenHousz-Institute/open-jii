// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useIterationStateSync } from "~/features/measurement-flow/hooks/use-iteration-state-sync";
import { useFlowAnswersStore } from "~/features/measurement-flow/stores/use-flow-answers-store";
import { useMeasurementFlowStore } from "~/features/measurement-flow/stores/use-measurement-flow-store";
import type { FlowNode, QuestionContent } from "~/shared/measurements/flow-node";

// The jsdom project has no setup file, so stub the native storage both stores persist to.
vi.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: vi.fn(() => Promise.resolve(null)),
    setItem: vi.fn(() => Promise.resolve()),
    removeItem: vi.fn(() => Promise.resolve()),
  },
}));

const question = (id: string, content: Partial<QuestionContent> = {}): FlowNode => ({
  id,
  name: id,
  type: "question",
  isStart: false,
  content: { kind: "text", text: id, required: false, ...content },
});

const instruction = (id: string): FlowNode => ({
  id,
  name: id,
  type: "instruction",
  isStart: false,
  content: { text: id },
});

const measurement = (id: string): FlowNode => ({
  id,
  name: id,
  type: "measurement",
  isStart: false,
  content: { params: {}, protocolId: "p-1" },
});

function renderSync(nodes: FlowNode[]) {
  return renderHook(
    ({ flowNodes }: { flowNodes: FlowNode[] }) => useIterationStateSync(flowNodes),
    {
      initialProps: { flowNodes: nodes },
    },
  );
}

const answers = () => useFlowAnswersStore.getState();
const flow = () => useMeasurementFlowStore.getState();

// persist-wrapped setState returns storage.setItem's promise; returning that
// thenable from an act callback flips React 19 act into a never-awaited async
// scope and silently swallows all later renders. Always use a block body.
const actVoid = (fn: () => unknown) =>
  act(() => {
    fn();
  });

beforeEach(() => {
  useMeasurementFlowStore.setState({
    experimentId: undefined,
    currentStep: 0,
    flowNodes: [],
    currentFlowStep: 0,
    iterationCount: 0,
    isFlowFinished: false,
    isQuestionsSubmitPending: false,
    scanResult: undefined,
    isFromOverview: false,
  });
  useFlowAnswersStore.setState({
    answersHistory: [],
    autoincrementSettings: {},
    rememberAnswerSettings: {},
  });
});

describe("useIterationStateSync", () => {
  describe("no-op paths", () => {
    it("does nothing while iterationCount is 0", () => {
      useFlowAnswersStore.setState({
        answersHistory: [{ q1: "kept" }],
        rememberAnswerSettings: { q1: true },
      });
      useMeasurementFlowStore.setState({ currentFlowStep: 2 });

      renderSync([question("q1"), question("q2")]);

      expect(answers().answersHistory).toEqual([{ q1: "kept" }]);
      expect(flow().currentFlowStep).toBe(2);
    });

    it("does nothing when flowNodes is empty", () => {
      useFlowAnswersStore.setState({
        answersHistory: [{ q1: "kept" }],
        rememberAnswerSettings: { q1: true },
      });
      useMeasurementFlowStore.setState({ iterationCount: 1, currentFlowStep: 2 });

      renderSync([]);

      expect(answers().answersHistory).toEqual([{ q1: "kept" }]);
      expect(flow().currentFlowStep).toBe(2);
    });

    it("does not re-sync on a rerender with the same flowNodes and unchanged iteration", () => {
      useMeasurementFlowStore.setState({ iterationCount: 1 });
      const nodes = [question("q1"), question("q2")];
      const { rerender } = renderSync(nodes);
      expect(flow().currentFlowStep).toBe(0);

      actVoid(() => flow().setCurrentFlowStep(1));
      rerender({ flowNodes: nodes });

      expect(flow().currentFlowStep).toBe(1);
    });

    it("does not re-sync when the flow finishes (iteration unchanged)", () => {
      const nodes = [question("q1"), question("q2")];
      useMeasurementFlowStore.setState({ iterationCount: 1, flowNodes: nodes });
      const { rerender } = renderSync(nodes);

      actVoid(() => flow().finishFlow());
      rerender({ flowNodes: nodes });

      // step stays parked after the last node; the hook never resets it
      expect(flow().currentFlowStep).toBe(nodes.length);
      expect(flow().isFlowFinished).toBe(true);
    });
  });

  describe("carry-forward seeding", () => {
    it("copies remember-enabled answers into the new iteration; unflagged questions are not copied", () => {
      useFlowAnswersStore.setState({
        answersHistory: [{ site: "A", plain: "B" }],
        rememberAnswerSettings: { site: true },
      });
      useMeasurementFlowStore.setState({ iterationCount: 1 });

      renderSync([question("site"), question("plain")]);

      expect(answers().answersHistory).toEqual([{ site: "A", plain: "B" }, { site: "A" }]);
    });

    it("stores the trimmed previous value, not the raw one", () => {
      useFlowAnswersStore.setState({
        answersHistory: [{ notes: "  hello world  " }],
        rememberAnswerSettings: { notes: true },
      });
      useMeasurementFlowStore.setState({ iterationCount: 1 });

      renderSync([question("notes")]);

      expect(answers().getAnswer(1, "notes")).toBe("hello world");
    });

    it("leaves an existing non-blank answer for the new iteration untouched", () => {
      useFlowAnswersStore.setState({
        answersHistory: [{ q: "old" }, { q: "manual" }],
        rememberAnswerSettings: { q: true },
      });
      useMeasurementFlowStore.setState({ iterationCount: 1 });

      renderSync([question("q")]);

      expect(answers().getAnswer(1, "q")).toBe("manual");
    });

    it("overwrites a whitespace-only answer in the new iteration", () => {
      useFlowAnswersStore.setState({
        answersHistory: [{ q: "prev" }, { q: "   " }],
        rememberAnswerSettings: { q: true },
      });
      useMeasurementFlowStore.setState({ iterationCount: 1 });

      renderSync([question("q")]);

      expect(answers().getAnswer(1, "q")).toBe("prev");
    });

    it("rotates an autoincrement multi_choice answer to the next option", () => {
      useFlowAnswersStore.setState({
        answersHistory: [{ color: "green" }],
        autoincrementSettings: { color: true },
      });
      useMeasurementFlowStore.setState({ iterationCount: 1 });

      renderSync([question("color", { kind: "multi_choice", options: ["red", "green", "blue"] })]);

      expect(answers().getAnswer(1, "color")).toBe("blue");
    });

    it("wraps autoincrement from the last option back to the first", () => {
      useFlowAnswersStore.setState({
        answersHistory: [{ color: "blue" }],
        autoincrementSettings: { color: true },
      });
      useMeasurementFlowStore.setState({ iterationCount: 1 });

      renderSync([question("color", { kind: "multi_choice", options: ["red", "green", "blue"] })]);

      expect(answers().getAnswer(1, "color")).toBe("red");
    });

    it("seeds nothing when the previous answer is not among the options, even if remember is also enabled", () => {
      useFlowAnswersStore.setState({
        answersHistory: [{ color: "magenta" }],
        autoincrementSettings: { color: true },
        rememberAnswerSettings: { color: true },
      });
      useMeasurementFlowStore.setState({ iterationCount: 1 });

      renderSync([question("color", { kind: "multi_choice", options: ["red", "green"] })]);

      // quirk: the unmatched autoincrement branch bails before the remember branch
      expect(answers().getAnswer(1, "color")).toBeUndefined();
    });

    it("seeds nothing for an autoincrement multi_choice with no options", () => {
      useFlowAnswersStore.setState({
        answersHistory: [{ color: "red" }],
        autoincrementSettings: { color: true },
      });
      useMeasurementFlowStore.setState({ iterationCount: 1 });

      renderSync([question("color", { kind: "multi_choice", options: [] })]);

      expect(answers().getAnswer(1, "color")).toBeUndefined();
    });

    it("ignores the autoincrement flag on non-multi_choice questions and applies remember rules instead", () => {
      useFlowAnswersStore.setState({
        answersHistory: [{ counter: "5", both: "7" }],
        autoincrementSettings: { counter: true, both: true },
        rememberAnswerSettings: { both: true },
      });
      useMeasurementFlowStore.setState({ iterationCount: 1 });

      renderSync([question("counter"), question("both")]);

      expect(answers().getAnswer(1, "counter")).toBeUndefined();
      expect(answers().getAnswer(1, "both")).toBe("7");
    });

    it("copies a remember-only multi_choice verbatim without rotation", () => {
      useFlowAnswersStore.setState({
        answersHistory: [{ color: "green" }],
        rememberAnswerSettings: { color: true },
      });
      useMeasurementFlowStore.setState({ iterationCount: 1 });

      renderSync([question("color", { kind: "multi_choice", options: ["red", "green", "blue"] })]);

      expect(answers().getAnswer(1, "color")).toBe("green");
    });

    it("skips question nodes without content and does not throw", () => {
      const ghost = { id: "ghost", name: "ghost", type: "question", isStart: false } as FlowNode;
      useFlowAnswersStore.setState({ answersHistory: [{ ghost: "boo" }] });
      useMeasurementFlowStore.setState({ iterationCount: 1, currentFlowStep: 1 });

      renderSync([ghost, question("plain")]);

      expect(answers().getAnswer(1, "ghost")).toBeUndefined();
      // a settings-less question is still a mandatory step
      expect(flow().currentFlowStep).toBe(0);
    });
  });

  describe("step jump", () => {
    it("re-syncs when iterationCount increments while mounted and jumps past instructions and seeded questions", () => {
      useFlowAnswersStore.setState({
        answersHistory: [{ site: "keep" }],
        rememberAnswerSettings: { site: true },
      });
      const nodes = [instruction("i1"), question("site"), question("plain")];
      renderSync(nodes);

      expect(answers().answersHistory).toEqual([{ site: "keep" }]);
      expect(flow().currentFlowStep).toBe(0);

      actVoid(() => useMeasurementFlowStore.setState({ iterationCount: 1 }));

      expect(answers().getAnswer(1, "site")).toBe("keep");
      expect(flow().currentFlowStep).toBe(2);
    });

    it("stops on a required remember-question that has no carried value", () => {
      useFlowAnswersStore.setState({ rememberAnswerSettings: { req: true } });
      useMeasurementFlowStore.setState({ iterationCount: 1, currentFlowStep: 1 });

      renderSync([question("req", { required: true }), question("plain")]);

      expect(answers().answersHistory).toEqual([]);
      expect(flow().currentFlowStep).toBe(0);
    });

    it("skips an optional remember-question even when it has no carried value", () => {
      useFlowAnswersStore.setState({ rememberAnswerSettings: { opt: true } });
      useMeasurementFlowStore.setState({ iterationCount: 1 });

      renderSync([question("opt"), question("plain")]);

      // quirk: optional + remember is skipped despite ending up unanswered
      expect(answers().getAnswer(1, "opt")).toBeUndefined();
      expect(flow().currentFlowStep).toBe(1);
    });

    it("halts at a measurement node", () => {
      useFlowAnswersStore.setState({
        answersHistory: [{ q1: "x" }],
        rememberAnswerSettings: { q1: true },
      });
      useMeasurementFlowStore.setState({ iterationCount: 1 });

      renderSync([question("q1"), measurement("m1"), question("q2")]);

      expect(flow().currentFlowStep).toBe(1);
    });

    it("wraps to step 0 when no mandatory step remains", () => {
      useFlowAnswersStore.setState({
        answersHistory: [{ q1: "x" }],
        rememberAnswerSettings: { q1: true },
      });
      useMeasurementFlowStore.setState({ iterationCount: 1, currentFlowStep: 1 });

      renderSync([instruction("i1"), question("q1")]);

      expect(answers().getAnswer(1, "q1")).toBe("x");
      expect(flow().currentFlowStep).toBe(0);
    });

    it("re-runs the sync when flowNodes changes identity with identical contents", () => {
      useMeasurementFlowStore.setState({ iterationCount: 1 });
      const nodes = [question("q1"), question("q2")];
      const { rerender } = renderSync(nodes);

      actVoid(() => flow().setCurrentFlowStep(1));
      rerender({ flowNodes: [...nodes] });

      expect(flow().currentFlowStep).toBe(0);
    });
  });
});
