import { render, screen, fireEvent } from "@testing-library/react-native";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useFlowAnswersStore } from "~/features/measurement-flow/stores/use-flow-answers-store";
import { useWorkbookFlowStore } from "~/features/measurement-flow/stores/use-workbook-flow-store";
import type { FlowNode } from "~/shared/measurements/flow-node";

import { NavigationButtons } from "./navigation-buttons";

vi.mock("~/shared/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        "common:back": "Back",
        "measurementFlow:navigation.next": "Next",
        "measurementFlow:navigation.backToOverview": "Back to overview",
      };
      return map[key] ?? key;
    },
  }),
}));

const makeQuestion = (id: string, content: any = { kind: "text", required: false }): FlowNode =>
  ({ id, name: id, type: "question", content }) as FlowNode;

const makeInstruction = (id: string): FlowNode =>
  ({ id, name: id, type: "instruction", content: {} }) as FlowNode;

const makeMeasurement = (id: string): FlowNode =>
  ({ id, name: id, type: "measurement", content: {} }) as FlowNode;

beforeEach(() => {
  useWorkbookFlowStore.setState({
    experimentId: undefined,
    currentNode: undefined,
    iterationCount: 0,
    isQuestionsSubmitPending: false,
    overviewNodeId: null,
  });
  useFlowAnswersStore.setState({
    answersHistory: [],
    autoincrementSettings: {},
    rememberAnswerSettings: {},
  });
});

describe("NavigationButtons", () => {
  it("renders nothing when there is no experiment", () => {
    useWorkbookFlowStore.setState({ currentNode: makeQuestion("q1") });
    render(<NavigationButtons />);
    expect(screen.queryByText("Back")).toBeNull();
    expect(screen.queryByText("Next")).toBeNull();
  });

  it("renders nothing on measurement nodes", () => {
    useWorkbookFlowStore.setState({
      experimentId: "exp-1",
      currentNode: makeMeasurement("m1"),
    });
    render(<NavigationButtons />);
    expect(screen.queryByText("Back")).toBeNull();
    expect(screen.queryByText("Next")).toBeNull();
  });

  it("hides itself when the questions-only submit/review screen is active", () => {
    useWorkbookFlowStore.setState({
      experimentId: "exp-1",
      currentNode: makeQuestion("q2"),
      isQuestionsSubmitPending: true,
    });
    render(<NavigationButtons />);
    expect(screen.queryByText("Back")).toBeNull();
    expect(screen.queryByText("Next")).toBeNull();
  });

  it("shows Back + Next on question nodes", () => {
    useWorkbookFlowStore.setState({
      experimentId: "exp-1",
      currentNode: makeQuestion("q1"),
    });
    render(<NavigationButtons />);
    expect(screen.getByText("Back")).toBeTruthy();
    expect(screen.getByText("Next")).toBeTruthy();
  });

  it("hides Next on required auto-advance questions (yes_no)", () => {
    useWorkbookFlowStore.setState({
      experimentId: "exp-1",
      currentNode: makeQuestion("q1", { kind: "yes_no", required: true }),
    });
    render(<NavigationButtons />);
    expect(screen.queryByText("Next")).toBeNull();
    expect(screen.getByText("Back")).toBeTruthy();
  });

  it("keeps Next visible for optional multi_choice so users can skip", () => {
    useWorkbookFlowStore.setState({
      experimentId: "exp-1",
      currentNode: makeQuestion("q1", {
        kind: "multi_choice",
        required: false,
        options: ["a", "b"],
      }),
    });
    render(<NavigationButtons />);
    expect(screen.getByText("Next")).toBeTruthy();
  });

  it("shows only 'Back to overview' when navigated from the overview", () => {
    useWorkbookFlowStore.setState({
      experimentId: "exp-1",
      currentNode: makeQuestion("q1"),
      overviewNodeId: "q1",
    });
    render(<NavigationButtons />);
    expect(screen.getByText("Back to overview")).toBeTruthy();
    expect(screen.queryByText("Back")).toBeNull();
    expect(screen.queryByText("Next")).toBeNull();
  });

  it("pressing Back sends BACK through the store", () => {
    const back = vi.fn();
    useWorkbookFlowStore.setState({
      experimentId: "exp-1",
      currentNode: makeQuestion("q2"),
      back,
    });
    render(<NavigationButtons />);
    fireEvent.press(screen.getByText("Back"));
    expect(back).toHaveBeenCalled();
  });

  it("pressing 'Back to overview' calls returnToOverview", () => {
    const returnToOverview = vi.fn();
    useWorkbookFlowStore.setState({
      experimentId: "exp-1",
      currentNode: makeQuestion("q1"),
      overviewNodeId: "q1",
      returnToOverview,
    });
    render(<NavigationButtons />);
    fireEvent.press(screen.getByText("Back to overview"));
    expect(returnToOverview).toHaveBeenCalled();
  });

  it("pressing Next on an instruction advances the runner", () => {
    const next = vi.fn();
    useWorkbookFlowStore.setState({
      experimentId: "exp-1",
      currentNode: makeInstruction("i1"),
      next,
    });
    render(<NavigationButtons />);
    fireEvent.press(screen.getByText("Next"));
    expect(next).toHaveBeenCalled();
  });

  it("pressing Next on a question commits the current answer", () => {
    const commitAnswer = vi.fn();
    const node = makeQuestion("q1");
    useFlowAnswersStore.setState({ answersHistory: [{ q1: "P-001" }] });
    useWorkbookFlowStore.setState({
      experimentId: "exp-1",
      currentNode: node,
      commitAnswer,
    });
    render(<NavigationButtons />);
    fireEvent.press(screen.getByText("Next"));
    expect(commitAnswer).toHaveBeenCalledWith(node, "P-001");
  });
});
