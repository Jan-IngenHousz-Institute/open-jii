"use client";

import { SettingsCard } from "@/components/shared/settings-card";
import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";

import type { DeviceAnswer } from "@repo/api/domains/iot/iot.schema";
import { useTranslation } from "@repo/i18n";

import type { DevicePlanQuestion } from "./device-plan-question-field";
import { DevicePlanQuestionField } from "./device-plan-question-field";

export interface PlanQuestionEntry {
  experimentName: string;
  question: DevicePlanQuestion;
}

interface DevicePlanQuestionsProps {
  questions: PlanQuestionEntry[];
  onAnswersChange: (answers: Record<string, DeviceAnswer>) => void;
}

function toFormAnswer(answer: DeviceAnswer): string {
  return typeof answer === "string" ? answer : "";
}

export function DevicePlanQuestions({ questions, onAnswersChange }: DevicePlanQuestionsProps) {
  const { t } = useTranslation("iot");

  const defaultValues = useMemo(
    () =>
      Object.fromEntries(
        questions.map((entry) => [entry.question.id, toFormAnswer(entry.question.answer)]),
      ),
    [questions],
  );

  const { control, watch } = useForm<Record<string, string>>({ defaultValues });

  useEffect(() => {
    const subscription = watch((values) => {
      onAnswersChange(
        Object.fromEntries(
          // An empty input means unanswered, so it maps to null, not "".
          Object.entries(values).map(([id, value]) => [
            id,
            value === undefined || value === "" ? null : value,
          ]),
        ),
      );
    });
    return () => subscription.unsubscribe();
  }, [watch, onAnswersChange]);

  const renderField = (entry: PlanQuestionEntry) => (
    <DevicePlanQuestionField
      key={entry.question.id}
      experimentName={entry.experimentName}
      question={entry.question}
      control={control}
    />
  );

  return (
    <SettingsCard
      title={t("iot.onboarding.questionsTitle")}
      description={t("iot.onboarding.questionsDescription")}
    >
      <div className="divide-y rounded-lg border">{questions.map(renderField)}</div>
    </SettingsCard>
  );
}
