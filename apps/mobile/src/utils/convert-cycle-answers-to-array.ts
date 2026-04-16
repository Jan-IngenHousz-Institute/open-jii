import { z } from "zod";
import { FlowNode } from "~/screens/measurement-flow-screen/types";

export const answerDataSchema = z.object({
  question_label: z.string(),
  question_text: z.string(),
  question_answer: z.string(),
});

export const measurementResultSchema = z.object({
  questions: z.array(answerDataSchema).optional(),
});

export type AnswerData = z.infer<typeof answerDataSchema>;

export function parseQuestions(measurementResult: unknown): AnswerData[] {
  const parsed = measurementResultSchema.safeParse(measurementResult);
  return parsed.success ? (parsed.data.questions ?? []) : [];
}

export function convertCycleAnswersToArray(
  cycleAnswers: Record<string, string> | undefined,
  flowNodes: FlowNode[],
): AnswerData[] {
  if (!cycleAnswers) {
    return [];
  }

  const rows: AnswerData[] = [];
  for (const node of flowNodes) {
    if (node.type !== "question") continue;
    const questionAnswer = cycleAnswers[node.id];
    if (questionAnswer === undefined) continue;

    const questionText = node.content?.text ?? "question text";
    rows.push({
      question_label: node.name,
      question_text: questionText,
      question_answer: questionAnswer,
    });
  }
  return rows;
}
