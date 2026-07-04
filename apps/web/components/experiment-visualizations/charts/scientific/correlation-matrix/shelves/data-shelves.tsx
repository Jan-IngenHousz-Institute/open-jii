"use client";

import { Variable } from "lucide-react";
import { useEffect, useMemo } from "react";
import { useWatch } from "react-hook-form";

import { filterColumnsForRole } from "@repo/api/domains/experiment/visualizations/experiment-visualization-role-rules";
import { useTranslation } from "@repo/i18n";

import { MultiColumnShelf } from "../../../../workspace/shelves/multi-column-shelf";
import { correlationPairFunctions } from "../../../data/correlation-alias";
import { dataSourcesByRole } from "../../../data/data-sources";
import type { ChartPanelProps, ShelfDef } from "../../../types";

function CorrelationVariablesShelf({ form, columns }: ChartPanelProps) {
  const { t } = useTranslation("experimentVisualizations");

  const yColumns = useMemo(
    () => filterColumnsForRole(columns, "correlation-matrix", "y"),
    [columns],
  );

  // (Re)build the aggregation request as the cross-product of bivariate
  // `corr` functions. Correlation needs *pairs* of columns rather than a
  // single column per series, so this chart owns its own
  // `aggregation.functions[]` instead of using the generic per-source path.
  const sources = useWatch({ control: form.control, name: "dataConfig.dataSources" });
  const pickedYColumns = useMemo(
    () =>
      dataSourcesByRole(sources, "y")
        .map((entry) => entry.source.columnName)
        .filter((c): c is string => typeof c === "string" && c.length > 0),
    [sources],
  );

  useEffect(() => {
    const functions = correlationPairFunctions(pickedYColumns);
    // Aggregation needs at least one of groupBy / functions to be valid.
    // With < 2 unique columns there are no pairs, so drop aggregation and
    // let the renderer's empty-state explain why.
    const aggregation = functions.length > 0 ? { groupBy: undefined, functions } : undefined;
    // Skip the setValue so a re-run on mount doesn't spuriously mark the form dirty.
    const current = form.getValues("dataConfig.aggregation");
    if (JSON.stringify(current) === JSON.stringify(aggregation)) return;
    form.setValue("dataConfig.aggregation", aggregation, { shouldDirty: true });
  }, [pickedYColumns, form]);

  return (
    <MultiColumnShelf
      form={form}
      columns={yColumns}
      role="y"
      heading={t("workspace.shelves.correlationColumns")}
      columnLabel={t("workspace.shelves.column")}
      placeholder={t("workspace.shelves.selectColumn")}
    />
  );
}

export const correlationMatrixDataShelves: ShelfDef[] = [
  {
    key: "variables",
    labelKey: "workspace.shelves.correlationColumns",
    icon: Variable,
    Component: CorrelationVariablesShelf,
    summary: (form, t) => {
      const sources = form.getValues("dataConfig.dataSources");
      const uniqueColumns = Array.from(
        new Set(
          dataSourcesByRole(sources, "y")
            .map((entry) => entry.source.columnName)
            .filter((c): c is string => typeof c === "string" && c.length > 0),
        ),
      );
      if (uniqueColumns.length === 0) return undefined;
      if (uniqueColumns.length === 1) return uniqueColumns[0];
      return t("workspace.shelves.variablesCount", { count: uniqueColumns.length });
    },
  },
];
