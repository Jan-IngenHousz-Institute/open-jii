import React from "react";

import type { QuestionStep } from "@repo/api";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components";

import { QuestionCard } from "../question-card";

interface QuestionPanelProps {
  stepSpecification: QuestionStep;
  onChange: (spec: QuestionStep) => void;
}

export function QuestionPanel({ stepSpecification, onChange }: QuestionPanelProps) {
  // Handler functions for the step specification
  const updateQuestionText = (text: string) => {
    onChange({
      ...stepSpecification,
      validationMessage: text,
    });
  };

  const updateAnswerType = (answerType: QuestionStep["answerType"]) => {
    const updatedSpec: QuestionStep = {
      ...stepSpecification,
      answerType,
    };

    // Clear options if not SELECT type
    if (answerType !== "SELECT") {
      delete updatedSpec.options;
    } else {
      // Initialize with empty options for SELECT type
      updatedSpec.options = stepSpecification.options ?? [];
    }

    onChange(updatedSpec);
  };

  const toggleRequired = () => {
    onChange({
      ...stepSpecification,
      required: !stepSpecification.required,
    });
  };

  const addOption = () => {
    if (stepSpecification.answerType === "SELECT") {
      onChange({
        ...stepSpecification,
        options: [...(stepSpecification.options ?? []), ""],
      });
    }
  };

  const updateOption = (optionIndex: number, text: string) => {
    if (stepSpecification.answerType === "SELECT" && stepSpecification.options) {
      onChange({
        ...stepSpecification,
        options: stepSpecification.options.map((option, i) => (i === optionIndex ? text : option)),
      });
    }
  };

  const deleteOption = (optionIndex: number) => {
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
          />
        </div>
      </CardContent>
    </Card>
  );
}
