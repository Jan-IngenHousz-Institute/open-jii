import React from "react";

import { useTranslation } from "@repo/i18n";
import { Card, CardContent } from "@repo/ui/components";

import { BooleanAnswerDisplay } from "../boolean-answer-display";
import { NumberAnswerDisplay } from "../number-answer-display";
import { SelectOptionsEditor } from "../select-options-editor";
import { TextAnswerDisplay } from "../text-answer-display";

// Local UI-focused question spec (legacy bridge). Replace with backend question content mapping later.
export interface QuestionUI {
  answerType: "TEXT" | "SELECT" | "NUMBER" | "BOOLEAN";
  validationMessage?: string;
  options?: string[];
  required: boolean;
}

interface QuestionCardProps {
  stepSpecification: QuestionUI;
  onUpdateText?: (text: string) => void;
  onUpdateAnswerType?: (answerType: QuestionUI["answerType"]) => void;
  onToggleRequired?: () => void;
  onAddOption?: () => void;
  onUpdateOption?: (optionIndex: number, text: string) => void;
  onDeleteOption?: (optionIndex: number) => void;
  onBulkAddOptions?: (options: string[]) => void;
  onDeleteAllOptions?: () => void;
  disabled?: boolean;
}

export function QuestionCard({
  stepSpecification,
  onUpdateText,
  onUpdateAnswerType,
  onToggleRequired,
  onAddOption,
  onUpdateOption,
  onDeleteOption,
  onBulkAddOptions,
  onDeleteAllOptions,
  disabled = false,
}: QuestionCardProps) {
  const { answerType, validationMessage, options, required } = stepSpecification;
  const { t } = useTranslation(["experiments"]);

  return (
    <Card className="group relative overflow-hidden border border-gray-200 bg-white shadow-sm transition-all hover:border-gray-300 hover:shadow-lg">
      {/* Subtle accent line */}
      <div className="from-jii-dark-green to-jii-medium-green absolute left-0 top-0 h-full w-1 bg-gradient-to-b"></div>

      <CardContent className="p-6 pl-8">
        {/* Question Input */}
        <div className="mb-6">
          <input
            type="text"
            value={validationMessage ?? ""}
            onChange={(e) => onUpdateText?.(e.target.value)}
            placeholder={t("questionCard.placeholder")}
            disabled={disabled}
            className="focus:border-jii-dark-green w-full border-0 border-b-2 border-gray-100 bg-transparent px-0 py-3 text-lg font-medium text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-0 disabled:cursor-not-allowed disabled:bg-gray-50"
          />
        </div>

        {/* Required Toggle */}
        <div className="mb-6">
          <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 p-4">
            <div>
              <p className="text-sm font-medium text-gray-900">{t("questionCard.requiredLabel")}</p>
              <p className="text-xs text-gray-500">{t("questionCard.requiredDescription")}</p>
            </div>
            <label className="relative inline-flex cursor-pointer items-center">
              <input
                type="checkbox"
                checked={required}
                onChange={onToggleRequired}
                disabled={disabled}
                className="peer sr-only"
              />
              <div className="peer-checked:bg-jii-dark-green peer-focus:ring-jii-dark-green/20 peer h-6 w-11 rounded-full bg-gray-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none peer-focus:ring-4"></div>
            </label>
          </div>
        </div>

        {/* Question Type Selection */}
        <div className="mb-6">
          <div className="mb-3 flex items-center gap-2">
            <div className="h-1 w-1 rounded-full bg-gray-400"></div>
            <span className="text-sm font-medium text-gray-600">
              {t("questionCard.answerTypeLabel")}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {["TEXT", "SELECT", "NUMBER", "BOOLEAN"].map((type) => (
              <label key={type} className="flex cursor-pointer items-center gap-3">
                <input
                  type="radio"
                  name="answer-type"
                  checked={answerType === type}
                  onChange={() => onUpdateAnswerType?.(type as QuestionUI["answerType"])}
                  disabled={disabled}
                  className="peer sr-only"
                />
                <div className="peer-checked:border-jii-dark-green peer-checked:bg-jii-dark-green peer-focus:ring-jii-dark-green/20 relative h-4 w-4 shrink-0 rounded-full border-2 border-gray-300 bg-white transition-all peer-focus:ring-2">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="h-1.5 w-1.5 rounded-full bg-white opacity-0 transition-opacity peer-checked:opacity-100"></div>
                  </div>
                </div>
                <span className="text-sm font-medium text-gray-700">
                  {t(`questionCard.answerTypes.${type}`)}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Answer Type Specific Content */}
        {answerType === "SELECT" && (
          <SelectOptionsEditor
            options={options}
            onAddOption={onAddOption}
            onUpdateOption={onUpdateOption}
            onDeleteOption={onDeleteOption}
            onBulkAddOptions={onBulkAddOptions}
            onDeleteAllOptions={onDeleteAllOptions}
            disabled={disabled}
          />
        )}

        {answerType === "TEXT" && <TextAnswerDisplay />}

        {answerType === "NUMBER" && <NumberAnswerDisplay />}

        {answerType === "BOOLEAN" && <BooleanAnswerDisplay />}
      </CardContent>
    </Card>
  );
}
