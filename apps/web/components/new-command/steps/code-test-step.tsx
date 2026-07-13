"use client";

import { CodeTesterLayout } from "@/components/shared/code-tester-layout";
import type { ComponentType } from "react";

import type { CreateCommandRequestBody, SensorFamily } from "@repo/api/schemas/command.schema";
import { zCreateCommandRequestBody } from "@repo/api/schemas/command.schema";
import { useTranslation } from "@repo/i18n";
import { FormField } from "@repo/ui/components/form";
import { WizardStepButtons } from "@repo/ui/components/wizard-form";
import type { WizardStepProps } from "@repo/ui/components/wizard-form";

// Validation schema for step 2 - code only
export const codeSchema = zCreateCommandRequestBody.pick({ code: true });

interface CodeTestStepProps extends WizardStepProps<CreateCommandRequestBody> {
  browserSupport: { bluetooth: boolean; serial: boolean; any: boolean };
  setIsCodeValid: (v: boolean) => void;
  CommandCodeEditor: ComponentType<{
    value: Record<string, unknown>[];
    onChange: (v: Record<string, unknown>[] | string | undefined) => void;
    onValidationChange: (v: boolean) => void;
    label: string;
    placeholder: string;
    error?: string;
    height: string;
    borderless: boolean;
  }>;
  IotCommandRunner: ComponentType<{
    commandCode: Record<string, unknown>[];
    sensorFamily: SensorFamily;
    layout: "horizontal" | "vertical";
  }>;
}

export function CodeTestStep({
  form,
  onPrevious,
  onNext,
  stepIndex,
  totalSteps,
  isSubmitting = false,
  browserSupport,
  setIsCodeValid,
  CommandCodeEditor,
  IotCommandRunner,
}: CodeTestStepProps) {
  const { t } = useTranslation();

  const codeEditorContent = (
    <FormField
      control={form.control}
      name="code"
      render={({ field }) => (
        <CommandCodeEditor
          value={field.value}
          onChange={(val) => {
            // Don't let undefined propagate - keep last valid value.
            // The editor handles its own validation display in the header.
            if (val !== undefined) field.onChange(val);
          }}
          onValidationChange={setIsCodeValid}
          label=""
          placeholder={t("newCommand.codePlaceholder")}
          height="100%"
          borderless
        />
      )}
    />
  );

  return (
    <div className="flex h-[calc(100vh-18rem)] min-h-[400px] flex-col gap-4">
      <CodeTesterLayout
        codePanel={codeEditorContent}
        testerPanel={
          <IotCommandRunner
            commandCode={form.watch("code")}
            sensorFamily={form.watch("family")}
            layout="vertical"
          />
        }
        testerTitle={t("newCommand.testerTitle")}
        browserSupport={browserSupport}
        testerDefaultSize={30}
      />

      <WizardStepButtons
        onPrevious={onPrevious}
        onNext={onNext}
        stepIndex={stepIndex}
        totalSteps={totalSteps}
        isSubmitting={isSubmitting}
        nextLabel={t("experiments.next")}
        previousLabel={t("experiments.back")}
        submitLabel={t("experiments.next")}
      />
    </div>
  );
}
