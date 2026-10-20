"use client";

import { useTranslation } from "@repo/i18n";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@repo/ui/components/sheet";

import type { ReadinessOverview, ReadinessStep } from "../readiness-steps";
import { ReadinessStepRow } from "./readiness-step-row";
import { useReadinessSentence } from "./use-readiness-sentence";

interface ReadinessStepsSheetProps {
  experimentId: string;
  overview: ReadinessOverview;
  onClose: () => void;
}

/** Behind the strip: every step left, each with the page where it is done. */
export function ReadinessStepsSheet({ experimentId, overview, onClose }: ReadinessStepsSheetProps) {
  const { t } = useTranslation("readinessConceptC");
  const { ready, remaining } = useReadinessSentence(overview);
  const summary = ready ? `${ready} ${remaining}` : remaining;

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      onClose();
    }
  };

  const renderStep = (step: ReadinessStep, index: number) => (
    <ReadinessStepRow
      key={step.action}
      experimentId={experimentId}
      step={step}
      position={index + 1}
      onFollow={onClose}
    />
  );

  return (
    <Sheet open onOpenChange={handleOpenChange}>
      <SheetContent side="right" className="sm:max-w-120 flex w-full flex-col gap-0 p-0">
        <SheetHeader className="border-border border-b px-6 py-4">
          <SheetTitle>{t("sheet.title")}</SheetTitle>
          <SheetDescription>{summary}</SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          <ol className="divide-y rounded-md border">{overview.steps.map(renderStep)}</ol>
        </div>
      </SheetContent>
    </Sheet>
  );
}
