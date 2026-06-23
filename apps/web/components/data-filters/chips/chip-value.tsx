"use client";

import type { ExperimentDataFilter } from "@repo/api/domains/experiment/experiment.schema";
import { useTranslation } from "@repo/i18n";
import { cn } from "@repo/ui/lib/utils";

import { formatYmdHm } from "../../../util/date";
import { ContributorChipValue } from "./contributor-chip-value";

const NO_VALUE = "—";
const INLINE_LIST_MAX = 2;

export interface ChipValueProps {
  filter: ExperimentDataFilter;
  isContributor: boolean;
  fullWidth: boolean;
  parentColumn: string;
  experimentId?: string;
  tableName?: string;
}

export function ChipValue({
  filter,
  isContributor,
  fullWidth,
  parentColumn,
  experimentId,
  tableName,
}: ChipValueProps) {
  const { t } = useTranslation("common");
  const className = cn(
    "text-foreground/80 truncate",
    fullWidth ? "min-w-0 flex-1 text-left" : "max-w-[16ch]",
  );

  if (isContributor) {
    return (
      <ContributorChipValue
        filterValue={filter.value}
        parentColumn={parentColumn}
        experimentId={experimentId}
        tableName={tableName}
        className={className}
      />
    );
  }

  const display = formatFilterDisplay(filter, (count) => t("dataFilters.selectedCount", { count }));
  return <span className={className}>{display}</span>;
}

function formatFilterDisplay(
  filter: ExperimentDataFilter,
  summarizeCount: (count: number) => string,
): string {
  const { value, operator } = filter;
  const isRange = operator === "between" && Array.isArray(value) && value.length === 2;
  if (isRange) {
    return `${formatScalar(value[0])} → ${formatScalar(value[1])}`;
  }
  if (!Array.isArray(value)) {
    return formatScalar(value);
  }
  if (value.length === 0) {
    return NO_VALUE;
  }
  if (value.length <= INLINE_LIST_MAX) {
    return value.map(formatScalar).join(", ");
  }
  return summarizeCount(value.length);
}

function formatScalar(value: unknown): string {
  if (value === null || value === undefined || value === "") {
    return NO_VALUE;
  }
  if (typeof value === "string") {
    return tryFormatIsoDateTime(value) ?? value;
  }
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value);
  }
  return JSON.stringify(value);
}

function tryFormatIsoDateTime(value: string): string | null {
  const looksLikeIsoDateTime =
    value.length >= 11 && value[4] === "-" && value[7] === "-" && value[10] === "T";
  if (!looksLikeIsoDateTime) {
    return null;
  }
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) {
    return null;
  }
  return formatYmdHm(parsed);
}
