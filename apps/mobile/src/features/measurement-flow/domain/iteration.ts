import type { FlowNode, QuestionContent } from "~/shared/measurements/flow-node";

// Pure iteration rules: which answers carry into a new iteration and whether
// a question step advances on its own. The workbook flow store reads the
// answers store once, passes snapshots in, and applies the returned seeds.

export interface AnswersSnapshot {
  answersHistory: Record<string, string>[];
  autoincrementSettings: Record<string, boolean>;
  rememberAnswerSettings: Record<string, boolean>;
}

export interface AnswerSeed {
  cycle: number;
  name: string;
  value: string;
}

function answerOf(answers: AnswersSnapshot, cycle: number, name: string): string | undefined {
  return answers.answersHistory[cycle]?.[name];
}

function isAutoincrementEnabled(answers: AnswersSnapshot, name: string): boolean {
  return answers.autoincrementSettings[name] ?? false;
}

function isRememberEnabled(answers: AnswersSnapshot, name: string): boolean {
  return answers.rememberAnswerSettings[name] ?? false;
}

export type AutoAdvanceDecision =
  /** The question needs manual input; the flow parks on it. */
  | { kind: "park" }
  /** Commit this value and move on (auto-increment/remembered with a value). */
  | { kind: "commit"; value: string }
  /** Skip without an answer (optional auto question with nothing to carry). */
  | { kind: "skip" };

/**
 * Whether a question the flow just landed on advances by itself. Questions
 * with auto-increment or remember enabled pass through, unless they are
 * required and still have no value for this iteration.
 */
export function autoAdvanceDecision(args: {
  questionId: string;
  required: boolean;
  iterationCount: number;
  answers: AnswersSnapshot;
}): AutoAdvanceDecision {
  const { questionId, required, iterationCount, answers } = args;
  const isAutoOrRemember =
    isAutoincrementEnabled(answers, questionId) || isRememberEnabled(answers, questionId);
  if (!isAutoOrRemember) return { kind: "park" };
  const value = answerOf(answers, iterationCount, questionId);
  if (value?.trim()) return { kind: "commit", value };
  return required ? { kind: "park" } : { kind: "skip" };
}

// Seed produced by committing `answerValue` on `node`: auto-increment rotates
// a multi_choice to its next option, remember copies the value, both into
// the NEXT iteration. Null when nothing should carry.
export function seedNextIterationAnswer(args: {
  node: FlowNode;
  answerValue: string;
  iterationCount: number;
  answers: AnswersSnapshot;
}): AnswerSeed | null {
  const { node, answerValue, iterationCount, answers } = args;
  const content = node.content;
  if (content.kind === "multi_choice") {
    if (isAutoincrementEnabled(answers, node.id) && answerValue) {
      const options: string[] = content.options ?? [];
      const currentIndex = options.indexOf(answerValue);
      const nextIndex = (currentIndex + 1) % options.length;
      return { cycle: iterationCount + 1, name: node.id, value: options[nextIndex] };
    }
    return null;
  }
  if (isRememberEnabled(answers, node.id) && answerValue) {
    return { cycle: iterationCount + 1, name: node.id, value: answerValue };
  }
  return null;
}

// On entering iteration `iterationCount`, carry forward remembered /
// auto-incremented answers from the previous iteration. Values are stored
// trimmed; existing non-blank answers are kept.
export function carryForwardAnswers(args: {
  flowNodes: FlowNode[];
  iterationCount: number;
  answers: AnswersSnapshot;
}): AnswerSeed[] {
  const { flowNodes, iterationCount, answers } = args;
  const seeds: AnswerSeed[] = [];

  for (const node of flowNodes) {
    if (node.type !== "question") continue;
    const content = node.content as QuestionContent | undefined;
    if (!content) continue;
    if (answerOf(answers, iterationCount, node.id)?.trim()) continue;

    const previous = answerOf(answers, iterationCount - 1, node.id)?.trim();
    if (!previous) continue;

    if (content.kind === "multi_choice" && isAutoincrementEnabled(answers, node.id)) {
      const options = content.options ?? [];
      if (!options.length) continue;
      const idx = options.indexOf(previous);
      if (idx < 0) continue;
      seeds.push({
        cycle: iterationCount,
        name: node.id,
        value: options[(idx + 1) % options.length],
      });
      continue;
    }

    if (isRememberEnabled(answers, node.id)) {
      seeds.push({ cycle: iterationCount, name: node.id, value: previous });
    }
  }

  return seeds;
}

// The AutoProceededSummary banner anchors to the first question that is
// neither auto-incremented nor remembered at the start of an iteration.
export function firstManualQuestionNodeId(
  flowNodes: FlowNode[],
  answers: AnswersSnapshot,
): string | undefined {
  return flowNodes.find(
    (n) =>
      n.type === "question" &&
      !isAutoincrementEnabled(answers, n.id) &&
      !isRememberEnabled(answers, n.id),
  )?.id;
}
