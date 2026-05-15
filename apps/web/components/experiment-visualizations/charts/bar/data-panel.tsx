"use client";

import { Plus, X as XIcon } from "lucide-react";
import { useParams } from "next/navigation";
import { useMemo } from "react";
import { useFieldArray, useWatch } from "react-hook-form";

import type { DataColumn } from "@repo/api/schemas/experiment.schema";
import { WellKnownColumnTypes } from "@repo/api/schemas/experiment.schema";
import { filterColumnsForRole } from "@repo/api/utils/visualization-contracts";
import { useTranslation } from "@repo/i18n";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@repo/ui/components/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";
import { Separator } from "@repo/ui/components/separator";

import { useExperimentVisualizationData } from "../../../../hooks/experiment/useExperimentVisualizationData/useExperimentVisualizationData";
import { firstDataSourceByRole } from "../form-values";
import type { ChartPanelProps } from "../types";
import { collectQuestionLabels } from "./aggregate";

const AGG_NEEDING_Y = new Set(["sum", "avg", "min", "max"]);

export function BarDataPanel({ form, columns }: ChartPanelProps) {
  const { t } = useTranslation("experimentVisualizations");

  // X accepts categorical columns plus the well-known CONTRIBUTOR struct
  // and QUESTIONS array. `filterColumnsForRole` strips complex kinds
  // globally, so we union the well-known struct/array columns back in here
  // rather than relaxing the contract for every chart type.
  const xColumns = useMemo<DataColumn[]>(() => {
    const base = filterColumnsForRole(columns, "bar", "x");
    const wellKnownExtras = columns.filter(
      (c) =>
        (c.type_text === WellKnownColumnTypes.CONTRIBUTOR ||
          c.type_text === WellKnownColumnTypes.QUESTIONS) &&
        !base.some((b) => b.name === c.name),
    );
    return [...wellKnownExtras, ...base];
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
  const xColumnType = useWatch({ control: form.control, name: "config.xColumnType" });
  const isQuestionsX = xColumnType === WellKnownColumnTypes.QUESTIONS;
  const xColumnName = xIndexed?.source.columnName ?? "";

  // When the X column is a QUESTIONS array, fetch a sample of rows so we
  // can populate the "Question" picker with the labels that actually exist
  // in the data. We only need the one column, and only when the picker is
  // visible — otherwise this hook stays disabled to avoid extra requests.
  // The route segment is `[id]`, hence `id` here is the experiment id.
  const routeParams = useParams<{ id: string }>();
  const resolvedExperimentId = routeParams.id;
  const tableName = useWatch({ control: form.control, name: "dataConfig.tableName" });
  const { data: questionSample } = useExperimentVisualizationData(
    resolvedExperimentId,
    { tableName, columns: xColumnName ? [xColumnName] : undefined },
    isQuestionsX && Boolean(tableName) && Boolean(xColumnName) && Boolean(resolvedExperimentId),
  );
  const questionLabels = useMemo(
    () => (isQuestionsX ? collectQuestionLabels(questionSample?.rows ?? [], xColumnName) : []),
    [isQuestionsX, questionSample, xColumnName],
  );

  const handleXChange = (columnName: string) => {
    const tableName = form.getValues("dataConfig.tableName");
    form.setValue(`dataConfig.dataSources.${xIndex}.tableName`, tableName);
    form.setValue("config.xAxisTitle", columnName);
    const picked = columns.find((c) => c.name === columnName);
    const nextType = picked?.type_text ?? "";
    form.setValue("config.xColumnType", nextType, { shouldDirty: true });
    // Switching X off of a QUESTIONS column makes the stored questionLabel
    // a phantom — clear it so the renderer doesn't keep looking up a key
    // that no longer applies.
    if (nextType !== WellKnownColumnTypes.QUESTIONS) {
      form.setValue("config.questionLabel", undefined, { shouldDirty: true });
    }
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

  // ─── Filters ────────────────────────────────────────────────────
  // Row pre-filters live in `dataConfig.filters` (schema-defined). For v1
  // the bar chart honours `equals` filters on categorical STRING columns;
  // that covers the classroom workflow (filter by school answer, then
  // group by team name). Each filter row has its own column + value
  // dropdown; values are populated from a sample fetch so kids don't
  // have to remember exact spellings.
  const filterEligibleColumns = useMemo(() => filterColumnsForRole(columns, "bar", "x"), [columns]);
  const {
    fields: filterFields,
    append: appendFilter,
    remove: removeFilter,
  } = useFieldArray({ control: form.control, name: "dataConfig.filters" });
  const filtersWatchedRaw = useWatch({ control: form.control, name: "dataConfig.filters" });
  const filtersWatched = useMemo(() => filtersWatchedRaw ?? [], [filtersWatchedRaw]);
  const activeFilterColumns = useMemo(() => {
    const set = new Set<string>();
    for (const f of filtersWatched) {
      if (f.column) set.add(f.column);
    }
    return Array.from(set);
  }, [filtersWatched]);
  const { data: filterSample } = useExperimentVisualizationData(
    resolvedExperimentId,
    { tableName, columns: activeFilterColumns },
    activeFilterColumns.length > 0 && Boolean(tableName) && Boolean(resolvedExperimentId),
  );
  const filterValuesByColumn = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const col of activeFilterColumns) {
      const seen = new Set<string>();
      for (const row of filterSample?.rows ?? []) {
        const v = row[col];
        if (typeof v === "string" && v !== "") seen.add(v);
        else if (typeof v === "number" || typeof v === "bigint" || typeof v === "boolean") {
          seen.add(String(v));
        }
      }
      map.set(col, Array.from(seen).sort());
    }
    return map;
  }, [activeFilterColumns, filterSample]);

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
        {isQuestionsX && (
          <FormField
            control={form.control}
            name="config.questionLabel"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs font-medium">
                  {t("workspace.bar.question", "Question")}
                </FormLabel>
                <Select
                  value={typeof field.value === "string" && field.value ? field.value : undefined}
                  onValueChange={(value) => field.onChange(value)}
                  disabled={questionLabels.length === 0}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue
                        placeholder={
                          questionLabels.length === 0
                            ? t("workspace.bar.questionLoading", "Loading questions…")
                            : t("workspace.bar.questionPlaceholder", "Select a question")
                        }
                      />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {questionLabels.map((label) => (
                      <SelectItem key={label} value={label}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        )}
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

      <Separator />

      <section className="space-y-3">
        <header className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">{t("workspace.bar.filters")}</h3>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => appendFilter({ column: "", operator: "equals", value: "" })}
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            {t("workspace.bar.addFilter", "Add filter")}
          </Button>
        </header>
        {filterFields.length === 0 && (
          <p className="text-muted-foreground text-xs">
            {t("workspace.bar.noFiltersHelp", "No filters. All rows contribute to the chart.")}
          </p>
        )}
        {filterFields.map((field, idx) => {
          const pickedColumn = filtersWatched[idx]?.column ?? "";
          const valueOptions = filterValuesByColumn.get(pickedColumn) ?? [];
          return (
            <div
              key={field.id}
              className="bg-muted/30 grid grid-cols-[1fr_1fr_auto] items-end gap-2 rounded-md border p-3"
            >
              <FormField
                control={form.control}
                name={`dataConfig.filters.${idx}.column` as const}
                render={({ field: colField }) => (
                  <FormItem className="space-y-1">
                    <FormLabel className="text-xs font-medium">
                      {t("workspace.bar.filterColumn", "Column")}
                    </FormLabel>
                    <Select
                      value={typeof colField.value === "string" ? colField.value : ""}
                      onValueChange={(v) => {
                        colField.onChange(v);
                        // Switching the column makes the previous value
                        // meaningless — clear it so the renderer doesn't
                        // keep a dangling filter active.
                        form.setValue(`dataConfig.filters.${idx}.value`, "", {
                          shouldDirty: true,
                        });
                      }}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t("workspace.shelves.selectColumn")} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {filterEligibleColumns.map((column) => (
                          <SelectItem key={column.name} value={column.name}>
                            {column.name}
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
                name={`dataConfig.filters.${idx}.value` as const}
                render={({ field: valField }) => (
                  <FormItem className="space-y-1">
                    <FormLabel className="text-xs font-medium">
                      {t("workspace.bar.filterValue", "Value")}
                    </FormLabel>
                    <Select
                      value={typeof valField.value === "string" ? valField.value : ""}
                      onValueChange={(v) => valField.onChange(v)}
                      disabled={!pickedColumn || valueOptions.length === 0}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue
                            placeholder={
                              !pickedColumn
                                ? t("workspace.bar.filterValuePickColumn", "Pick a column first")
                                : valueOptions.length === 0
                                  ? t("workspace.bar.filterValueLoading", "Loading values…")
                                  : t("workspace.bar.filterValuePlaceholder", "Select a value")
                            }
                          />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {valueOptions.map((v) => (
                          <SelectItem key={v} value={v}>
                            {v}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-destructive h-9 w-9"
                onClick={() => removeFilter(idx)}
                aria-label={t("workspace.bar.removeFilter", "Remove filter")}
              >
                <XIcon className="h-4 w-4" />
              </Button>
            </div>
          );
        })}
      </section>
    </div>
  );
}
