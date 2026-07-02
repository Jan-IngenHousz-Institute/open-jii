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

import type { ChartFormValues } from "../../charts/chart-config";
import { getDataSourceAggregate, setDataSourceAggregate } from "../../charts/data/aggregation";
import { firstDataSourceByRole } from "../../charts/data/data-sources";

const AGG_NONE = "__none__";

// Z is one cell per (x, y); cumsum/std/var aren't meaningful here.
const Z_AGG_FUNCTIONS: { value: ExperimentAggregationFunction; label: string }[] = [
  { value: "avg", label: "Average" },
  { value: "sum", label: "Sum" },
  { value: "count", label: "Count" },
  { value: "min", label: "Min" },
  { value: "max", label: "Max" },
];

interface ZShelfProps {
  form: UseFormReturn<ChartFormValues>;
  columns: ExperimentDataColumn[];
  heading: string;
  xColumn: string;
  yColumn: string;
}

/**
 * Z-axis shelf for heatmap and contour. The user picks a numeric column
 * for the cell value plus an aggregate function. Pins both `xColumn`
 * and `yColumn` into `groupBy`, differentiating this from the Y-side
 * aggregate picker which only pins X.
 */
export function ZShelf({ form, columns, heading, xColumn, yColumn }: ZShelfProps) {
  const { t } = useTranslation("experimentVisualizations");
  const sources = useWatch({ control: form.control, name: "dataConfig.dataSources" });
  const indexed = firstDataSourceByRole(sources, "z");
  const sourceIndex = indexed?.index ?? 0;
  const aggregateValue = getDataSourceAggregate(sources, sourceIndex) ?? AGG_NONE;

  const handleAggregateChange = (raw: string) => {
    const fn = raw === AGG_NONE ? undefined : (raw as ExperimentAggregationFunction);
    setDataSourceAggregate(form, sourceIndex, fn, [xColumn, yColumn]);
  };

  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold">{heading}</h3>

      <div className="flex items-end gap-2">
        <FormField
          control={form.control}
          name={`dataConfig.dataSources.${sourceIndex}.columnName` as const}
          render={({ field }) => (
            <FormItem className="flex-1">
              <FormLabel className="text-xs font-medium">{t("workspace.shelves.column")}</FormLabel>
              <Select
                value={field.value}
                onValueChange={(value) => {
                  const tableName = form.getValues("dataConfig.tableName");
                  form.setValue(`dataConfig.dataSources.${sourceIndex}.tableName`, tableName);
                  field.onChange(value);
                }}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder={t("workspace.shelves.selectColumn")} />
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
          <Select value={aggregateValue} onValueChange={handleAggregateChange}>
            <FormControl>
              <SelectTrigger>
                <SelectValue placeholder={t("workspace.shelves.aggregateNone")} />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              <SelectItem value={AGG_NONE}>
                <span className="text-muted-foreground italic">
                  {t("workspace.shelves.aggregateNone")}
                </span>
              </SelectItem>
              {Z_AGG_FUNCTIONS.map((fn) => (
                <SelectItem key={fn.value} value={fn.value}>
                  {fn.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormItem>
      </div>
    </section>
  );
}
