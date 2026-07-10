import type { FlowNode, QuestionContent } from "~/shared/measurements/flow-node";

// Pure iteration rules: which answers carry into a new iteration and which
// step needs manual input next. Callers (flow-actions, use-iteration-state-
// sync) read the stores once, pass snapshots in, and apply the returned
// seeds via the answers store.

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

/**
 * Returns the index of the next step after `fromIndex` that needs manual input.
 * Skips:
 * - instruction steps on iterations > 0
 * - question steps with auto-increment or remember enabled,
 *   unless the question is required and has no value yet
 * Returns `flowNodes.length` if no mandatory step remains.
 */
export function findNextMandatoryStep(args: {
  fromIndex: number;
  flowNodes: FlowNode[];
  iterationCount: number;
  answers: AnswersSnapshot;
}): number {
  const { fromIndex, flowNodes, iterationCount, answers } = args;
  for (let i = fromIndex + 1; i < flowNodes.length; i++) {
    const node = flowNodes[i];
    if (node.type === "instruction" && iterationCount > 0) continue;
    if (node.type === "question") {
      const isAutoOrRemember =
        isAutoincrementEnabled(answers, node.id) || isRememberEnabled(answers, node.id);
      const hasValue = !!answerOf(answers, iterationCount, node.id)?.trim();
      if (isAutoOrRemember && (!node.content.required || hasValue)) continue;
    }
    return i;
  }
  return flowNodes.length;
}

// Seed produced by committing `answerValue` on `node`: auto-increment rotates
// a multi_choice to its next option, remember copies the value; both into
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
      // Unknown/stale value: keep the manual answer rather than jumping to
      // options[0]. Mirrors the idx<0 skip in carryForwardAnswers.
      if (currentIndex < 0) return null;
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
