// @vitest-environment jsdom
/// <reference lib="dom" />
import { render, fireEvent, cleanup } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FlowNode } from "~/screens/measurement-flow-screen/types";
import { useFlowAnswersStore } from "~/stores/use-flow-answers-store";
import { useMeasurementFlowStore } from "~/stores/use-measurement-flow-store";

import { NavigationButtons } from "./navigation-buttons";

// Hoist React so mock factories (hoisted by vitest) can use it. Mock factories
// run before top-level imports, so we cannot simply reach for the already-
// imported `React` below.

const { hoistedReact, keyboardDismiss, advanceWithAnswerMock } = vi.hoisted(() => ({
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  hoistedReact: require("react") as typeof import("react"),
  keyboardDismiss: vi.fn(),
  advanceWithAnswerMock: vi.fn(),
}));

vi.mock("react-native", () => {
  const sanitize = (props: any) => {
    const {
      onPress,
      activeOpacity: _activeOpacity,
      numberOfLines: _numberOfLines,
      showsVerticalScrollIndicator: _showsVerticalScrollIndicator,
      keyboardShouldPersistTaps: _keyboardShouldPersistTaps,
      ...rest
    } = props;
    return { rest, onPress };
  };
  const passthrough = (tag: string) =>
    hoistedReact.forwardRef<HTMLElement, any>((props: any, ref: any) => {
      const { rest, onPress } = sanitize(props);
      return hoistedReact.createElement(tag, { ...rest, ref, onClick: onPress }, props.children);
    });
  return {
    View: passthrough("div"),
    Text: passthrough("span"),
    TouchableOpacity: passthrough("button"),
    ActivityIndicator: passthrough("div"),
    Keyboard: {
      dismiss: keyboardDismiss,
      addListener: (_event: string, _listener: () => void) => ({
        remove: vi.fn(),
      }),
    },
  };
});

vi.mock("react-native-reanimated", () => {
  const Animated = {
    View: hoistedReact.forwardRef<HTMLElement, any>(
      ({ children, style: _style, ...rest }: any, ref: any) =>
        hoistedReact.createElement("div", { ...rest, ref }, children),
    ),
  };
  return {
    __esModule: true,
    default: Animated,
    useAnimatedKeyboard: () => ({ height: { value: 0 } }),
    useAnimatedStyle: (fn: () => any) => fn(),
    useSharedValue: (initial: any) => ({ value: initial }),
  };
});

vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

vi.mock("lucide-react-native", () => {
  const Icon = (name: string) => (props: any) =>
    hoistedReact.createElement("svg", { "data-icon": name, ...props });
  return {
    ChevronLeft: Icon("ChevronLeft"),
    ChevronRight: Icon("ChevronRight"),
  };
});

vi.mock("~/hooks/use-theme", () => ({
  useTheme: () => ({
    isDark: false,
    classes: { text: "text", card: "card" },
    colors: { onSurface: "#000" },
  }),
}));

// Stub `advanceWithAnswer` so we can assert it's invoked without exercising
// its internals (already unit-tested separately).
vi.mock("./flow-nodes/utils/advance-with-answer", () => ({
  advanceWithAnswer: (...args: any[]) => advanceWithAnswerMock(...args),
}));

// --- Helpers
const makeQuestion = (id: string, extras: Partial<FlowNode> & { content?: any } = {}): FlowNode =>
  ({
    id,
    name: id,
    type: "question",
    content: { kind: "text", required: false },
    ...extras,
  }) as FlowNode;

const makeInstruction = (id: string): FlowNode =>
  ({ id, name: id, type: "instruction", content: {} }) as FlowNode;

const makeMeasurement = (id: string): FlowNode =>
  ({ id, name: id, type: "measurement", content: {} }) as FlowNode;

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
  useFlowAnswersStore.setState({
    answersHistory: [],
    autoincrementSettings: {},
    rememberAnswerSettings: {},
  });
}

describe("NavigationButtons", () => {
  beforeEach(() => {
    resetStores();
    keyboardDismiss.mockClear();
    advanceWithAnswerMock.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders nothing when there is no experiment", () => {
    useMeasurementFlowStore.setState({
      experimentId: undefined,
      flowNodes: [makeQuestion("q1")],
      currentFlowStep: 0,
    });
    const { container } = render(<NavigationButtons />);
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing on non-instruction/question nodes", () => {
    useMeasurementFlowStore.setState({
      experimentId: "exp-1",
      flowNodes: [makeMeasurement("m1")],
      currentFlowStep: 0,
    });
    const { container } = render(<NavigationButtons />);
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when the questions-only submit/review screen is active", () => {
    useMeasurementFlowStore.setState({
      experimentId: "exp-1",
      flowNodes: [makeQuestion("q1"), makeQuestion("q2")],
      currentFlowStep: 1,
      isQuestionsSubmitPending: true,
    });
    const { container } = render(<NavigationButtons />);
    expect(container.firstChild).toBeNull();
  });

  it("renders back + next on question nodes", () => {
    useMeasurementFlowStore.setState({
      experimentId: "exp-1",
      flowNodes: [makeQuestion("q1"), makeQuestion("q2")],
      currentFlowStep: 0,
    });
    const { queryByText } = render(<NavigationButtons />);
    expect(queryByText("Back")).toBeTruthy();
    expect(queryByText("Next")).toBeTruthy();
  });

  it("renders back + next on instruction nodes", () => {
    useMeasurementFlowStore.setState({
      experimentId: "exp-1",
      flowNodes: [makeInstruction("i1")],
      currentFlowStep: 0,
    });
    const { queryByText } = render(<NavigationButtons />);
    expect(queryByText("Back")).toBeTruthy();
    expect(queryByText("Next")).toBeTruthy();
  });

  it("hides the next button for required yes_no questions (they auto-advance)", () => {
    useMeasurementFlowStore.setState({
      experimentId: "exp-1",
      flowNodes: [makeQuestion("q1", { content: { kind: "yes_no", required: true } })],
      currentFlowStep: 0,
    });
    const { queryByText } = render(<NavigationButtons />);
    expect(queryByText("Next")).toBeNull();
    expect(queryByText("Back")).toBeTruthy();
  });

  it("shows the next button for optional multi_choice questions so users can skip", () => {
    useMeasurementFlowStore.setState({
      experimentId: "exp-1",
      flowNodes: [
        makeQuestion("q1", {
          content: { kind: "multi_choice", required: false, options: ["a"] },
        }),
      ],
      currentFlowStep: 0,
    });
    const { queryByText } = render(<NavigationButtons />);
    expect(queryByText("Next")).toBeTruthy();
  });

  it("shows only the 'Back to overview' button when navigated from the overview", () => {
    useMeasurementFlowStore.setState({
      experimentId: "exp-1",
      flowNodes: [makeQuestion("q1")],
      currentFlowStep: 0,
      isFromOverview: true,
    });
    const { queryByText } = render(<NavigationButtons />);
    expect(queryByText("Back to overview")).toBeTruthy();
    expect(queryByText("Back")).toBeNull();
    expect(queryByText("Next")).toBeNull();
  });

  it("clicking Back dismisses the keyboard and calls previousStep", () => {
    const previousStep = vi.fn();
    useMeasurementFlowStore.setState({
      experimentId: "exp-1",
      flowNodes: [makeQuestion("q1"), makeQuestion("q2")],
      currentFlowStep: 1,
      previousStep,
    });
    const { getByText } = render(<NavigationButtons />);
    fireEvent.click(getByText("Back"));
    expect(keyboardDismiss).toHaveBeenCalled();
    expect(previousStep).toHaveBeenCalled();
  });

  it("clicking Next on a question calls advanceWithAnswer", () => {
    useMeasurementFlowStore.setState({
      experimentId: "exp-1",
      flowNodes: [makeQuestion("q1")],
      currentFlowStep: 0,
      iterationCount: 0,
    });
    useFlowAnswersStore.setState({
      answersHistory: [{ q1: "hello" }],
      autoincrementSettings: {},
      rememberAnswerSettings: {},
    });
    const { getByText } = render(<NavigationButtons />);
    fireEvent.click(getByText("Next"));
    expect(keyboardDismiss).toHaveBeenCalled();
    expect(advanceWithAnswerMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: "q1" }),
      "hello",
    );
  });

  it("clicking Next on an instruction advances via nextStep", () => {
    const nextStep = vi.fn();
    useMeasurementFlowStore.setState({
      experimentId: "exp-1",
      flowNodes: [makeInstruction("i1")],
      currentFlowStep: 0,
      nextStep,
    });
    const { getByText } = render(<NavigationButtons />);
    fireEvent.click(getByText("Next"));
    expect(nextStep).toHaveBeenCalled();
    expect(advanceWithAnswerMock).not.toHaveBeenCalled();
  });

  it("clicking 'Back to overview' calls returnToOverview and dismisses the keyboard", () => {
    const returnToOverview = vi.fn();
    useMeasurementFlowStore.setState({
      experimentId: "exp-1",
      flowNodes: [makeQuestion("q1")],
      currentFlowStep: 0,
      isFromOverview: true,
      returnToOverview,
    });
    const { getByText } = render(<NavigationButtons />);
    fireEvent.click(getByText("Back to overview"));
    expect(keyboardDismiss).toHaveBeenCalled();
    expect(returnToOverview).toHaveBeenCalled();
  });
});
