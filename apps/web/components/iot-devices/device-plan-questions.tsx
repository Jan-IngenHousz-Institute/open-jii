"use client";

import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";

import type { DeviceAnswer } from "@repo/api/domains/iot/iot.schema";
import { useTranslation } from "@repo/i18n";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@repo/ui/components/accordion";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";
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
 * Measurement answers, grouped per experiment in an accordion that starts
 * fully open: the grouping is orientation, never a place to hide required
 * fields. The title carries a live completion count so the state of the whole
 * card is readable without scrolling it.
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
      <AccordionItem key={experimentName} value={experimentName}>
        <AccordionTrigger className="text-sm font-medium">
          <span className="flex flex-1 items-center justify-between gap-3 pr-2">
            {experimentName}
            {groupRequired.length > 0 && (
              <span className="text-muted-foreground text-xs font-normal tabular-nums">
                {t("iot.onboarding.answeredOfRequired", {
                  answered: groupAnswered,
                  required: groupRequired.length,
                })}
              </span>
            )}
          </span>
        </AccordionTrigger>
        <AccordionContent>
          <div className="divide-y rounded-lg border">
            {entries.map((entry) => (
              <DevicePlanQuestionField
                key={entry.question.id}
                experimentName={entry.experimentName}
                question={entry.question}
                control={control}
              />
            ))}
          </div>
        </AccordionContent>
      </AccordionItem>
    );
  }

  return (
    <Card className="shadow-none">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-base">{t("iot.onboarding.questionsTitle")}</CardTitle>
          {required.length > 0 && (
            <span className="flex items-center gap-2">
              <Progress value={(answeredRequired / required.length) * 100} className="h-2 w-24" />
              <span className="text-muted-foreground text-xs tabular-nums">
                {t("iot.onboarding.answeredOfRequired", {
                  answered: answeredRequired,
                  required: required.length,
                })}
              </span>
            </span>
          )}
        </div>
        <CardDescription>{t("iot.onboarding.questionsDescription")}</CardDescription>
      </CardHeader>
      <CardContent>
        <Accordion
          type="multiple"
          defaultValue={byExperiment.map(([experimentName]) => experimentName)}
        >
          {byExperiment.map(renderExperimentGroup)}
        </Accordion>
      </CardContent>
    </Card>
  );
}
