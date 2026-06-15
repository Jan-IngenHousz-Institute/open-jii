import type { UseFormReturn } from "react-hook-form";

import type { ChartFormValues } from "./chart-config";
import { dataSourcesByRole } from "./data/data-sources";

// Shared `visible(form)` predicates used by style-shelf definitions
// across line / bar / area / scatter / bubble. Live here so a behavior
// tweak (e.g. accepting blank-string error columns) lands everywhere.

export function hasTraceType(form: UseFormReturn<ChartFormValues>, traceType: string): boolean {
  const sources = form.getValues("dataConfig.dataSources");
  return dataSourcesByRole(sources, "y").some((entry) => entry.source.traceType === traceType);
}

export function hasAnyErrorColumn(form: UseFormReturn<ChartFormValues>): boolean {
  const sources = form.getValues("dataConfig.dataSources");
  // Renderer only honors Y-role errorColumn, so gate the shelf on Y too.
  return dataSourcesByRole(sources, "y").some(
    ({ source }) => typeof source.errorColumn === "string" && source.errorColumn.length > 0,
  );
}

export function hasFacetSource(form: UseFormReturn<ChartFormValues>): boolean {
  const sources = form.getValues("dataConfig.dataSources");
  return sources.some(
    (ds) => ds.role === "facet" && typeof ds.columnName === "string" && ds.columnName.length > 0,
  );
}
