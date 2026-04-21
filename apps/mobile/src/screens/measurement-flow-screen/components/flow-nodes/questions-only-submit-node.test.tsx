import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FlowNode } from "~/screens/measurement-flow-screen/types";
import { useFlowAnswersStore } from "~/stores/use-flow-answers-store";
import { useMeasurementFlowStore } from "~/stores/use-measurement-flow-store";

import { QuestionsOnlySubmitNode } from "./questions-only-submit-node";

// Mocks are limited to what actually touches the network / native side. The
// component itself (and ReadyState, which it renders) runs unmocked.
const {
  uploadQuestions,
  useExperiments,
  useSession,
  useQuestionsUpload,
  getSyncedUtcISO,
  getTimeSyncState,
} = vi.hoisted(() => ({
  uploadQuestions: vi.fn(),
  useExperiments: vi.fn(),
  useSession: vi.fn(),
  useQuestionsUpload: vi.fn(),
  getSyncedUtcISO: vi.fn(),
  getTimeSyncState: vi.fn(),
}));

vi.mock("~/hooks/use-experiments", () => ({
  useExperiments: () => useExperiments(),
}));
vi.mock("~/hooks/use-session", () => ({
  useSession: () => useSession(),
}));
vi.mock("~/hooks/use-questions-upload", () => ({
  useQuestionsUpload: () => useQuestionsUpload(),
}));
vi.mock("~/utils/time-sync", () => ({
  getSyncedUtcISO: () => getSyncedUtcISO(),
  getTimeSyncState: () => getTimeSyncState(),
}));

const makeQuestion = (id: string, text = `${id} text`): FlowNode =>
  ({
    id,
    name: id,
    type: "question",
    content: { kind: "text", text, required: false },
  }) as FlowNode;

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
  uploadQuestions.mockReset();
  useExperiments.mockReturnValue({
    experiments: [{ value: "exp-1", label: "Amazing Experiment" }],
  });
  useSession.mockReturnValue({ session: { data: { user: { id: "user-1" } } } });
  useQuestionsUpload.mockReturnValue({ isUploading: false, uploadQuestions });
  getSyncedUtcISO.mockReturnValue("2026-04-20T10:00:00.000Z");
  getTimeSyncState.mockReturnValue({ timezone: "Europe/Amsterdam" });
});

describe("QuestionsOnlySubmitNode", () => {
  it("renders the ReadyState overview plus Finish and Submit buttons", () => {
    useMeasurementFlowStore.setState({
      experimentId: "exp-1",
      flowNodes: [makeQuestion("q1", "What's your name?")],
    });
    useFlowAnswersStore.setState({
      answersHistory: [{ q1: "Alice" }],
      autoincrementSettings: {},
      rememberAnswerSettings: {},
    });
    render(<QuestionsOnlySubmitNode />);
    expect(screen.getByText("What's your name?")).toBeTruthy();
    expect(screen.getByText("Alice")).toBeTruthy();
    expect(screen.getByText("Finish")).toBeTruthy();
    expect(screen.getByText("Submit & Continue")).toBeTruthy();
  });

  it("shows 'Uploading...' on the continue button while uploading", () => {
    useMeasurementFlowStore.setState({
      experimentId: "exp-1",
      flowNodes: [makeQuestion("q1")],
    });
    useQuestionsUpload.mockReturnValue({ isUploading: true, uploadQuestions });
    render(<QuestionsOnlySubmitNode />);
    expect(screen.getByText("Uploading...")).toBeTruthy();
    expect(screen.queryByText("Submit & Continue")).toBeNull();
  });

  it("tapping an answer card navigates to that question via the store", () => {
    const navigateToQuestionFromOverview = vi.fn();
    useMeasurementFlowStore.setState({
      experimentId: "exp-1",
      flowNodes: [makeQuestion("q1"), makeQuestion("q2")],
      navigateToQuestionFromOverview,
    });
    render(<QuestionsOnlySubmitNode />);
    fireEvent.press(screen.getByText("q2 text"));
    expect(navigateToQuestionFromOverview).toHaveBeenCalledWith(1);
  });

  it("'Submit & Continue' uploads and dismisses the review screen", async () => {
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
    uploadQuestions.mockResolvedValueOnce(undefined);

    render(<QuestionsOnlySubmitNode />);
    fireEvent.press(screen.getByText("Submit & Continue"));

    await waitFor(() => expect(uploadQuestions).toHaveBeenCalled());
    expect(uploadQuestions).toHaveBeenCalledWith(
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
    uploadQuestions.mockResolvedValueOnce(undefined);

    render(<QuestionsOnlySubmitNode />);
    fireEvent.press(screen.getByText("Finish"));

    await waitFor(() => expect(uploadQuestions).toHaveBeenCalled());
    await waitFor(() => expect(finishFlow).toHaveBeenCalled());
  });

  it("falls back to 'Experiment' when no matching experiment is found", async () => {
    useExperiments.mockReturnValue({ experiments: [] });
    useMeasurementFlowStore.setState({
      experimentId: "exp-missing",
      flowNodes: [makeQuestion("q1")],
    });
    useFlowAnswersStore.setState({
      answersHistory: [{ q1: "Alice" }],
      autoincrementSettings: {},
      rememberAnswerSettings: {},
    });
    uploadQuestions.mockResolvedValueOnce(undefined);

    render(<QuestionsOnlySubmitNode />);
    fireEvent.press(screen.getByText("Submit & Continue"));
    await waitFor(() => expect(uploadQuestions).toHaveBeenCalled());
    expect(uploadQuestions).toHaveBeenCalledWith(
      expect.objectContaining({ experimentName: "Experiment" }),
    );
  });

  it("logs upload rejections through console.error", async () => {
    useMeasurementFlowStore.setState({
      experimentId: "exp-1",
      flowNodes: [makeQuestion("q1")],
    });
    const err = new Error("boom");
    uploadQuestions.mockRejectedValue(err);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    render(<QuestionsOnlySubmitNode />);
    fireEvent.press(screen.getByText("Submit & Continue"));

    await waitFor(() => expect(errorSpy).toHaveBeenCalledWith(err));
    errorSpy.mockRestore();
  });
});
