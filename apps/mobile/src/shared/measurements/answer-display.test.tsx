import { render, screen } from "@testing-library/react-native";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { AnalysisSummaryCard } from "~/features/measurement-flow/screens/measurement-flow-screen/components/flow-nodes/analysis-node/analysis-summary-card";
import { MeasurementItem } from "~/features/recent-measurements/components/measurement-item";
import { MeasurementRunItem } from "~/features/recent-measurements/components/measurement-run-item";

import type { AnswerData } from "./convert-cycle-answers-to-array";

vi.mock("~/shared/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => (key.endsWith("noQuestionsAnswered") ? "No questions answered" : key),
  }),
}));
vi.mock("~/features/recent-measurements/hooks/use-outbox-state", () => ({
  useIsProcessing: () => false,
}));

const timestamp = "2026-04-20T10:00:00.000Z";
const cases = [
  {
    name: "measurement",
    component: (questions: AnswerData[]) => (
      <MeasurementItem
        id="m1"
        timestamp={timestamp}
        experimentName="Heights"
        status="successful"
        questions={questions}
      />
    ),
  },
  {
    name: "run",
    component: (questions: AnswerData[]) => (
      <MeasurementRunItem
        id="run1"
        count={2}
        timestamp={timestamp}
        experimentName="Heights"
        status="successful"
        questions={questions}
        expanded={false}
        onToggle={vi.fn()}
      />
    ),
  },
  {
    name: "analysis summary",
    component: (questions: AnswerData[]) => (
      <AnalysisSummaryCard
        experimentName="Heights"
        displayTimestamp={timestamp}
        questions={questions}
        onPress={vi.fn()}
      />
    ),
  },
];
const empty: AnswerData = {
  question_label: "Empty",
  question_text: "Empty?",
  question_answer: null,
};

describe.each(cases)("$name answers", ({ component }) => {
  it("shows the empty state when every answer is null", () => {
    render(component([empty]));
    expect(screen.getByText("No questions answered")).toBeTruthy();
  });
  it("does not add separators for unanswered questions", () => {
    render(component([empty, { ...empty, question_label: "Height", question_answer: "7" }, empty]));
    expect(screen.getByText("7")).toBeTruthy();
    expect(screen.queryByText(/\|/)).toBeNull();
  });
});
