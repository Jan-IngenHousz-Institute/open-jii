"use client";

import { useColumnMetadata } from "@/hooks/experiment/useColumnMetadata/useColumnMetadata";

import type { ExperimentDataColumn } from "@repo/api/domains/experiment/data/experiment-data.schema";
import type { ExperimentFilterWidget } from "@repo/api/domains/experiment/experiment.schema";

import { parentColumnName } from "../../../data-filters/filter-column-path";
import { operatorsForColumn } from "../../../data-filters/filter-operators";

export interface ResolvedFilterWidgetConfig {
  tableName: string | undefined;
  columnName: string | undefined;
  parentColumn: string | undefined;
  operator: ExperimentFilterWidget["config"]["operator"];
  column: ExperimentDataColumn | undefined;
  operatorLabel: string;
  displayTitle: string | undefined;
  isConfigured: boolean;
}

/**
 * Resolves a filter widget's config against the underlying column metadata.
 * Used by both the editor preview and the runtime view to share lookups,
 * default-title fallback chain, and the `isConfigured` gate.
 */
export function useFilterWidgetConfig(
  widget: ExperimentFilterWidget,
  experimentId: string,
): ResolvedFilterWidgetConfig {
  const { tableName, column: columnName, operator } = widget.config;
  // Metadata is keyed by parent name; widget.config.column may carry a struct path.
  const parentColumn = columnName ? parentColumnName(columnName) : undefined;

  const { columns } = useColumnMetadata(experimentId, tableName);
  const column = columns.find((c) => c.name === parentColumn);

  const operatorLabel = operator
    ? (operatorsForColumn(column).find((o) => o.value === operator)?.label ?? operator)
    : "";

  const displayTitle = widget.config.title ?? parentColumn ?? columnName;
  const isConfigured = Boolean(tableName && columnName && operator);

  return {
    tableName,
    columnName,
    parentColumn,
    operator,
    column,
    operatorLabel,
    displayTitle,
    isConfigured,
  };
}
