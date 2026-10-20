"use client";

import { StatusBadge } from "@/components/shared/status-badge";
import { useParams } from "next/navigation";

import type { StandardId } from "@repo/api/domains/experiment/standards/experiment-standards.schema";
import { useTranslation } from "@repo/i18n";

import { useReadinessOverview } from "../readiness-steps";

/** On an undescribed column: each destination that waits for columns to be described. */
export function ColumnReadinessChips() {
  const { t } = useTranslation("readinessConceptC");
  const { id } = useParams<{ id: string }>();
  const overview = useReadinessOverview(id);
  const step = overview?.steps.find((candidate) => candidate.action === "describe-columns");

  const renderChip = (standard: StandardId) => (
    <StatusBadge key={standard} tone="featured">
      {t(`column.needs.${standard}`)}
    </StatusBadge>
  );

  return <span className="inline-flex flex-wrap gap-1">{step?.standards.map(renderChip)}</span>;
}
