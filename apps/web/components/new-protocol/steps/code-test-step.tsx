"use client";

import { MonitorX } from "lucide-react";
import type { ComponentType } from "react";
import { useEffect, useState } from "react";

import type { CreateProtocolRequestBody, SensorFamily } from "@repo/api";
import { zCreateProtocolRequestBody } from "@repo/api";
import { useTranslation } from "@repo/i18n";
import { FormField, WizardStepButtons } from "@repo/ui/components";
import type { WizardStepProps } from "@repo/ui/components";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@repo/ui/components";
import { cn } from "@repo/ui/lib/utils";

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
  const { t: tIot } = useTranslation("iot");

  // Detect mobile viewport for stacked layout
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

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

  const testerContent = browserSupport.any ? (
    <IotProtocolRunner
      protocolCode={form.watch("code")}
      sensorFamily={form.watch("family")}
      layout="vertical"
    />
  ) : (
    <div className="flex h-full items-center justify-center">
      <div className="text-center">
        <MonitorX className="text-muted-foreground mx-auto mb-2 h-6 w-6" />
        <div className="text-muted-foreground text-xs">
          {tIot("iot.protocolRunner.browserNotSupported")}
        </div>
        <div className="text-muted-foreground/60 text-xs">
          {tIot("iot.protocolRunner.tryDifferentBrowser")}
        </div>
      </div>
    </div>
  );

  const testerHeader = (
    <div className="flex w-full items-center border-b px-2.5 py-2.5 sm:px-4">
      <span className="text-sm font-medium">{t("newProtocol.testerTitle")}</span>
    </div>
  );

  return (
    <div className="flex h-[calc(100vh-18rem)] min-h-[400px] flex-col gap-4">
      {isMobile ? (
        <div className="flex flex-1 flex-col gap-4 overflow-auto">
          <div className="min-h-[300px] rounded-lg border">
            <div className="h-full">{codeEditorContent}</div>
          </div>
          <div
            className={cn(
              "flex min-h-0 flex-col overflow-hidden rounded-lg border",
              !browserSupport.any && "bg-muted/30",
            )}
          >
            {testerHeader}
            <div className="flex flex-1 flex-col overflow-y-auto p-2.5">{testerContent}</div>
          </div>
        </div>
      ) : (
        <ResizablePanelGroup direction="horizontal" className="flex-1 rounded-lg border">
          <ResizablePanel defaultSize={browserSupport.any ? 55 : 85} minSize={30}>
            <div className="h-full">{codeEditorContent}</div>
          </ResizablePanel>

          <ResizableHandle withHandle />

          <ResizablePanel
            defaultSize={browserSupport.any ? 30 : 15}
            minSize={browserSupport.any ? 20 : 10}
          >
            <div
              className={cn(
                "flex h-full min-w-0 flex-col overflow-hidden",
                !browserSupport.any && "bg-muted/30",
              )}
            >
              {testerHeader}
              <div className="flex flex-1 flex-col overflow-y-auto p-2.5 sm:p-4">
                {testerContent}
              </div>
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      )}

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
