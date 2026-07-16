"use client";

import type { UseFormReturn } from "react-hook-form";
import { useWatch } from "react-hook-form";

import type { ExperimentAggregationFunction } from "@repo/api/domains/experiment/data/experiment-data.schema";
import type { ExperimentDataColumn } from "@repo/api/domains/experiment/data/experiment-data.schema";
import { useTranslation } from "@repo/i18n";
import { Badge } from "@repo/ui/components/badge";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@repo/ui/components/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";

import type { ChartFormValues } from "../../../chart-config";
import { firstDataSourceByRole } from "../../../data/data-sources";

interface PieValuesShelfProps {
  form: UseFormReturn<ChartFormValues>;
  columns: ExperimentDataColumn[];
}

const PIE_FUNCTIONS: { value: ExperimentAggregationFunction; label: string }[] = [
  { value: "sum", label: "Sum" },
  { value: "avg", label: "Average" },
  { value: "count", label: "Count" },
  { value: "min", label: "Min" },
  { value: "max", label: "Max" },
];

/** Pie's values shelf: pairs a column picker with an aggregate function and writes into `dataConfig.aggregation.functions`. */
export function PieValuesShelf({ form, columns }: PieValuesShelfProps) {
  const { t } = useTranslation("experimentVisualizations");

  const sources = useWatch({ control: form.control, name: "dataConfig.dataSources" });
  const aggregation = useWatch({ control: form.control, name: "dataConfig.aggregation" });
  const indexed = firstDataSourceByRole(sources, "values");
  const sourceIndex = indexed?.index ?? 0;

  // Pie has at most one aggregate function. Default to Sum on first interaction.
  const currentFunction = aggregation?.functions?.[0]?.function ?? "sum";
  const isCount = currentFunction === "count";

  const writeFunction = (fn: ExperimentAggregationFunction, column: string) => {
    // Count without a values column uses COUNT(*); otherwise the column
    // gates which rows contribute (COUNT(yield) skips nulls, etc.).
    const functionColumn = fn === "count" && column === "" ? "*" : column;
    if (!functionColumn) {
      // No column and not count: can't form a valid function. Drop the
      // entry and let the renderer's empty-state surface "pick a column".
      form.setValue(
        "dataConfig.aggregation",
        aggregation?.groupBy && aggregation.groupBy.length > 0
          ? { groupBy: aggregation.groupBy }
          : undefined,
        { shouldDirty: true },
      );
      return;
    }
    form.setValue(
      "dataConfig.aggregation",
      {
        groupBy: aggregation?.groupBy,
        functions: [{ column: functionColumn, function: fn }],
      },
      { shouldDirty: true },
    );
  };

  const handleColumnChange = (value: string) => {
    const tableName = form.getValues("dataConfig.tableName");
    form.setValue(`dataConfig.dataSources.${sourceIndex}.tableName`, tableName);
    form.setValue(`dataConfig.dataSources.${sourceIndex}.columnName`, value);
    writeFunction(currentFunction, value);
  };

  const handleFunctionChange = (raw: string) => {
    const fn = raw as ExperimentAggregationFunction;
    const currentColumn = form.getValues(`dataConfig.dataSources.${sourceIndex}.columnName`);
    writeFunction(fn, currentColumn);
  };

  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold">{t("workspace.shelves.values")}</h3>

      <div className="grid grid-cols-[1fr_auto] items-end gap-3">
        <FormField
          control={form.control}
          name={`dataConfig.dataSources.${sourceIndex}.columnName` as const}
          render={({ field }) => (
            <FormItem className="min-w-0">
              <FormLabel className="text-xs font-medium">{t("workspace.shelves.column")}</FormLabel>
              <Select
                value={field.value}
                onValueChange={handleColumnChange}
                disabled={isCount && field.value.length === 0}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        isCount
                          ? t("workspace.shelves.pieValuesCountPlaceholder")
                          : t("workspace.shelves.selectColumn")
                      }
                    />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {columns.map((column) => (
                    <SelectItem key={column.name} value={column.name}>
                      <div className="flex items-center gap-2">
                        <span>{column.name}</span>
                        <Badge
                          variant="outline"
                          className="text-muted-foreground h-4 px-1.5 py-0 font-mono text-[10px] font-normal leading-none"
                        >
                          {column.type_name}
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormItem className="w-[140px]">
          <FormLabel className="text-xs font-medium">{t("workspace.shelves.aggregate")}</FormLabel>
          <Select value={currentFunction} onValueChange={handleFunctionChange}>
            <FormControl>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              {PIE_FUNCTIONS.map((fn) => (
                <SelectItem key={fn.value} value={fn.value}>
                  {fn.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormItem>
      </div>

      {isCount && (
        <p className="text-muted-foreground text-xs">{t("workspace.shelves.pieValuesCountHint")}</p>
      )}
    </section>
  );
}
