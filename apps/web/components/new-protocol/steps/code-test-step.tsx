"use client";

import { CodeTesterLayout } from "@/components/shared/code-tester-layout";
import type { ComponentType } from "react";

import type { CreateProtocolRequestBody, SensorFamily } from "@repo/api";
import { zCreateProtocolRequestBody } from "@repo/api";
import { useTranslation } from "@repo/i18n";
import { FormField } from "@repo/ui/components/form";
import { WizardStepButtons } from "@repo/ui/components/wizard-form";
import type { WizardStepProps } from "@repo/ui/components/wizard-form";

// Validation schema for step 2 — code only
export const codeSchema = zCreateProtocolRequestBody.pick({ code: true });

interface CodeTestStepProps extends WizardStepProps<CreateProtocolRequestBody> {
  browserSupport: { bluetooth: boolean; serial: boolean; any: boolean };
  setIsCodeValid: (v: boolean) => void;
  ProtocolCodeEditor: ComponentType<{
    value: Record<string, unknown>[];
    onChange: (v: Record<string, unknown>[] | string | undefined) => void;
    onValidationChange: (v: boolean) => void;
    label: string;
    placeholder: string;
    error?: string;
    height: string;
    borderless: boolean;
  }>;
  IotProtocolRunner: ComponentType<{
    protocolCode: Record<string, unknown>[];
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
  ProtocolCodeEditor,
  IotProtocolRunner,
}: CodeTestStepProps) {
  const { t } = useTranslation();

  const codeEditorContent = (
    <FormField
      control={form.control}
      name="code"
      render={({ field }) => (
        <ProtocolCodeEditor
          value={field.value}
          onChange={(val) => {
            // Don't let undefined propagate — keep last valid value.
            // The editor handles its own validation display in the header.
            if (val !== undefined) field.onChange(val);
          }}
          onValidationChange={setIsCodeValid}
          label=""
          placeholder={t("newProtocol.codePlaceholder")}
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
          <IotProtocolRunner
            protocolCode={form.watch("code")}
            sensorFamily={form.watch("family")}
            layout="vertical"
          />
        }
        testerTitle={t("newProtocol.testerTitle")}
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
