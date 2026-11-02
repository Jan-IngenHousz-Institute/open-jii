import { z } from "zod";
import { FlowNode } from "~/shared/measurements/flow-node";

import {
  zMeasurementQuestion,
  zMeasurementQuestionKind,
} from "@repo/api/domains/experiment/measurement-question.schema";
import { isNumberAnswer } from "@repo/api/transforms/number-answer";

export const answerDataSchema = zMeasurementQuestion;

export const measurementResultSchema = z.object({
  questions: z.array(answerDataSchema).optional(),
});

export type AnswerData = z.infer<typeof answerDataSchema>;

export function answeredQuestions(questions: readonly AnswerData[] = []): AnswerData[] {
  return questions.filter((question) => question.question_answer?.trim());
}

export function parseQuestions(measurementResult: unknown): AnswerData[] {
  const parsed = measurementResultSchema.safeParse(measurementResult);
  return parsed.success ? (parsed.data.questions ?? []) : [];
}

export function convertCycleAnswersToArray(
  cycleAnswers: Record<string, string> | undefined,
  flowNodes: FlowNode[],
): AnswerData[] {
  const rows: AnswerData[] = [];
  for (const node of flowNodes) {
    if (node.type !== "question") continue;
    const questionAnswer = cycleAnswers?.[node.id];

    const questionText = node.content?.text ?? "question text";
    const kind = zMeasurementQuestionKind.safeParse(node.content?.kind);
    rows.push({
      question_label: node.name,
      question_text: questionText,
      ...(kind.success ? { question_kind: kind.data } : {}),
      question_answer:
        questionAnswer?.trim() &&
        (node.content?.kind !== "number" || isNumberAnswer(questionAnswer))
          ? questionAnswer
          : null,
    });
  }
  return rows;
}
