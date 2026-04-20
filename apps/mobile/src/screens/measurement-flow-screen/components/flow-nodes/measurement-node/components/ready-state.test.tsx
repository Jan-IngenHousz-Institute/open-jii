import { render, screen, fireEvent } from "@testing-library/react-native";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FlowNode } from "~/screens/measurement-flow-screen/types";
import { useFlowAnswersStore } from "~/stores/use-flow-answers-store";
import { useMeasurementFlowStore } from "~/stores/use-measurement-flow-store";

import { ReadyState } from "./ready-state";

const makeQuestion = (id: string, overrides: Partial<FlowNode> = {}): FlowNode =>
  ({
    id,
    name: id,
    type: "question",
    content: { kind: "text", text: `${id} text` },
    ...overrides,
  }) as FlowNode;

const makeInstruction = (id: string): FlowNode =>
  ({ id, name: id, type: "instruction", content: {} }) as FlowNode;

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

describe("ReadyState", () => {
  it("shows the empty state when the flow has no questions", () => {
    useMeasurementFlowStore.setState({ flowNodes: [makeInstruction("i1")] });
    render(<ReadyState onCardPress={vi.fn()} />);
    expect(screen.getByText(/no questions/i)).toBeTruthy();
  });

  it("uses the question text as the card label, not the node name", () => {
    useMeasurementFlowStore.setState({
      flowNodes: [
        makeQuestion("q1", {
          name: "author-label",
          content: { kind: "text", text: "What's your name?" },
        }),
      ],
    });
    render(<ReadyState onCardPress={vi.fn()} />);
    expect(screen.getByText("What's your name?")).toBeTruthy();
    expect(screen.queryByText("author-label")).toBeNull();
  });

  it("falls back to the node name when content.text is absent", () => {
    useMeasurementFlowStore.setState({
      flowNodes: [makeQuestion("q1", { name: "fallback-name", content: { kind: "text" } })],
    });
    render(<ReadyState onCardPress={vi.fn()} />);
    expect(screen.getByText("fallback-name")).toBeTruthy();
  });

  it("renders the answer for the current cycle", () => {
    useMeasurementFlowStore.setState({
      flowNodes: [makeQuestion("q1")],
      iterationCount: 0,
    });
    useFlowAnswersStore.setState({
      answersHistory: [{ q1: "Alice" }],
      autoincrementSettings: {},
      rememberAnswerSettings: {},
    });
    render(<ReadyState onCardPress={vi.fn()} />);
    expect(screen.getByText("Alice")).toBeTruthy();
    expect(screen.queryByText("Not set")).toBeNull();
  });

  it("shows 'Not set' when the answer is blank", () => {
    useMeasurementFlowStore.setState({ flowNodes: [makeQuestion("q1")] });
    useFlowAnswersStore.setState({
      answersHistory: [{ q1: "   " }],
      autoincrementSettings: {},
      rememberAnswerSettings: {},
    });
    render(<ReadyState onCardPress={vi.fn()} />);
    expect(screen.getByText("Not set")).toBeTruthy();
  });

  it("passes the flow index (not the filtered position) to onCardPress", () => {
    const onCardPress = vi.fn();
    useMeasurementFlowStore.setState({
      flowNodes: [
        makeInstruction("i1"),
        makeQuestion("q1"),
        makeInstruction("i2"),
        makeQuestion("q2"),
      ],
    });
    render(<ReadyState onCardPress={onCardPress} />);
    fireEvent.press(screen.getByText("q1 text"));
    fireEvent.press(screen.getByText("q2 text"));
    expect(onCardPress).toHaveBeenNthCalledWith(1, 1);
    expect(onCardPress).toHaveBeenNthCalledWith(2, 3);
  });
});
