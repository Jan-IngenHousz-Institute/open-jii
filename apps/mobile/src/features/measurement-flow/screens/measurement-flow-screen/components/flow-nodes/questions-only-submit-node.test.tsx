import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useFlowAnswersStore } from "~/features/measurement-flow/stores/use-flow-answers-store";
import { useMeasurementFlowStore } from "~/features/measurement-flow/stores/use-measurement-flow-store";
import type { FlowNode } from "~/shared/measurements/flow-node";

import { QuestionsOnlySubmitNode } from "./questions-only-submit-node";

// Mocks are limited to what actually touches the network / native side. The
// component itself (and ReadyState, which it renders) runs unmocked.
const {
  uploadQuestions,
  useExperiments,
  useSession,
  useQuestionsUpload,
  getSyncedUtcISO,
  getSyncedLocalISO,
  getTimeSyncState,
  finishAndExit,
} = vi.hoisted(() => ({
  uploadQuestions: vi.fn(),
  useExperiments: vi.fn(),
  useSession: vi.fn(),
  useQuestionsUpload: vi.fn(),
  getSyncedUtcISO: vi.fn(),
  getSyncedLocalISO: vi.fn(),
  getTimeSyncState: vi.fn(),
  finishAndExit: vi.fn(),
}));

vi.mock("~/features/experiments/hooks/use-experiments", () => ({
  useExperiments: () => useExperiments(),
}));
vi.mock("~/features/auth/hooks/use-session", () => ({
  useSession: () => useSession(),
}));
vi.mock("~/features/recent-measurements/hooks/use-questions-upload", () => ({
  useQuestionsUpload: () => useQuestionsUpload(),
}));
vi.mock("~/features/measurement-flow/hooks/use-finish-flow", () => ({
  useFinishFlow: () => finishAndExit,
}));
vi.mock("~/shared/time/time-sync", () => ({
  getSyncedUtcISO: () => getSyncedUtcISO(),
  getSyncedLocalISO: () => getSyncedLocalISO(),
  getTimeSyncState: () => getTimeSyncState(),
}));
vi.mock("~/shared/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        "measurementFlow:questionsSubmit.editComment": "Edit comment",
        "measurementFlow:questionsSubmit.addComment": "Add comment",
        "measurementFlow:questionsSubmit.flag": "Flag",
        "measurementFlow:questionsSubmit.finish": "Finish",
        "measurementFlow:questionsSubmit.uploading": "Uploading...",
        "measurementFlow:questionsSubmit.submitContinue": "Submit & Continue",
        "measurementFlow:questionsSubmit.defaultExperimentName": "Experiment",
        "measurementFlow:measurementNode.readyState.noQuestions":
          "This flow has no questions, start measuring directly!",
        "measurementFlow:measurementNode.readyState.overviewHeading": "Overview of your answers",
        "measurementFlow:measurementNode.readyState.defaultQuestionLabel": "Question",
        "measurementFlow:measurementNode.readyState.notSet": "Not set",
      };
      return map[key] ?? key;
    },
  }),
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
  finishAndExit.mockReset();
  useExperiments.mockReturnValue({
    experiments: [{ value: "exp-1", label: "Amazing Experiment" }],
  });
  useSession.mockReturnValue({ session: { data: { user: { id: "user-1" } } } });
  useQuestionsUpload.mockReturnValue({ isUploading: false, uploadQuestions });
  getSyncedUtcISO.mockReturnValue("2026-04-20T10:00:00.000Z");
  getSyncedLocalISO.mockReturnValue("2026-04-20T12:00:00.000+02:00");
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

  it("'Finish' uploads then exits the flow to Recent Measurements", async () => {
    useMeasurementFlowStore.setState({
      experimentId: "exp-1",
      flowNodes: [makeQuestion("q1")],
    });
    uploadQuestions.mockResolvedValueOnce(undefined);

    render(<QuestionsOnlySubmitNode />);
    fireEvent.press(screen.getByText("Finish"));

    await waitFor(() => expect(uploadQuestions).toHaveBeenCalled());
    await waitFor(() => expect(finishAndExit).toHaveBeenCalled());
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

  it("logs upload rejections through the logger", async () => {
    useMeasurementFlowStore.setState({
      experimentId: "exp-1",
      flowNodes: [makeQuestion("q1")],
    });
    const err = new Error("boom");
    uploadQuestions.mockRejectedValue(err);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    render(<QuestionsOnlySubmitNode />);
    fireEvent.press(screen.getByText("Submit & Continue"));

    await waitFor(() =>
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("handler failed")),
    );
    errorSpy.mockRestore();
  });
});
