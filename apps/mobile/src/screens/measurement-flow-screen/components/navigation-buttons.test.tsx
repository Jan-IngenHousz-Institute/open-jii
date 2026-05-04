import { render, screen, fireEvent } from "@testing-library/react-native";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FlowNode } from "~/screens/measurement-flow-screen/types";
import { useFlowAnswersStore } from "~/stores/use-flow-answers-store";
import { useMeasurementFlowStore } from "~/stores/use-measurement-flow-store";

import { NavigationButtons } from "./navigation-buttons";

const mockShowAlert = vi.fn();
vi.mock("~/components/AlertDialog", () => ({
  showAlert: (...args: unknown[]) => mockShowAlert(...args),
}));

const makeQuestion = (id: string, content: any = { kind: "text", required: false }): FlowNode =>
  ({ id, name: id, type: "question", content }) as FlowNode;

const makeInstruction = (id: string): FlowNode =>
  ({ id, name: id, type: "instruction", content: {} }) as FlowNode;

const makeMeasurement = (id: string): FlowNode =>
  ({ id, name: id, type: "measurement", content: {} }) as FlowNode;

beforeEach(() => {
  mockShowAlert.mockReset();
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
  useFlowAnswersStore.setState({
    answersHistory: [],
    autoincrementSettings: {},
    rememberAnswerSettings: {},
  });
});

describe("NavigationButtons", () => {
  it("renders nothing when there is no experiment", () => {
    useMeasurementFlowStore.setState({
      flowNodes: [makeQuestion("q1")],
    });
    render(<NavigationButtons />);
    expect(screen.queryByText("Back")).toBeNull();
    expect(screen.queryByText("Next")).toBeNull();
  });

  it("renders nothing on measurement nodes", () => {
    useMeasurementFlowStore.setState({
      experimentId: "exp-1",
      flowNodes: [makeMeasurement("m1")],
    });
    render(<NavigationButtons />);
    expect(screen.queryByText("Back")).toBeNull();
    expect(screen.queryByText("Next")).toBeNull();
  });

  it("hides itself when the questions-only submit/review screen is active", () => {
    useMeasurementFlowStore.setState({
      experimentId: "exp-1",
      flowNodes: [makeQuestion("q1"), makeQuestion("q2")],
      currentFlowStep: 1,
      isQuestionsSubmitPending: true,
    });
    render(<NavigationButtons />);
    expect(screen.queryByText("Back")).toBeNull();
    expect(screen.queryByText("Next")).toBeNull();
  });

  it("shows Back + Next on question nodes", () => {
    useMeasurementFlowStore.setState({
      experimentId: "exp-1",
      flowNodes: [makeQuestion("q1")],
    });
    render(<NavigationButtons />);
    expect(screen.getByText("Back")).toBeTruthy();
    expect(screen.getByText("Next")).toBeTruthy();
  });

  it("hides Next on required auto-advance questions (yes_no)", () => {
    useMeasurementFlowStore.setState({
      experimentId: "exp-1",
      flowNodes: [makeQuestion("q1", { kind: "yes_no", required: true })],
    });
    render(<NavigationButtons />);
    expect(screen.queryByText("Next")).toBeNull();
    expect(screen.getByText("Back")).toBeTruthy();
  });

  it("keeps Next visible for optional multi_choice so users can skip", () => {
    useMeasurementFlowStore.setState({
      experimentId: "exp-1",
      flowNodes: [
        makeQuestion("q1", {
          kind: "multi_choice",
          required: false,
          options: ["a", "b"],
        }),
      ],
    });
    render(<NavigationButtons />);
    expect(screen.getByText("Next")).toBeTruthy();
  });

  it("shows only 'Back to overview' when navigated from the overview", () => {
    useMeasurementFlowStore.setState({
      experimentId: "exp-1",
      flowNodes: [makeQuestion("q1")],
      isFromOverview: true,
    });
    render(<NavigationButtons />);
    expect(screen.getByText("Back to overview")).toBeTruthy();
    expect(screen.queryByText("Back")).toBeNull();
    expect(screen.queryByText("Next")).toBeNull();
  });

  it("pressing Back beyond the first step calls previousStep without prompting", () => {
    const previousStep = vi.fn();
    useMeasurementFlowStore.setState({
      experimentId: "exp-1",
      flowNodes: [makeQuestion("q1"), makeQuestion("q2")],
      currentFlowStep: 1,
      previousStep,
    });
    render(<NavigationButtons />);
    fireEvent.press(screen.getByText("Back"));
    expect(previousStep).toHaveBeenCalled();
    expect(mockShowAlert).not.toHaveBeenCalled();
  });

  it("pressing Back on the first step shows a confirmation alert and does not navigate", () => {
    const previousStep = vi.fn();
    useMeasurementFlowStore.setState({
      experimentId: "exp-1",
      flowNodes: [makeQuestion("q1"), makeQuestion("q2")],
      currentFlowStep: 0,
      previousStep,
    });
    render(<NavigationButtons />);
    fireEvent.press(screen.getByText("Back"));
    expect(previousStep).not.toHaveBeenCalled();
    expect(mockShowAlert).toHaveBeenCalledTimes(1);
    const [title, message, buttons] = mockShowAlert.mock.calls[0];
    expect(title).toBe("Back to experiment selection");
    expect(message).toMatch(/all progress/i);
    expect(buttons).toHaveLength(2);
    expect(buttons[0]).toMatchObject({ text: "Continue", variant: "primary" });
    expect(buttons[1]).toMatchObject({ text: "Cancel", variant: "ghost" });
  });

  it("confirming the alert from the first step calls previousStep", () => {
    const previousStep = vi.fn();
    useMeasurementFlowStore.setState({
      experimentId: "exp-1",
      flowNodes: [makeQuestion("q1")],
      currentFlowStep: 0,
      previousStep,
    });
    render(<NavigationButtons />);
    fireEvent.press(screen.getByText("Back"));
    const [, , buttons] = mockShowAlert.mock.calls[0];
    buttons[0].onPress?.();
    expect(previousStep).toHaveBeenCalled();
  });

  it("pressing 'Back to overview' calls returnToOverview", () => {
    const returnToOverview = vi.fn();
    useMeasurementFlowStore.setState({
      experimentId: "exp-1",
      flowNodes: [makeQuestion("q1")],
      isFromOverview: true,
      returnToOverview,
    });
    render(<NavigationButtons />);
    fireEvent.press(screen.getByText("Back to overview"));
    expect(returnToOverview).toHaveBeenCalled();
  });

  it("pressing Next on an instruction calls nextStep", () => {
    const nextStep = vi.fn();
    useMeasurementFlowStore.setState({
      experimentId: "exp-1",
      flowNodes: [makeInstruction("i1")],
      nextStep,
    });
    render(<NavigationButtons />);
    fireEvent.press(screen.getByText("Next"));
    expect(nextStep).toHaveBeenCalled();
  });
});
