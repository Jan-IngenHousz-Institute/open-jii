// @vitest-environment jsdom
/// <reference lib="dom" />
import { render, fireEvent, cleanup } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FlowNode } from "~/screens/measurement-flow-screen/types";
import { useFlowAnswersStore } from "~/stores/use-flow-answers-store";
import { useMeasurementFlowStore } from "~/stores/use-measurement-flow-store";

import { ReadyState } from "./ready-state";

// Hoist React so mock factories (hoisted by vitest) can use it. Mock factories
// run before top-level imports, so we cannot simply reach for the already-
// imported `React` below.
const { hoistedReact } = vi.hoisted(() => ({
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  hoistedReact: require("react") as typeof import("react"),
}));

// --- react-native: render primitives as plain host elements so they work in jsdom.
vi.mock("react-native", () => {
  // Strip RN-only props so React doesn't warn about unknown DOM attributes.
  const sanitize = (props: any) => {
    const {
      onPress,
      numberOfLines: _numberOfLines,
      activeOpacity: _activeOpacity,
      showsVerticalScrollIndicator: _showsVerticalScrollIndicator,
      keyboardShouldPersistTaps: _keyboardShouldPersistTaps,
      ...rest
    } = props;
    return { rest, onPress };
  };
  const passthrough = (tag: string) =>
    hoistedReact.forwardRef<HTMLElement, any>((props, ref) => {
      const { rest, onPress } = sanitize(props);
      return hoistedReact.createElement(
        tag,
        {
          ...rest,
          ref,
          onClick: onPress,
        },
        props.children,
      );
    });
  return {
    View: passthrough("div"),
    Text: passthrough("span"),
    ScrollView: passthrough("div"),
    TouchableOpacity: passthrough("button"),
  };
});

// --- Lightweight stubs for the remaining RN-ecosystem imports.
vi.mock("expo-linear-gradient", () => ({
  LinearGradient: ({ children, ...rest }: any) => hoistedReact.createElement("div", rest, children),
}));

vi.mock("lucide-react-native", () => {
  const Icon = (name: string) => (props: any) =>
    hoistedReact.createElement("svg", { "data-icon": name, ...props });
  return {
    Bookmark: Icon("Bookmark"),
    HelpCircle: Icon("HelpCircle"),
    Repeat2: Icon("Repeat2"),
  };
});

vi.mock("~/hooks/use-theme", () => ({
  useTheme: () => ({
    isDark: false,
    classes: {
      text: "text",
      textSecondary: "text-secondary",
      surface: "surface",
    },
    colors: {
      onSurface: "#000",
      neutral: { black: "#000" },
      light: { grayBackground: "#fafafa" },
      dark: { grayBackground: "#222" },
    },
  }),
}));

const makeQuestion = (id: string, extras: Partial<FlowNode> = {}): FlowNode =>
  ({
    id,
    name: id,
    type: "question",
    content: { kind: "text", text: `${id} text` },
    ...extras,
  }) as FlowNode;

const makeInstruction = (id: string): FlowNode =>
  ({ id, name: id, type: "instruction", content: {} }) as FlowNode;

function resetStores() {
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
  // The flow-answers store is only read through `useFlowAnswersStore` — stub it
  // via setState in each test.
  useFlowAnswersStore.setState({
    answersHistory: [],
    autoincrementSettings: {},
    rememberAnswerSettings: {},
  });
}

describe("ReadyState", () => {
  beforeEach(() => {
    resetStores();
  });

  afterEach(() => {
    cleanup();
  });

  it("shows the empty state when there are no questions", () => {
    useMeasurementFlowStore.setState({
      flowNodes: [makeInstruction("i1")],
    });
    const { getByText } = render(<ReadyState onCardPress={vi.fn()} />);
    expect(getByText(/no questions/i)).toBeTruthy();
  });

  it("prefers the question text over the node name for the label", () => {
    const node = makeQuestion("q1", {
      name: "Node Label",
      content: { kind: "text", text: "Question text?" },
    });
    useMeasurementFlowStore.setState({
      flowNodes: [node],
    });
    const { queryByText } = render(<ReadyState onCardPress={vi.fn()} />);
    expect(queryByText("Question text?")).toBeTruthy();
    expect(queryByText("Node Label")).toBeNull();
  });

  it("falls back to the node name when content.text is missing", () => {
    const node = makeQuestion("q1", {
      name: "Fallback Name",
      content: { kind: "text" },
    });
    useMeasurementFlowStore.setState({
      flowNodes: [node],
    });
    const { queryByText } = render(<ReadyState onCardPress={vi.fn()} />);
    expect(queryByText("Fallback Name")).toBeTruthy();
  });

  it("falls back to 'Question' when neither content.text nor name is present", () => {
    const node = makeQuestion("q1", {
      name: undefined as unknown as string,
      content: { kind: "text" },
    });
    useMeasurementFlowStore.setState({
      flowNodes: [node],
    });
    const { queryByText } = render(<ReadyState onCardPress={vi.fn()} />);
    expect(queryByText("Question")).toBeTruthy();
  });

  it("renders the answer when one has been given", () => {
    const node = makeQuestion("q1", {
      name: "Node Label",
      content: { kind: "text", text: "What is your name?" },
    });
    useMeasurementFlowStore.setState({
      flowNodes: [node],
      iterationCount: 0,
    });
    useFlowAnswersStore.setState({
      answersHistory: [{ q1: "Alice" }],
      autoincrementSettings: {},
      rememberAnswerSettings: {},
    });
    const { queryByText } = render(<ReadyState onCardPress={vi.fn()} />);
    expect(queryByText("Alice")).toBeTruthy();
    expect(queryByText("Not set")).toBeNull();
  });

  it("shows 'Not set' when the answer is missing or blank", () => {
    const node = makeQuestion("q1");
    useMeasurementFlowStore.setState({
      flowNodes: [node],
    });
    useFlowAnswersStore.setState({
      answersHistory: [{ q1: "   " }],
      autoincrementSettings: {},
      rememberAnswerSettings: {},
    });
    const { queryByText } = render(<ReadyState onCardPress={vi.fn()} />);
    expect(queryByText("Not set")).toBeTruthy();
  });

  it("shows the auto-increment indicator when enabled", () => {
    const node = makeQuestion("q1");
    useMeasurementFlowStore.setState({
      flowNodes: [node],
    });
    useFlowAnswersStore.setState({
      answersHistory: [],
      autoincrementSettings: { q1: true },
      rememberAnswerSettings: {},
    });
    const { container } = render(<ReadyState onCardPress={vi.fn()} />);
    expect(container.querySelector('[data-icon="Repeat2"]')).toBeTruthy();
    expect(container.querySelector('[data-icon="Bookmark"]')).toBeNull();
  });

  it("shows the remember-answer indicator when enabled", () => {
    const node = makeQuestion("q1");
    useMeasurementFlowStore.setState({
      flowNodes: [node],
    });
    useFlowAnswersStore.setState({
      answersHistory: [],
      autoincrementSettings: {},
      rememberAnswerSettings: { q1: true },
    });
    const { container } = render(<ReadyState onCardPress={vi.fn()} />);
    expect(container.querySelector('[data-icon="Bookmark"]')).toBeTruthy();
    expect(container.querySelector('[data-icon="Repeat2"]')).toBeNull();
  });

  it("invokes onCardPress with the node's flow index (not the filtered position)", () => {
    const onCardPress = vi.fn();
    useMeasurementFlowStore.setState({
      flowNodes: [
        makeInstruction("i1"),
        makeQuestion("q1"),
        makeInstruction("i2"),
        makeQuestion("q2"),
      ],
    });
    const { getAllByRole } = render(<ReadyState onCardPress={onCardPress} />);
    const buttons = getAllByRole("button");
    // Two questions => two cards
    expect(buttons).toHaveLength(2);
    fireEvent.click(buttons[0]);
    fireEvent.click(buttons[1]);
    // onCardPress should receive the original flow index, not the filtered position
    expect(onCardPress).toHaveBeenNthCalledWith(1, 1);
    expect(onCardPress).toHaveBeenNthCalledWith(2, 3);
  });

  it("numbers cards by their filtered position (1-based)", () => {
    useMeasurementFlowStore.setState({
      flowNodes: [makeInstruction("i1"), makeQuestion("q1"), makeQuestion("q2")],
    });
    const { queryByText } = render(<ReadyState onCardPress={vi.fn()} />);
    expect(queryByText("1")).toBeTruthy();
    expect(queryByText("2")).toBeTruthy();
  });
});
