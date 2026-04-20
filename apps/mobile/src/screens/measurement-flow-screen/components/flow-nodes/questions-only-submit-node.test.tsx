// @vitest-environment jsdom
/// <reference lib="dom" />
import { render, fireEvent, cleanup, waitFor } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FlowNode } from "~/screens/measurement-flow-screen/types";
import { useFlowAnswersStore } from "~/stores/use-flow-answers-store";
import { useMeasurementFlowStore } from "~/stores/use-measurement-flow-store";

import { QuestionsOnlySubmitNode } from "./questions-only-submit-node";

// Hoist React + boundary mocks so mock factories (hoisted by vitest) can use
// them. Mock factories run before top-level imports resolve.
const {
  hoistedReact,
  uploadQuestionsMock,
  useExperimentsMock,
  useSessionMock,
  useQuestionsUploadMock,
  getSyncedUtcISOMock,
  getTimeSyncStateMock,
} = vi.hoisted(() => ({
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  hoistedReact: require("react") as typeof import("react"),
  uploadQuestionsMock: vi.fn(),
  useExperimentsMock: vi.fn(),
  useSessionMock: vi.fn(),
  useQuestionsUploadMock: vi.fn(),
  getSyncedUtcISOMock: vi.fn(),
  getTimeSyncStateMock: vi.fn(),
}));

// --- react-native + icon + gradient stubs (same shape as sibling tests)
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
      return hoistedReact.createElement(
        tag,
        {
          ...rest,
          ref,
          onClick: onPress,
          disabled: rest.disabled,
        },
        props.children,
      );
    });
  return {
    View: passthrough("div"),
    Text: passthrough("span"),
    ScrollView: passthrough("div"),
    TouchableOpacity: passthrough("button"),
    ActivityIndicator: passthrough("div"),
  };
});

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
      card: "card",
    },
    colors: {
      onSurface: "#000",
      neutral: { black: "#000" },
      light: { grayBackground: "#fafafa" },
      dark: { grayBackground: "#222" },
      primary: { dark: "#005e5e" },
      onPrimary: "#fff",
    },
  }),
}));

vi.mock("~/hooks/use-experiments", () => ({
  useExperiments: () => useExperimentsMock(),
}));

vi.mock("~/hooks/use-session", () => ({
  useSession: () => useSessionMock(),
}));

vi.mock("~/hooks/use-questions-upload", () => ({
  useQuestionsUpload: () => useQuestionsUploadMock(),
}));

vi.mock("~/utils/time-sync", () => ({
  getSyncedUtcISO: () => getSyncedUtcISOMock(),
  getTimeSyncState: () => getTimeSyncStateMock(),
}));

// --- Helpers
const makeQuestion = (id: string, text = `${id} text`): FlowNode =>
  ({
    id,
    name: id,
    type: "question",
    content: { kind: "text", text, required: false },
  }) as FlowNode;

/**
 * Return the <button> ancestor of the given element. getByText finds the
 * inner text element (rendered as <span>), but we need the parent button
 * to inspect its `disabled` state.
 */
function closestButton(el: Element): HTMLButtonElement {
  const btn = el.closest("button");
  if (!btn) throw new Error("no <button> ancestor found for element");
  return btn;
}

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

describe("QuestionsOnlySubmitNode", () => {
  beforeEach(() => {
    resetStores();
    uploadQuestionsMock.mockReset();
    useExperimentsMock.mockReturnValue({
      experiments: [{ value: "exp-1", label: "Amazing Experiment" }],
    });
    useSessionMock.mockReturnValue({
      session: { data: { user: { id: "user-1" } } },
    });
    useQuestionsUploadMock.mockReturnValue({
      isUploading: false,
      uploadQuestions: uploadQuestionsMock,
    });
    getSyncedUtcISOMock.mockReturnValue("2026-04-20T10:00:00.000Z");
    getTimeSyncStateMock.mockReturnValue({ timezone: "Europe/Amsterdam" });
  });

  afterEach(() => {
    cleanup();
  });

  it("renders the ReadyState overview and the Finish / Submit & Continue buttons", () => {
    useMeasurementFlowStore.setState({
      experimentId: "exp-1",
      flowNodes: [makeQuestion("q1", "What's your name?")],
    });
    useFlowAnswersStore.setState({
      answersHistory: [{ q1: "Alice" }],
      autoincrementSettings: {},
      rememberAnswerSettings: {},
    });
    const { queryByText } = render(<QuestionsOnlySubmitNode />);
    expect(queryByText("What's your name?")).toBeTruthy();
    expect(queryByText("Alice")).toBeTruthy();
    expect(queryByText("Finish")).toBeTruthy();
    expect(queryByText("Submit & Continue")).toBeTruthy();
  });

  it("shows 'Uploading...' on the continue button while isUploading is true", () => {
    useMeasurementFlowStore.setState({
      experimentId: "exp-1",
      flowNodes: [makeQuestion("q1")],
    });
    useQuestionsUploadMock.mockReturnValue({
      isUploading: true,
      uploadQuestions: uploadQuestionsMock,
    });
    const { queryByText } = render(<QuestionsOnlySubmitNode />);
    expect(queryByText("Uploading...")).toBeTruthy();
    expect(queryByText("Submit & Continue")).toBeNull();
  });

  it("disables the actions when there is no experiment", () => {
    useMeasurementFlowStore.setState({
      experimentId: undefined,
      flowNodes: [makeQuestion("q1")],
    });
    const { getByText } = render(<QuestionsOnlySubmitNode />);
    expect(closestButton(getByText("Finish")).disabled).toBe(true);
    expect(closestButton(getByText("Submit & Continue")).disabled).toBe(true);
  });

  it("disables the actions when there is no authenticated user", () => {
    useSessionMock.mockReturnValue({ session: undefined });
    useMeasurementFlowStore.setState({
      experimentId: "exp-1",
      flowNodes: [makeQuestion("q1")],
    });
    const { getByText } = render(<QuestionsOnlySubmitNode />);
    expect(closestButton(getByText("Finish")).disabled).toBe(true);
    expect(closestButton(getByText("Submit & Continue")).disabled).toBe(true);
  });

  it("clicking a question card navigates to that question via the flow store", () => {
    const navigateToQuestionFromOverview = vi.fn();
    useMeasurementFlowStore.setState({
      experimentId: "exp-1",
      flowNodes: [makeQuestion("q1"), makeQuestion("q2")],
      navigateToQuestionFromOverview,
    });
    const { getAllByRole } = render(<QuestionsOnlySubmitNode />);
    const cards = getAllByRole("button").filter((b) => b.textContent?.includes("text"));
    fireEvent.click(cards[1]);
    // onCardPress receives the flow index (1), not the question position
    expect(navigateToQuestionFromOverview).toHaveBeenCalledWith(1);
  });

  it("'Submit & Continue' uploads and dismisses the submit screen", async () => {
    const dismissQuestionsSubmit = vi.fn();
    useMeasurementFlowStore.setState({
      experimentId: "exp-1",
      flowNodes: [makeQuestion("q1", "What's your name?")],
      dismissQuestionsSubmit,
    });
    useFlowAnswersStore.setState({
      answersHistory: [{ q1: "Alice" }],
      autoincrementSettings: {},
      rememberAnswerSettings: {},
    });
    uploadQuestionsMock.mockResolvedValueOnce(undefined);

    const { getByText } = render(<QuestionsOnlySubmitNode />);
    fireEvent.click(getByText("Submit & Continue"));

    await waitFor(() => expect(uploadQuestionsMock).toHaveBeenCalled());
    expect(uploadQuestionsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        timestamp: "2026-04-20T10:00:00.000Z",
        timezone: "Europe/Amsterdam",
        experimentName: "Amazing Experiment",
        experimentId: "exp-1",
        userId: "user-1",
        questions: [
          {
            question_label: "q1",
            question_text: "What's your name?",
            question_answer: "Alice",
          },
        ],
      }),
    );
    await waitFor(() => expect(dismissQuestionsSubmit).toHaveBeenCalled());
  });

  it("'Finish' uploads and finishes the flow", async () => {
    const finishFlow = vi.fn();
    useMeasurementFlowStore.setState({
      experimentId: "exp-1",
      flowNodes: [makeQuestion("q1")],
      finishFlow,
    });
    uploadQuestionsMock.mockResolvedValueOnce(undefined);

    const { getByText } = render(<QuestionsOnlySubmitNode />);
    fireEvent.click(getByText("Finish"));

    await waitFor(() => expect(uploadQuestionsMock).toHaveBeenCalled());
    await waitFor(() => expect(finishFlow).toHaveBeenCalled());
  });

  it("does not dismiss / finish when the upload is skipped because experimentId is missing", async () => {
    const dismissQuestionsSubmit = vi.fn();
    const finishFlow = vi.fn();
    useMeasurementFlowStore.setState({
      experimentId: undefined,
      flowNodes: [makeQuestion("q1")],
      dismissQuestionsSubmit,
      finishFlow,
    });
    const { getByText } = render(<QuestionsOnlySubmitNode />);
    fireEvent.click(getByText("Submit & Continue"));
    fireEvent.click(getByText("Finish"));
    // Give any pending microtasks a chance to resolve
    await Promise.resolve();
    expect(uploadQuestionsMock).not.toHaveBeenCalled();
    expect(dismissQuestionsSubmit).not.toHaveBeenCalled();
    expect(finishFlow).not.toHaveBeenCalled();
  });

  it("does not dismiss / finish when the user is not authenticated", async () => {
    useSessionMock.mockReturnValue({ session: undefined });
    const dismissQuestionsSubmit = vi.fn();
    const finishFlow = vi.fn();
    useMeasurementFlowStore.setState({
      experimentId: "exp-1",
      flowNodes: [makeQuestion("q1")],
      dismissQuestionsSubmit,
      finishFlow,
    });
    const { getByText } = render(<QuestionsOnlySubmitNode />);
    fireEvent.click(getByText("Submit & Continue"));
    fireEvent.click(getByText("Finish"));
    await Promise.resolve();
    expect(uploadQuestionsMock).not.toHaveBeenCalled();
    expect(dismissQuestionsSubmit).not.toHaveBeenCalled();
    expect(finishFlow).not.toHaveBeenCalled();
  });

  it("falls back to 'Experiment' as the name when no matching experiment is found", async () => {
    useExperimentsMock.mockReturnValue({ experiments: [] });
    useMeasurementFlowStore.setState({
      experimentId: "exp-missing",
      flowNodes: [makeQuestion("q1")],
      iterationCount: 0,
    });
    useFlowAnswersStore.setState({
      answersHistory: [{ q1: "Alice" }],
      autoincrementSettings: {},
      rememberAnswerSettings: {},
    });
    uploadQuestionsMock.mockResolvedValueOnce(undefined);

    const { getByText } = render(<QuestionsOnlySubmitNode />);
    fireEvent.click(getByText("Submit & Continue"));
    await waitFor(() => expect(uploadQuestionsMock).toHaveBeenCalled());
    expect(uploadQuestionsMock).toHaveBeenCalledWith(
      expect.objectContaining({ experimentName: "Experiment" }),
    );
  });

  it("swallows upload rejections so the promise chain doesn't unhandled-reject", async () => {
    const dismissQuestionsSubmit = vi.fn();
    const finishFlow = vi.fn();
    useMeasurementFlowStore.setState({
      experimentId: "exp-1",
      flowNodes: [makeQuestion("q1")],
      dismissQuestionsSubmit,
      finishFlow,
    });
    const err = new Error("boom");
    uploadQuestionsMock.mockRejectedValue(err);
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const { getByText } = render(<QuestionsOnlySubmitNode />);
    fireEvent.click(getByText("Submit & Continue"));
    fireEvent.click(getByText("Finish"));

    await waitFor(() => expect(consoleErrorSpy).toHaveBeenCalledWith(err));
    // Neither success handler should fire when the upload rejects
    expect(dismissQuestionsSubmit).not.toHaveBeenCalled();
    expect(finishFlow).not.toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });
});
