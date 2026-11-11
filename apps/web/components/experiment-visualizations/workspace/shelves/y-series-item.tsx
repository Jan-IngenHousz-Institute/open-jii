"use client";

import { InsetPanel } from "@/components/shared/inset-panel";
import { AlertTriangle, Trash2 } from "lucide-react";
import type { UseFormReturn } from "react-hook-form";
import { ColumnName } from "~/components/experiment-data/column-name";

import {
  aggregateKind,
  takesWindow,
} from "@repo/api/domains/experiment/data/experiment-data.schema";
import type { ExperimentDataColumn } from "@repo/api/domains/experiment/data/experiment-data.schema";
import type {
  ExperimentSeriesAxis,
  ExperimentSeriesTraceType,
} from "@repo/api/domains/experiment/visualizations/experiment-visualizations.schema";
import { getColumnKind } from "@repo/api/transforms/column-type-utils";
import { useTranslation } from "@repo/i18n";
import { Badge } from "@repo/ui/components/badge";
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
import { cn } from "@repo/ui/lib/utils";

import type { ChartFormValues } from "../../charts/chart-config";
import { setDataSourceAggregate } from "../../charts/data/aggregation";
import { SeriesColorField } from "./series-color-field";
import { WindowColumnSelect } from "./window-column-select";

export const AGG_NONE = "__none__";
export const TRACE_TYPE_DEFAULT = "__default__";
export const TRACE_TYPE_OPTIONS: ExperimentSeriesTraceType[] = ["line", "bar", "scatter", "area"];
export const AXIS_OPTIONS: ExperimentSeriesAxis[] = ["primary", "secondary"];

interface AggregateOption {
  value: string;
  label: string;
  requiresXColumn?: boolean;
  disabledReason?: string;
}

export interface YSeriesItemProps {
  form: UseFormReturn<ChartFormValues>;
  dsIndex: number;
  seriesIndex: number;
  seriesColumn: string;
  canRemove: boolean;
  willBeSilentlyDropped: boolean;
  aggregateValue: string;
  allowAggregateWithoutColumn?: boolean;
  columns: ExperimentDataColumn[];
  effectiveErrorColumns: ExperimentDataColumn[];
  windowColumns?: ExperimentDataColumn[];
  rowWindowConflict?: boolean;
  groupingColumns?: string[];
  xColumnName: string;
  aggregateOptions: AggregateOption[];
  showCartesianControls: boolean;
  showErrorColumn: boolean;
  showSeriesColor: boolean;
  hideAggregate: boolean;
  isColorMapped: boolean;
  defaultTraceType: ExperimentSeriesTraceType | undefined;
  onColumnChange: (value: string, seriesIndex: number) => void;
  onAggregateChange: (raw: string, dsIndex: number) => void;
  onRemove: (dsIndex: number) => void;
}

export function YSeriesItem({
  form,
  dsIndex,
  seriesIndex,
  seriesColumn,
  canRemove,
  willBeSilentlyDropped,
  aggregateValue,
  allowAggregateWithoutColumn = false,
  columns,
  effectiveErrorColumns,
  windowColumns = columns,
  rowWindowConflict = false,
  groupingColumns = [],
  xColumnName,
  aggregateOptions,
  showCartesianControls,
  showErrorColumn,
  showSeriesColor,
  hideAggregate,
  isColorMapped,
  defaultTraceType,
  onColumnChange,
  onAggregateChange,
  onRemove,
}: YSeriesItemProps) {
  const { t } = useTranslation("experimentVisualizations");
  const aggregate = form.getValues(`dataConfig.dataSources.${dsIndex}.aggregate`);
  const windowed = aggregate !== undefined && takesWindow(aggregate);
  const rowWindow = aggregate !== undefined && aggregateKind(aggregate) === "rowWindow";
  const showPerSeriesOverrides = showCartesianControls && seriesIndex > 0;
  const colorRowClass = cn(showSeriesColor && "grid grid-cols-2 gap-3");

  const renderAsDefaultLabel = defaultTraceType
    ? t(`workspace.shelves.traceType.${defaultTraceType}`)
    : t("workspace.shelves.traceType.line");

  const handleTraceTypeChange = (raw: string) => {
    if (raw === TRACE_TYPE_DEFAULT) {
      return undefined;
    }
    return TRACE_TYPE_OPTIONS.find((option) => option === raw);
  };

  const handleAxisChange = (raw: string) => {
    if (raw === "primary") {
      return undefined;
    }
    return AXIS_OPTIONS.find((option) => option === raw);
  };

  return (
    <InsetPanel className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground text-xs font-medium">
          {t("workspace.shelves.series", { index: seriesIndex + 1 })}
        </span>
        {canRemove && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-destructive h-7 w-7 p-0"
            onClick={() => onRemove(dsIndex)}
            aria-label={t("workspace.shelves.removeSeries")}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {willBeSilentlyDropped && (
        <div className="text-status-stale-foreground flex items-start gap-1.5 text-[11px]">
          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
          <span>{t("workspace.shelves.seriesSilentlyDropped")}</span>
        </div>
      )}

      <div className="grid grid-cols-[minmax(0,1fr)] gap-3">
        <FormField
          control={form.control}
          name={`dataConfig.dataSources.${dsIndex}.columnName` as const}
          render={({ field }) => (
            <FormItem className="min-w-0">
              <FormLabel className="text-xs font-medium">{t("workspace.shelves.column")}</FormLabel>
              <Select
                value={String(field.value)}
                onValueChange={(value) => {
                  field.onChange(value);
                  onColumnChange(value, seriesIndex);
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
                      <div className="flex min-w-0 items-center gap-2">
                        <ColumnName column={column} />
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

        {!hideAggregate && (
          <FormItem className="min-w-0">
            <FormLabel className="text-xs font-medium">
              {t("workspace.shelves.aggregate")}
            </FormLabel>
            <Select
              value={aggregateValue}
              onValueChange={(v) => onAggregateChange(v, dsIndex)}
              disabled={!seriesColumn && !allowAggregateWithoutColumn}
            >
              <FormControl>
                <SelectTrigger className="h-auto min-h-9 min-w-0 whitespace-normal text-left [&>span]:line-clamp-none [&>span]:min-w-0 [&>span]:whitespace-normal [&>span]:break-words">
                  <SelectValue placeholder={t("workspace.shelves.aggregateNone")} />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value={AGG_NONE}>
                  <span className="text-muted-foreground italic">
                    {t("workspace.shelves.aggregateNone")}
                  </span>
                </SelectItem>
                {aggregateOptions.map((fn) => {
                  const needsX = fn.requiresXColumn === true && !xColumnName;
                  const reason =
                    fn.disabledReason ??
                    (needsX ? t("workspace.shelves.aggregateNeedsXColumn") : undefined);
                  const blocked = Boolean(reason);
                  return (
                    <SelectItem
                      key={fn.value}
                      value={fn.value}
                      disabled={blocked}
                      title={reason}
                      description={fn.disabledReason}
                      descriptionId={`aggregate-reason-${dsIndex}-${fn.value}`}
                    >
                      {needsX
                        ? t("workspace.shelves.aggregateNeedsXColumnLabel", { label: fn.label })
                        : fn.label}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </FormItem>
        )}
      </div>

      {windowed && (
        <div className="space-y-3">
          {rowWindowConflict && (
            <p role="alert" className="text-destructive text-xs">
              {t("workspace.shelves.rowWindowConflict")}
            </p>
          )}
          {rowWindow ? (
            <WindowColumnSelect
              form={form}
              name={`dataConfig.dataSources.${dsIndex}.partitionColumn`}
              label={t("workspace.shelves.windowPer")}
              emptyLabel={t("workspace.shelves.windowWholeTable")}
              columns={windowColumns}
              onChange={() => setDataSourceAggregate(form, dsIndex, aggregate, xColumnName)}
            />
          ) : (
            <div className="space-y-1">
              <p className="text-xs font-medium">{t("workspace.shelves.windowPer")}</p>
              <p className="text-muted-foreground text-xs">
                {groupingColumns.length > 0
                  ? groupingColumns.join(", ")
                  : t("workspace.shelves.windowWholeTable")}
              </p>
            </div>
          )}
          <WindowColumnSelect
            form={form}
            name={`dataConfig.dataSources.${dsIndex}.orderColumn`}
            label={t("workspace.shelves.windowOrderedBy")}
            emptyLabel={t("workspace.shelves.selectColumn")}
            columns={windowColumns.filter((column) =>
              ["numeric", "temporal"].includes(getColumnKind(column.type_text) ?? ""),
            )}
            onChange={() => setDataSourceAggregate(form, dsIndex, aggregate, xColumnName)}
          />
          <p className="text-muted-foreground text-xs">
            {t("workspace.shelves.windowFiltersFirst")}
          </p>
          {(aggregate === "previous" || aggregate === "change_from_previous") && (
            <p className="text-muted-foreground text-xs">
              {t("workspace.shelves.windowFirstRowNoPrevious")}
            </p>
          )}
          {aggregate === "change_from_previous" && (
            <p className="text-muted-foreground text-xs">
              {t("workspace.shelves.windowChangeSeconds")}
            </p>
          )}
        </div>
      )}

      {showErrorColumn && (
        <FormField
          control={form.control}
          name={`dataConfig.dataSources.${dsIndex}.errorColumn` as const}
          render={({ field }) => {
            // Schema stores `undefined` for "no error column"; Select needs a non-empty key.
            const selectValue =
              field.value === undefined || field.value === "" ? "none" : field.value;
            return (
              <FormItem>
                <FormLabel className="text-xs font-medium">
                  {t("workspace.shelves.errorColumn")}
                </FormLabel>
                <Select
                  value={selectValue}
                  onValueChange={(value) => field.onChange(value === "none" ? undefined : value)}
                  disabled={!seriesColumn}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder={t("workspace.shelves.errorColumnPlaceholder")} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="none">
                      <span className="text-muted-foreground italic">
                        {t("workspace.shelves.errorColumnNone")}
                      </span>
                    </SelectItem>
                    {effectiveErrorColumns.map((column) => (
                      <SelectItem key={column.name} value={column.name}>
                        <div className="flex min-w-0 items-center gap-2">
                          <ColumnName column={column} />
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
            );
          }}
        />
      )}

      <div className={colorRowClass}>
        <FormField
          control={form.control}
          name={`dataConfig.dataSources.${dsIndex}.alias` as const}
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-medium">
                {t("workspace.shelves.seriesName")}
              </FormLabel>
              <FormControl>
                <Input
                  placeholder={t("workspace.shelves.seriesNamePlaceholder")}
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

        {showSeriesColor && (
          <SeriesColorField form={form} seriesIndex={seriesIndex} isColorMapped={isColorMapped} />
        )}
      </div>

      {/* The first Y series anchors the chart's identity. Per-series overrides only show for the 2nd+. */}
      {showPerSeriesOverrides && (
        <div className="grid grid-cols-2 gap-3">
          <FormField
            control={form.control}
            name={`dataConfig.dataSources.${dsIndex}.traceType` as const}
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs font-medium">
                  {t("workspace.shelves.renderAs")}
                </FormLabel>
                <Select
                  value={field.value ?? TRACE_TYPE_DEFAULT}
                  onValueChange={(value) => field.onChange(handleTraceTypeChange(value))}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value={TRACE_TYPE_DEFAULT}>
                      {t("workspace.shelves.renderAsDefault", { type: renderAsDefaultLabel })}
                    </SelectItem>
                    {TRACE_TYPE_OPTIONS.map((option) => (
                      <SelectItem key={option} value={option}>
                        {t(`workspace.shelves.traceType.${option}`)}
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
            name={`dataConfig.dataSources.${dsIndex}.axis` as const}
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs font-medium">
                  {t("workspace.shelves.axisAssignment")}
                </FormLabel>
                <Select
                  value={field.value ?? "primary"}
                  // Persist `undefined` for the default ("primary") so saved config stays clean.
                  onValueChange={(value) => field.onChange(handleAxisChange(value))}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {AXIS_OPTIONS.map((option) => (
                      <SelectItem key={option} value={option}>
                        {t(`workspace.shelves.axis.${option}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      )}
    </InsetPanel>
  );
}
