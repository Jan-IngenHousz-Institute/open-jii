"use client";

import type { UseFormReturn } from "react-hook-form";
import { useWatch } from "react-hook-form";

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

interface PieLabelsShelfProps {
  form: UseFormReturn<ChartFormValues>;
  columns: ExperimentDataColumn[];
}

/** Pie's labels column picker. Also rewrites `dataConfig.aggregation.groupBy` so the SQL groups by this column. */
export function PieLabelsShelf({ form, columns }: PieLabelsShelfProps) {
  const { t } = useTranslation("experimentVisualizations");

  const sources = useWatch({ control: form.control, name: "dataConfig.dataSources" });
  const indexed = firstDataSourceByRole(sources, "labels");
  const sourceIndex = indexed?.index ?? 0;

  const handleColumnChange = (value: string) => {
    const tableName = form.getValues("dataConfig.tableName");
    form.setValue(`dataConfig.dataSources.${sourceIndex}.tableName`, tableName, {
      shouldDirty: true,
    });
    form.setValue(`dataConfig.dataSources.${sourceIndex}.columnName`, value, {
      shouldDirty: true,
    });

    // Rewrite groupBy: pie groups by exactly one column. Replace rather
    // than upsert because changing the label invalidates any prior entry.
    // Cleared label drops groupBy; functions kept so the user's aggregate
    // choice survives a brief unset/reset.
    const existingFns = form.getValues("dataConfig.aggregation")?.functions;
    const hasLabel = value.length > 0;
    const hasFns = (existingFns?.length ?? 0) > 0;
    let nextAggregation: ChartFormValues["dataConfig"]["aggregation"];
    if (hasLabel) {
      nextAggregation = { groupBy: [{ column: value }], functions: existingFns };
    } else if (hasFns) {
      nextAggregation = { functions: existingFns };
    } else {
      nextAggregation = undefined;
    }
    form.setValue("dataConfig.aggregation", nextAggregation, { shouldDirty: true });
  };

  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold">{t("workspace.shelves.labels")}</h3>

      <FormField
        control={form.control}
        name={`dataConfig.dataSources.${sourceIndex}.columnName` as const}
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-xs font-medium">{t("workspace.shelves.column")}</FormLabel>
            <Select value={field.value} onValueChange={handleColumnChange}>
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
    </section>
  );
}
