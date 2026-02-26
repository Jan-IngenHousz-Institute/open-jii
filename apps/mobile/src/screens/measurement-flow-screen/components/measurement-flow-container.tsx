import React, { useEffect, useRef } from "react";
import { useFlowAnswersStore } from "~/stores/use-flow-answers-store";
import { useMeasurementFlowStore } from "~/stores/use-measurement-flow-store";

import type { FlowNode, QuestionContent } from "../types";
import { ActiveState } from "./flow-states/active-state";
import { CompletedState } from "./flow-states/completed-state";
import { EmptyState } from "./flow-states/empty-state";
import { LoadingState } from "./flow-states/loading-state";
import { QuestionsOverview } from "./flow-states/questions-overview";

export function MeasurementFlowContainer() {
  const {
    flowNodes,
    currentFlowStep,
    isFlowFinished,
    showingOverview,
    returnToOverviewAfterEdit,
    nextStep,
  } = useMeasurementFlowStore();
  const { getAnswer, setAnswer, isAutoincrementEnabled, isRememberAnswerEnabled } =
    useFlowAnswersStore();
  const iterationCount = useMeasurementFlowStore((s) => s.iterationCount);
  const autoSkipSeededRef = useRef<Set<string>>(new Set());

  const isFlowCompleted = currentFlowStep >= flowNodes.length;

  const isFlowInitialized = flowNodes.length > 0;

  const currentNode = flowNodes[currentFlowStep];

  useEffect(() => {
    autoSkipSeededRef.current = new Set();
  }, [iterationCount]);

  useEffect(() => {
    if (iterationCount === 0 || flowNodes.length === 0) return;

    for (const node of flowNodes) {
      if (node.type !== "question") continue;
      const content = node.content as QuestionContent | undefined;
      if (!content) continue;

      const existing = getAnswer(iterationCount, node.id)?.trim();
      if (existing) continue;

      const previous = getAnswer(iterationCount - 1, node.id)?.trim();
      if (!previous) continue;

      if (content.kind === "multi_choice" && isAutoincrementEnabled(node.id)) {
        const options = content.options ?? [];
        if (!options.length) continue;
        const currentIndex = options.indexOf(previous);
        if (currentIndex < 0) continue;
        const nextIndex = (currentIndex + 1) % options.length;
        const nextValue = options[nextIndex];
        setAnswer(iterationCount, node.id, nextValue);
        continue;
      }

      if (isRememberAnswerEnabled(node.id)) {
        setAnswer(iterationCount, node.id, previous);
      }
    }
  }, [
    iterationCount,
    flowNodes,
    getAnswer,
    setAnswer,
    isAutoincrementEnabled,
    isRememberAnswerEnabled,
  ]);

  const seedNextIterationAnswer = (node: FlowNode, answerValue: string) => {
    const content = node.content as QuestionContent | undefined;
    if (!content) return;

    if (content.kind === "multi_choice" && isAutoincrementEnabled(node.id)) {
      const options = content.options ?? [];
      if (!options.length) return;
      const currentIndex = options.indexOf(answerValue);
      if (currentIndex < 0) return;
      const nextIndex = (currentIndex + 1) % options.length;
      const nextValue = options[nextIndex];
      setAnswer(iterationCount + 1, node.id, nextValue);
      return;
    }

    if (isRememberAnswerEnabled(node.id)) {
      setAnswer(iterationCount + 1, node.id, answerValue);
    }
  };

  // Auto-skip a question only when we first land on it and it already has an answer
  // (e.g. from "remember answer" or when revisiting). Do not skip when the user
  // is typing — so we only depend on step/iteration/node, not on currentAnswer.
  useEffect(() => {
    if (showingOverview || returnToOverviewAfterEdit) return;
    if (currentNode?.type !== "question") return;
    const answer = getAnswer(iterationCount, currentNode.id)?.trim();
    if (!answer) return;

    const key = `${iterationCount}-${currentNode.id}`;
    if (!autoSkipSeededRef.current.has(key)) {
      seedNextIterationAnswer(currentNode, answer);
      autoSkipSeededRef.current.add(key);
    }

    nextStep();
  }, [
    currentFlowStep,
    iterationCount,
    currentNode?.id,
    showingOverview,
    returnToOverviewAfterEdit,
    getAnswer,
    setAnswer,
    isAutoincrementEnabled,
    isRememberAnswerEnabled,
    nextStep,
  ]);

  if (!isFlowInitialized) {
    return <LoadingState />;
  }

  if (isFlowCompleted && isFlowFinished) {
    return <CompletedState />;
  }

  if (showingOverview) {
    return <QuestionsOverview />;
  }

  if (!currentNode) {
    return <EmptyState />;
  }

  return <ActiveState currentNode={currentNode} />;
}
