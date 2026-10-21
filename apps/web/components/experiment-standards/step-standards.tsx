"use client";

import type { StandardId } from "@repo/api/domains/experiment/standards/experiment-standards.schema";
import { useTranslation } from "@repo/i18n";
import { Badge } from "@repo/ui/components/badge";

interface StepStandardsProps {
  standards: StandardId[];
}

/** The followed standards a step moves, or "Every dataset" for a step that holds them all. */
export function StepStandards({ standards }: StepStandardsProps) {
  const { t } = useTranslation("standards");

  const renderStandard = (standard: StandardId) => (
    <Badge key={standard} variant="secondary" className="font-normal">
      {t(`standard.${standard}.title`)}
    </Badge>
  );

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {standards.length === 0 ? (
        <Badge variant="secondary" className="font-normal">
          {t("stepNote.everyDataset")}
        </Badge>
      ) : (
        standards.map(renderStandard)
      )}
    </div>
  );
}
