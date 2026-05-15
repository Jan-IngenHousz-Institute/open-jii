"use client";

import { useMemo } from "react";
import { useWatch } from "react-hook-form";

import type { DataColumn } from "@repo/api/schemas/experiment.schema";
import { WellKnownColumnTypes } from "@repo/api/schemas/experiment.schema";
import { filterColumnsForRole } from "@repo/api/utils/visualization-contracts";
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
import { Separator } from "@repo/ui/components/separator";

import { firstDataSourceByRole } from "../form-values";
import type { ChartPanelProps } from "../types";

const AGG_NEEDING_Y = new Set(["sum", "avg", "min", "max"]);

export function BarDataPanel({ form, columns }: ChartPanelProps) {
  const { t } = useTranslation("experimentVisualizations");

  // X accepts categorical columns plus the CONTRIBUTOR well-known struct.
  // `filterColumnsForRole` strips complex kinds globally, so we union the
  // contributor column(s) back in here rather than relaxing the contract
  // for every chart type.
  const xColumns = useMemo<DataColumn[]>(() => {
    const base = filterColumnsForRole(columns, "bar", "x");
    const contributorExtras = columns.filter(
      (c) =>
        c.type_text === WellKnownColumnTypes.CONTRIBUTOR && !base.some((b) => b.name === c.name),
    );
    return [...contributorExtras, ...base];
  }, [columns]);

  const yColumns = useMemo(() => filterColumnsForRole(columns, "bar", "y"), [columns]);

  const sources = useWatch({ control: form.control, name: "dataConfig.dataSources" });
  const xIndexed = firstDataSourceByRole(sources, "x");
  const yIndexed = firstDataSourceByRole(sources, "y");
  const xIndex = xIndexed?.index ?? 0;
  const yIndex = yIndexed?.index ?? 1;

  const aggregationFunction =
    useWatch({ control: form.control, name: "config.aggregationFunction" }) ?? "count";
  const yColumnName = yIndexed?.source.columnName ?? "";

  const handleXChange = (columnName: string) => {
    const tableName = form.getValues("dataConfig.tableName");
    form.setValue(`dataConfig.dataSources.${xIndex}.tableName`, tableName);
    form.setValue("config.xAxisTitle", columnName);
    const picked = columns.find((c) => c.name === columnName);
    form.setValue("config.xColumnType", picked?.type_text ?? "", { shouldDirty: true });
  };

  const handleYChange = (columnName: string) => {
    const tableName = form.getValues("dataConfig.tableName");
    form.setValue(`dataConfig.dataSources.${yIndex}.tableName`, tableName);
    form.setValue(`dataConfig.dataSources.${yIndex}.alias`, columnName, { shouldDirty: true });
    form.setValue("config.yAxisTitle", columnName);
    // Switching away from a Y column while keeping a numeric aggregation
    // would leave the renderer aggregating undefined; auto-fall-back to
    // count so the chart keeps rendering even mid-edit.
    if (!columnName && AGG_NEEDING_Y.has(aggregationFunction)) {
      form.setValue("config.aggregationFunction", "count", { shouldDirty: true });
    }
  };

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <h3 className="text-sm font-semibold">{t("workspace.shelves.xAxis")}</h3>
        <FormField
          control={form.control}
          name={`dataConfig.dataSources.${xIndex}.columnName` as const}
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-medium">{t("workspace.shelves.column")}</FormLabel>
              <Select
                value={field.value || undefined}
                onValueChange={(value) => {
                  field.onChange(value);
                  handleXChange(value);
                }}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder={t("workspace.shelves.selectColumn")} />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {xColumns.map((column) => (
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

      <Separator />

      <section className="space-y-3">
        <h3 className="text-sm font-semibold">{t("workspace.shelves.yAxis")}</h3>
        <p className="text-muted-foreground text-xs">
          {t("workspace.shelves.barYAxisHelp", "Optional. Leave empty for count.")}
        </p>
        <FormField
          control={form.control}
          name={`dataConfig.dataSources.${yIndex}.columnName` as const}
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-medium">{t("workspace.shelves.column")}</FormLabel>
              <Select
                value={field.value || undefined}
                onValueChange={(value) => {
                  field.onChange(value);
                  handleYChange(value);
                }}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder={t("workspace.shelves.selectColumn")} />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {yColumns.map((column) => (
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

        <FormField
          control={form.control}
          name="config.aggregationFunction"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-medium">
                {t("workspace.bar.aggregation")}
              </FormLabel>
              <Select
                value={String(field.value ?? "count")}
                onValueChange={(value) => field.onChange(value)}
                disabled={!yColumnName && AGG_NEEDING_Y.has(String(field.value))}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="count">
                    {t("workspace.bar.aggregations.count", "Count")}
                  </SelectItem>
                  <SelectItem value="sum" disabled={!yColumnName}>
                    {t("workspace.bar.aggregations.sum", "Sum")}
                  </SelectItem>
                  <SelectItem value="avg" disabled={!yColumnName}>
                    {t("workspace.bar.aggregations.avg", "Average")}
                  </SelectItem>
                  <SelectItem value="min" disabled={!yColumnName}>
                    {t("workspace.bar.aggregations.min", "Min")}
                  </SelectItem>
                  <SelectItem value="max" disabled={!yColumnName}>
                    {t("workspace.bar.aggregations.max", "Max")}
                  </SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
      </section>
    </div>
  );
}
