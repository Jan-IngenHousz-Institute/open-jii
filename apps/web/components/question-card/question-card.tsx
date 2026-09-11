import { InsetPanel } from "@/components/shared/inset-panel";
import React from "react";

import { useTranslation } from "@repo/i18n";
import { Card, CardContent } from "@repo/ui/components/card";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import { RadioGroup, RadioGroupItem } from "@repo/ui/components/radio-group";
import { Switch } from "@repo/ui/components/switch";

import { BooleanAnswerDisplay } from "./boolean-answer-display/boolean-answer-display";
import { NumberAnswerDisplay } from "./number-answer-display/number-answer-display";
import { SelectOptionsEditor } from "./select-options-editor/select-options-editor";
import { TextAnswerDisplay } from "./text-answer-display/text-answer-display";

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
    <Card className="shadow-xs border-border bg-card hover:border-border group relative overflow-hidden border transition-all hover:shadow-lg">
      {/* Subtle accent line */}
      <div className="from-primary to-primary/70 absolute left-0 top-0 h-full w-1 bg-gradient-to-b"></div>

      <CardContent className="p-6 pl-8">
        {/* Question Input */}
        <div className="mb-6">
          <Input
            type="text"
            value={validationMessage ?? ""}
            onChange={(e) => onUpdateText?.(e.target.value)}
            placeholder={t("questionCard.placeholder")}
            disabled={disabled}
          />
        </div>

        {/* Required Toggle */}
        <div className="mb-6">
          <InsetPanel padding="lg" className="flex items-center justify-between">
            <div>
              <p className="text-foreground text-sm font-medium">
                {t("questionCard.requiredLabel")}
              </p>
              <p className="text-muted-foreground text-xs">
                {t("questionCard.requiredDescription")}
              </p>
            </div>
            <Switch
              aria-label={t("questionCard.requiredLabel")}
              checked={required}
              onCheckedChange={() => onToggleRequired?.()}
              disabled={disabled}
            />
          </InsetPanel>
        </div>

        {/* Question Type Selection */}
        <div className="mb-6">
          <div className="mb-3 flex items-center gap-2">
            <div className="bg-muted-foreground h-1 w-1 rounded-full"></div>
            <span className="text-muted-foreground text-sm font-medium">
              {t("questionCard.answerTypeLabel")}
            </span>
          </div>
          <RadioGroup
            className="grid-cols-2 gap-3"
            value={answerType}
            onValueChange={(value) => onUpdateAnswerType?.(value as QuestionUI["answerType"])}
            disabled={disabled}
          >
            {["TEXT", "SELECT", "NUMBER", "BOOLEAN"].map((type) => (
              <div key={type} className="flex items-center gap-3">
                <RadioGroupItem value={type} id={`answer-type-${type}`} />
                <Label
                  htmlFor={`answer-type-${type}`}
                  className="text-foreground cursor-pointer text-sm font-medium"
                >
                  {t(`questionCard.answerTypes.${type}`)}
                </Label>
              </div>
            ))}
          </RadioGroup>
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
