"use client";

import { AlertTriangle, Trash2 } from "lucide-react";
import type { UseFormReturn } from "react-hook-form";

import type { DataColumn, SeriesAxis, SeriesTraceType } from "@repo/api/schemas/experiment.schema";
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@repo/ui/components/tooltip";
import { cn } from "@repo/ui/lib/utils";

import type { ChartFormValues } from "../../charts/chart-config";

export const AGG_NONE = "__none__";
export const TRACE_TYPE_DEFAULT = "__default__";
export const TRACE_TYPE_OPTIONS: SeriesTraceType[] = ["line", "bar", "scatter", "area"];
export const AXIS_OPTIONS: SeriesAxis[] = ["primary", "secondary"];

interface AggregateOption {
  value: string;
  label: string;
  requiresXColumn?: boolean;
}

export interface YSeriesItemProps {
  form: UseFormReturn<ChartFormValues>;
  dsIndex: number;
  seriesIndex: number;
  seriesColumn: string;
  canRemove: boolean;
  willBeSilentlyDropped: boolean;
  aggregateValue: string;
  columns: DataColumn[];
  effectiveErrorColumns: DataColumn[];
  xColumnName: string;
  aggregateOptions: AggregateOption[];
  showCartesianControls: boolean;
  showErrorColumn: boolean;
  showSeriesColor: boolean;
  hideAggregate: boolean;
  isColorMapped: boolean;
  defaultTraceType: SeriesTraceType | undefined;
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
  columns,
  effectiveErrorColumns,
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
    <div className="bg-muted/30 space-y-3 rounded-md border p-3">
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
        <div className="flex items-start gap-1.5 text-[11px] text-amber-600 dark:text-amber-400">
          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
          <span>{t("workspace.shelves.seriesSilentlyDropped")}</span>
        </div>
      )}

      <div className="grid grid-cols-[1fr_auto] items-end gap-3">
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

        {!hideAggregate && (
          <FormItem className="w-[140px]">
            <FormLabel className="text-xs font-medium">
              {t("workspace.shelves.aggregate")}
            </FormLabel>
            <Select
              value={aggregateValue}
              onValueChange={(v) => onAggregateChange(v, dsIndex)}
              disabled={!seriesColumn}
            >
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
                {aggregateOptions.map((fn) => {
                  const blocked = fn.requiresXColumn === true && !xColumnName;
                  return (
                    <SelectItem
                      key={fn.value}
                      value={fn.value}
                      disabled={blocked}
                      title={blocked ? t("workspace.shelves.aggregateNeedsXColumn") : undefined}
                    >
                      {blocked
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
          <FormField
            control={form.control}
            name={`config.color.${seriesIndex}` as const}
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs font-medium">
                  {t("workspace.shelves.color")}
                </FormLabel>
                <FormControl>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-2">
                        <Input
                          type="color"
                          className="h-9 w-12 shrink-0 p-1"
                          value={field.value ?? "#3b82f6"}
                          onChange={field.onChange}
                          disabled={isColorMapped}
                        />
                        <Input
                          type="text"
                          className="min-w-0 font-mono text-sm"
                          placeholder="#000000"
                          value={field.value ?? ""}
                          onChange={field.onChange}
                          disabled={isColorMapped}
                        />
                      </div>
                    </TooltipTrigger>
                    {isColorMapped && (
                      <TooltipContent>
                        {t("workspace.shelves.seriesColorDisabledByColorDimension")}
                      </TooltipContent>
                    )}
                  </Tooltip>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
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
    </div>
  );
}
