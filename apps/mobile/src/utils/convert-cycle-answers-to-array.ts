import { FlowNode } from "~/screens/measurement-flow-screen/types";

export interface AnswerData {
  question_label: string;
  question_text: string;
  question_answer: string;
}

export function convertCycleAnswersToArray(
  cycleAnswers: Record<string, string> | undefined,
  flowNodes: FlowNode[],
): AnswerData[] {
  if (!cycleAnswers) {
    return [];
  }

  const rows: AnswerData[] = [];
  for (const [nodeId, questionAnswer] of Object.entries(cycleAnswers)) {
    const matchingNode = flowNodes.find((n) => n.id === nodeId);
    if (!matchingNode) {
      continue;
    }

    const questionText = matchingNode.content?.text ?? "question text";
    rows.push({
      question_label: matchingNode.name,
      question_text: questionText,
      question_answer: questionAnswer,
    });
  }
  return rows;
}
