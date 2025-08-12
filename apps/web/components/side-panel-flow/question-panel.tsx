import React from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components";

import type { QuestionUI } from "../question-card";
import { QuestionCard } from "../question-card";

interface QuestionPanelProps {
  stepSpecification: QuestionUI;
  onChange: (spec: QuestionUI) => void;
  disabled?: boolean;
}

export function QuestionPanel({
  stepSpecification,
  onChange,
  disabled = false,
}: QuestionPanelProps) {
  // Handler functions for the step specification
  const updateQuestionText = (text: string) => {
    if (disabled) return;
    onChange({ ...stepSpecification, validationMessage: text });
  };

  const updateAnswerType = (answerType: QuestionUI["answerType"]) => {
    if (disabled) return;
    const updatedSpec: QuestionUI = { ...stepSpecification, answerType };
    if (answerType !== "SELECT") {
      // remove options if switching away
      if (updatedSpec.options) delete updatedSpec.options;
    } else {
      updatedSpec.options = stepSpecification.options ?? [];
    }
    onChange(updatedSpec);
  };

  const toggleRequired = () => {
    if (disabled) return;
    onChange({ ...stepSpecification, required: !stepSpecification.required });
  };

  const addOption = () => {
    if (disabled) return;
    if (stepSpecification.answerType === "SELECT") {
      onChange({
        ...stepSpecification,
        options: [...(stepSpecification.options ?? []), ""],
      });
    }
  };

  const updateOption = (optionIndex: number, text: string) => {
    if (disabled) return;
    if (stepSpecification.answerType === "SELECT" && stepSpecification.options) {
      onChange({
        ...stepSpecification,
        options: stepSpecification.options.map((option, i) => (i === optionIndex ? text : option)),
      });
    }
  };

  const deleteOption = (optionIndex: number) => {
    if (disabled) return;
    if (stepSpecification.answerType === "SELECT" && stepSpecification.options) {
      onChange({
        ...stepSpecification,
        options: stepSpecification.options.filter((_, i) => i !== optionIndex),
      });
    }
  };

  return (
    <Card className="mt-6">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-jii-dark-green">Question</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <QuestionCard
            stepSpecification={stepSpecification}
            onUpdateText={updateQuestionText}
            onUpdateAnswerType={updateAnswerType}
            onToggleRequired={toggleRequired}
            onAddOption={addOption}
            onUpdateOption={updateOption}
            onDeleteOption={deleteOption}
            disabled={disabled}
          />
        </div>
      </CardContent>
    </Card>
  );
}
