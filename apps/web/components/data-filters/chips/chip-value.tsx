"use client";

import type { ExperimentRelativeTimeWindow } from "@repo/api/domains/experiment/data/experiment-data.schema";
import type { ExperimentDataFilter } from "@repo/api/domains/experiment/data/experiment-data.schema";
import { isRelativeTimeWindow } from "@repo/api/transforms/relative-time-filter";
import { useTranslation } from "@repo/i18n";
import { cn } from "@repo/ui/lib/utils";

import { formatYmdHm } from "../../../util/date";
import { RollingRangeLabel } from "../rolling-range-label";
import { useFilterEvaluationTime } from "../use-filter-evaluation-time";
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
  const relative = isRelativeTimeWindow(filter.value) ? filter.value : undefined;
  const className = cn(
    "text-foreground/80 truncate",
    fullWidth ? "min-w-0 flex-1 text-left" : "max-w-[16ch]",
  );

  if (relative) {
    return (
      <RelativeChipValue
        value={relative}
        experimentId={experimentId}
        tableName={tableName}
        column={filter.column}
      />
    );
  }

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

function RelativeChipValue({
  value,
  experimentId,
  tableName,
  column,
}: {
  value: ExperimentRelativeTimeWindow;
  experimentId?: string;
  tableName?: string;
  column: string;
}) {
  const evaluation = useFilterEvaluationTime(experimentId, tableName, column, value);
  return <RollingRangeLabel window={value} evaluation={evaluation} compact />;
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
