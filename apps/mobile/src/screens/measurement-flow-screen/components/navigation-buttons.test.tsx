import { render, screen, fireEvent } from "@testing-library/react-native";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FlowNode } from "~/screens/measurement-flow-screen/types";
import { useFlowAnswersStore } from "~/stores/use-flow-answers-store";
import { useMeasurementFlowStore } from "~/stores/use-measurement-flow-store";

import { NavigationButtons } from "./navigation-buttons";

const makeQuestion = (id: string, content: any = { kind: "text", required: false }): FlowNode =>
  ({ id, name: id, type: "question", content }) as FlowNode;

const makeInstruction = (id: string): FlowNode =>
  ({ id, name: id, type: "instruction", content: {} }) as FlowNode;

const makeMeasurement = (id: string): FlowNode =>
  ({ id, name: id, type: "measurement", content: {} }) as FlowNode;

beforeEach(() => {
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

  it("pressing Back calls previousStep on the store", () => {
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
