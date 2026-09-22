"use client";

import type { Control } from "react-hook-form";
import { Controller } from "react-hook-form";

import type { DeviceProcedure } from "@repo/api/domains/iot/iot.schema";
import { useTranslation } from "@repo/i18n";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";

export type DevicePlanQuestion = Extract<DeviceProcedure, { type: "question" }>;

interface DevicePlanQuestionFieldProps {
  question: DevicePlanQuestion;
  control: Control<Record<string, string>>;
}

export function DevicePlanQuestionField({ question, control }: DevicePlanQuestionFieldProps) {
  const { t } = useTranslation("iot");

  const options =
    question.kind === "multi_choice"
      ? (question.options ?? [])
      : question.kind === "yes_no"
        ? [t("iot.onboarding.answerYes"), t("iot.onboarding.answerNo")]
        : null;

  return (
    <div className="space-y-1.5">
      <Label htmlFor={`plan-q-${question.id}`} className="text-sm">
        {question.text}
        {question.required && <span className="text-destructive"> *</span>}
      </Label>
      <Controller
        name={question.id}
        control={control}
        render={({ field }) =>
          options ? (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger id={`plan-q-${question.id}`} className="w-full">
                <SelectValue placeholder={t("iot.onboarding.answerPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {options.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input
              id={`plan-q-${question.id}`}
              type={question.kind === "number" ? "number" : "text"}
              value={field.value}
              onChange={field.onChange}
              placeholder={t("iot.onboarding.answerPlaceholder")}
            />
          )
        }
      />
    </div>
  );
}
