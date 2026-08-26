"use client";

import { SettingsCard } from "@/components/shared/settings-card";
import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";

import type { DeviceAnswer } from "@repo/api/domains/iot/iot.schema";
import { useTranslation } from "@repo/i18n";
import { Progress } from "@repo/ui/components/progress";

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

/**
 * Measurement answers as one flat form: a slim per-experiment heading, then
 * the fields in a plain grid. No accordion and no inner boxes; the earlier
 * card-in-card-in-list nesting buried a handful of inputs in chrome. The
 * title carries a live completion count so the card's state is readable
 * without scrolling it.
 */
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
  const values = watch();

  useEffect(() => {
    const subscription = watch((next) => {
      onAnswersChange(
        Object.fromEntries(
          // An empty input means unanswered, so it maps to null, not "".
          Object.entries(next).map(([id, value]) => [
            id,
            value === undefined || value === "" ? null : value,
          ]),
        ),
      );
    });
    return () => subscription.unsubscribe();
  }, [watch, onAnswersChange]);

  const byExperiment = useMemo(() => {
    const groups = new Map<string, PlanQuestionEntry[]>();
    for (const entry of questions) {
      const group = groups.get(entry.experimentName) ?? [];
      group.push(entry);
      groups.set(entry.experimentName, group);
    }
    return [...groups.entries()];
  }, [questions]);

  const isAnswered = (entry: PlanQuestionEntry) =>
    (values[entry.question.id] ?? "") !== "" || entry.question.answer !== null;

  const required = questions.filter((entry) => entry.question.required);
  const answeredRequired = required.filter(isAnswered).length;

  function renderExperimentGroup([experimentName, entries]: [string, PlanQuestionEntry[]]) {
    const groupRequired = entries.filter((entry) => entry.question.required);
    const groupAnswered = groupRequired.filter(isAnswered).length;

    return (
      <section key={experimentName} className="space-y-3">
        <div className="flex items-baseline justify-between gap-3 border-b pb-1.5">
          <h3 className="text-sm font-medium">{experimentName}</h3>
          {groupRequired.length > 0 && (
            <span className="text-muted-foreground text-xs tabular-nums">
              {t("iot.onboarding.answeredOfRequired", {
                answered: groupAnswered,
                required: groupRequired.length,
              })}
            </span>
          )}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {entries.map((entry) => (
            <DevicePlanQuestionField
              key={entry.question.id}
              question={entry.question}
              control={control}
            />
          ))}
        </div>
      </section>
    );
  }

  return (
    <SettingsCard
      title={t("iot.onboarding.questionsTitle")}
      description={t("iot.onboarding.questionsDescription")}
      action={
        required.length > 0 ? (
          <span className="flex items-center gap-2">
            <Progress value={(answeredRequired / required.length) * 100} className="h-2 w-24" />
            <span className="text-muted-foreground text-xs tabular-nums">
              {t("iot.onboarding.answeredOfRequired", {
                answered: answeredRequired,
                required: required.length,
              })}
            </span>
          </span>
        ) : undefined
      }
      contentClassName="space-y-6"
    >
      {byExperiment.map(renderExperimentGroup)}
    </SettingsCard>
  );
}
