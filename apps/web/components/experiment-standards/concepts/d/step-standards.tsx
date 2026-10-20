"use client";

import type { ReactNode } from "react";

import type { StandardId } from "@repo/api/domains/experiment/standards/experiment-standards.schema";
import { useTranslation } from "@repo/i18n";
import { Badge } from "@repo/ui/components/badge";

interface StepStandardsProps {
  standards: StandardId[];
  children?: ReactNode;
}

/** The followed standards a step moves, in plain words. */
export function StepStandards({ standards, children }: StepStandardsProps) {
  const { t } = useTranslation("standards");

  const renderStandard = (standard: StandardId) => (
    <Badge key={standard} variant="secondary" className="font-normal">
      {t(`destination.${standard}`)}
    </Badge>
  );

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {standards.map(renderStandard)}
      {children}
    </div>
  );
}
