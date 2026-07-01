"use client";

import { Plus } from "lucide-react";
import type { UseFormReturn } from "react-hook-form";
import { useWatch } from "react-hook-form";

import type { ExperimentAggregationFunction } from "@repo/api/domains/experiment/data/experiment-data.schema";
import type { ExperimentDataColumn } from "@repo/api/domains/experiment/data/experiment-data.schema";
import type { ExperimentSeriesTraceType } from "@repo/api/domains/experiment/experiment.schema";
import { getColumnKind } from "@repo/api/transforms/column-type-utils";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@repo/ui/components/form";
import { Input } from "@repo/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";

import { defaultAxisTypeFor } from "../../charts/chart-config";
import type { ChartFormValues } from "../../charts/chart-config";
import { getDefaultSeriesColor } from "../../charts/colors/palettes";
import { getDataSourceAggregate, setDataSourceAggregate } from "../../charts/data/aggregation";
import {
  dataSourcesByRole,
  firstDataSourceByRole,
  makeDataSource,
} from "../../charts/data/data-sources";
import { useDataSourcesFieldArray } from "../context/data-sources-field-array-context";
import { AGG_NONE, YSeriesItem } from "./y-series-item";

interface AggregateOption {
  value: ExperimentAggregationFunction;
  label: string;
  requiresXColumn?: boolean;
}

// `cumsum` produces a running total across the X-axis ordering;
// disabled without an X column to define the order.
const AGG_FUNCTIONS: AggregateOption[] = [
  { value: "sum", label: "Sum" },
  { value: "avg", label: "Average" },
  { value: "count", label: "Count" },
  { value: "min", label: "Min" },
  { value: "max", label: "Max" },
  { value: "std", label: "Std dev" },
  { value: "var", label: "Variance" },
  { value: "cumsum", label: "Cumulative sum", requiresXColumn: true },
];

export interface YAxisShelfProps {
  form: UseFormReturn<ChartFormValues>;
  columns: ExperimentDataColumn[];
  showSeriesColor?: boolean;
  maxSeries?: number;
  hideAxisType?: boolean;
  showCartesianControls?: boolean;
  defaultTraceType?: ExperimentSeriesTraceType;
  hideAggregate?: boolean;
  showErrorColumn?: boolean;
  errorColumns?: ExperimentDataColumn[];
}

export function YAxisShelf({
  form,
  columns,
  showSeriesColor = true,
  maxSeries,
  hideAxisType = false,
  showCartesianControls = false,
  defaultTraceType,
  hideAggregate = false,
  showErrorColumn = false,
  errorColumns,
}: YAxisShelfProps) {
  const { t } = useTranslation("experimentVisualizations");

  // Error columns default to numeric subset; callers can override.
  const effectiveErrorColumns =
    errorColumns ?? columns.filter((c) => getColumnKind(c.type_text) === "numeric");

  const { append, remove } = useDataSourcesFieldArray();

  const sources = useWatch({ control: form.control, name: "dataConfig.dataSources" });
  const aggregation = useWatch({ control: form.control, name: "dataConfig.aggregation" });

  const ySources = dataSourcesByRole(sources, "y");
  const colorSources = dataSourcesByRole(sources, "color");
  const isColorMapped = colorSources.length > 0 && Boolean(colorSources[0].source.columnName);
  const xColumnName = firstDataSourceByRole(sources, "x")?.source.columnName ?? "";
  const hasSecondaryAxisSeries = ySources.some((s) => s.source.axis === "secondary");
  const canAddSeries = maxSeries === undefined || ySources.length < maxSeries;

  // GROUP BY activates when X is bucketed or any sibling has a row aggregate
  // (window-only `cumsum` doesn't impose GROUP BY).
  const xIsBucketed = Boolean(
    aggregation?.groupBy?.find((g) => g.column === xColumnName)?.timeBucket,
  );
  const anySiblingHasRowAggregate = sources.some((ds) => ds.aggregate && ds.aggregate !== "cumsum");
  const groupByActive = xIsBucketed || anySiblingHasRowAggregate;

  const handleColumnChange = (value: string, seriesIndex: number) => {
    if (seriesIndex === 0) {
      form.setValue("config.yAxisTitle", value);
      // Only the first Y series defines the axis; others just add traces.
      const picked = columns.find((c) => c.name === value);
      form.setValue("config.yAxisType", defaultAxisTypeFor(picked?.type_text), {
        shouldDirty: true,
      });
    }
    const yEntry = ySources[seriesIndex];
    form.setValue(`dataConfig.dataSources.${yEntry.index}.alias` as const, value);

    // If aggregation is active elsewhere, a new Y without an aggregate would
    // silently drop from SQL projection — default to AVG to keep it visible.
    const yEntryDsIndex = yEntry.index;
    const existingAggregate = form.getValues("dataConfig.dataSources")[yEntryDsIndex]?.aggregate;
    if (value && existingAggregate === undefined) {
      const currentAggregation = form.getValues("dataConfig.aggregation");
      const xBucket = currentAggregation?.groupBy?.find(
        (g) => g.column === xColumnName,
      )?.timeBucket;
      const otherSourcesAggregating = form
        .getValues("dataConfig.dataSources")
        .some((ds, i) => i !== yEntryDsIndex && Boolean(ds.aggregate));
      const aggregationActive = Boolean(xBucket) || otherSourcesAggregating;
      if (aggregationActive) {
        setDataSourceAggregate(form, yEntryDsIndex, "avg", xColumnName);
      }
    }
  };

  const handleAggregateChange = (raw: string, dsIndex: number) => {
    const fn = raw === AGG_NONE ? undefined : pickAggregate(raw);
    setDataSourceAggregate(form, dsIndex, fn, xColumnName);
  };

  // Shelf hides per-series overrides on the first Y; clear lingering
  // traceType/axis from a former 2nd+ ordinal so saved data tracks UI.
  const handleRemoveSeries = (dsIndex: number) => {
    remove(dsIndex);
    const newFirstY = dataSourcesByRole(form.getValues("dataConfig.dataSources"), "y").at(0);
    if (newFirstY) {
      if (newFirstY.source.traceType !== undefined) {
        form.setValue(`dataConfig.dataSources.${newFirstY.index}.traceType` as const, undefined, {
          shouldDirty: true,
        });
      }
      if (newFirstY.source.axis !== undefined) {
        form.setValue(`dataConfig.dataSources.${newFirstY.index}.axis` as const, undefined, {
          shouldDirty: true,
        });
      }
    }
  };

  const handleAddSeries = () => {
    const tableName = form.getValues("dataConfig.tableName");
    append(makeDataSource(tableName, "y"));

    const currentColors = form.getValues("config.color");
    const next = getDefaultSeriesColor(ySources.length);
    if (Array.isArray(currentColors)) {
      form.setValue("config.color", [...currentColors, next]);
    } else {
      form.setValue("config.color", [currentColors ?? "#3b82f6", next]);
    }
  };

  return (
    <section className="space-y-3">
      <header className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{t("workspace.shelves.yAxis")}</h3>
        {canAddSeries && (
          <Button type="button" variant="ghost" size="sm" onClick={handleAddSeries}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            {t("workspace.shelves.addSeries")}
          </Button>
        )}
      </header>

      <div className="space-y-3">
        {ySources.map((entry, seriesIndex) => {
          const dsIndex = entry.index;
          const seriesColumn = entry.source.columnName;
          const aggregateValue = getDataSourceAggregate(sources, dsIndex) ?? AGG_NONE;
          // Skip the silent-drop warning when the series's own column is itself
          // a `groupBy` key (heatmap/contour treat Y as a positional axis).
          const seriesColumnIsGroupKey = Boolean(
            seriesColumn && aggregation?.groupBy?.some((g) => g.column === seriesColumn),
          );
          const willBeSilentlyDropped =
            groupByActive &&
            !entry.source.aggregate &&
            Boolean(seriesColumn) &&
            !seriesColumnIsGroupKey;
          return (
            <YSeriesItem
              key={entry.source.role + dsIndex}
              form={form}
              dsIndex={dsIndex}
              seriesIndex={seriesIndex}
              seriesColumn={seriesColumn}
              canRemove={ySources.length > 1}
              willBeSilentlyDropped={willBeSilentlyDropped}
              aggregateValue={aggregateValue}
              columns={columns}
              effectiveErrorColumns={effectiveErrorColumns}
              xColumnName={xColumnName}
              aggregateOptions={AGG_FUNCTIONS}
              showCartesianControls={showCartesianControls}
              showErrorColumn={showErrorColumn}
              showSeriesColor={showSeriesColor}
              hideAggregate={hideAggregate}
              isColorMapped={isColorMapped}
              defaultTraceType={defaultTraceType}
              onColumnChange={handleColumnChange}
              onAggregateChange={handleAggregateChange}
              onRemove={handleRemoveSeries}
            />
          );
        })}
      </div>

      <div className={hideAxisType ? "" : "grid grid-cols-2 gap-3"}>
        <FormField
          control={form.control}
          name="config.yAxisTitle"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-medium">
                {t("workspace.shelves.axisTitle")}
              </FormLabel>
              <FormControl>
                <Input
                  placeholder={t("workspace.shelves.axisTitlePlaceholder")}
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  name={field.name}
                  ref={field.ref}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {!hideAxisType && (
          <FormField
            control={form.control}
            name="config.yAxisType"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs font-medium">
                  {t("workspace.shelves.axisType")}
                </FormLabel>
                <Select value={String(field.value ?? "linear")} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="linear">{t("workspace.axisTypes.linear")}</SelectItem>
                    <SelectItem value="log">{t("workspace.axisTypes.log")}</SelectItem>
                    <SelectItem value="date">{t("workspace.axisTypes.date")}</SelectItem>
                    <SelectItem value="category">{t("workspace.axisTypes.category")}</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        )}
      </div>

      {showCartesianControls && hasSecondaryAxisSeries && (
        <div className="grid grid-cols-2 gap-3">
          <FormField
            control={form.control}
            name="config.y2AxisTitle"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs font-medium">
                  {t("workspace.shelves.secondaryAxisTitle")}
                </FormLabel>
                <FormControl>
                  <Input
                    placeholder={t("workspace.shelves.secondaryAxisTitlePlaceholder")}
                    value={field.value ?? ""}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    name={field.name}
                    ref={field.ref}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="config.y2AxisType"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs font-medium">
                  {t("workspace.shelves.secondaryAxisType")}
                </FormLabel>
                <Select value={String(field.value ?? "linear")} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="linear">{t("workspace.axisTypes.linear")}</SelectItem>
                    <SelectItem value="log">{t("workspace.axisTypes.log")}</SelectItem>
                    <SelectItem value="date">{t("workspace.axisTypes.date")}</SelectItem>
                    <SelectItem value="category">{t("workspace.axisTypes.category")}</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      )}
    </section>
  );
}

function pickAggregate(raw: string): ExperimentAggregationFunction | undefined {
  return AGG_FUNCTIONS.find((agg) => agg.value === raw)?.value;
}
