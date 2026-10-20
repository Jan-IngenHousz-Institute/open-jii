"use client";

import { PageLoading } from "@/components/shared/page-loading";
import { useExperimentStandardsFields } from "~/hooks/experiment/useExperimentStandardsFields/useExperimentStandardsFields";

import type {
  StandardField,
  StandardId,
} from "@repo/api/domains/experiment/standards/experiment-standards.schema";
import { useTranslation } from "@repo/i18n";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@repo/ui/components/sheet";

import { StandardFieldSection } from "./standard-field-section";

/** Fields in the order the standard lists them, gathered under their sections. */
function groupBySection(fields: StandardField[]): [string, StandardField[]][] {
  const sections = new Map<string, StandardField[]>();
  for (const field of fields) {
    sections.set(field.section, [...(sections.get(field.section) ?? []), field]);
  }
  return [...sections.entries()];
}

interface StandardFieldsSheetProps {
  experimentId: string;
  standard: StandardId;
  onClose: () => void;
}

/** The field-by-field panel: every field one standard wants, filled or with what fills it. */
export function StandardFieldsSheet({ experimentId, standard, onClose }: StandardFieldsSheetProps) {
  const { t } = useTranslation("standards");
  const { data } = useExperimentStandardsFields(experimentId, standard);

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      onClose();
    }
  };

  const renderSection = ([section, fields]: [string, StandardField[]]) => (
    <StandardFieldSection
      key={section}
      experimentId={experimentId}
      section={section}
      fields={fields}
    />
  );

  return (
    <Sheet open onOpenChange={handleOpenChange}>
      <SheetContent side="right" className="sm:max-w-120 flex w-full flex-col gap-0 p-0">
        <SheetHeader className="border-border border-b px-6 py-4">
          <SheetTitle>{t(`standard.${standard}.name`)}</SheetTitle>
          <SheetDescription>
            {data && t("panel.filledCount", { filled: data.filled, total: data.total })}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-6">
          {data ? groupBySection(data.fields).map(renderSection) : <PageLoading />}
        </div>
      </SheetContent>
    </Sheet>
  );
}
