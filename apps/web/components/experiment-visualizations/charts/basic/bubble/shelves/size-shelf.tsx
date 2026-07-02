"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import { useWatch } from "react-hook-form";

import type { ExperimentAggregationFunction } from "@repo/api/domains/experiment/data/experiment-data.schema";
import type { ExperimentDataColumn } from "@repo/api/domains/experiment/data/experiment-data.schema";
import { useTranslation } from "@repo/i18n";
import { Badge } from "@repo/ui/components/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@repo/ui/components/collapsible";
import { FormControl, FormItem, FormLabel } from "@repo/ui/components/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";
import { cn } from "@repo/ui/lib/utils";

import type { ChartFormValues } from "../../../chart-config";
import { getDataSourceAggregate, setDataSourceAggregate } from "../../../data/aggregation";
import { firstDataSourceByRole } from "../../../data/data-sources";

interface BubbleSizeShelfProps {
  form: UseFormReturn<ChartFormValues>;
  columns: ExperimentDataColumn[];
}

const AGG_NONE = "__none__";

const SIZE_FUNCTIONS: { value: ExperimentAggregationFunction; label: string }[] = [
  { value: "sum", label: "Sum" },
  { value: "avg", label: "Average" },
  { value: "count", label: "Count" },
  { value: "min", label: "Min" },
  { value: "max", label: "Max" },
];

/** Bubble's size channel: measure column + aggregate dropdown (mirrors the Y-axis aggregate UX). */
export function BubbleSizeShelf({ form, columns }: BubbleSizeShelfProps) {
  const { t } = useTranslation("experimentVisualizations");

  const sources = useWatch({ control: form.control, name: "dataConfig.dataSources" });
  const indexed = firstDataSourceByRole(sources, "size");
  const sourceIndex = indexed?.index ?? 0;
  const currentColumn = indexed?.source.columnName ?? "";
  const xColumnName = firstDataSourceByRole(sources, "x")?.source.columnName ?? "";

  const currentFunction = getDataSourceAggregate(sources, sourceIndex) ?? AGG_NONE;

  const handleColumnChange = (value: string) => {
    const tableName = form.getValues("dataConfig.tableName");
    form.setValue(`dataConfig.dataSources.${sourceIndex}.tableName`, tableName);
    form.setValue(`dataConfig.dataSources.${sourceIndex}.columnName`, value);

    // The size channel's aggregate is stored on its data source so a
    // column swap doesn't need a "move aggregate" dance.

    // If aggregation is otherwise active and the size column has no
    // explicit aggregate yet, default to AVG so SQL doesn't drop the
    // column from the projection (which would zero-size all bubbles).
    if (value) {
      const currentAgg = form.getValues("dataConfig.aggregation");
      const xBucket = currentAgg?.groupBy?.find((g) => g.column === xColumnName)?.timeBucket;
      const otherSourcesAggregating = form
        .getValues("dataConfig.dataSources")
        .some((ds, i) => i !== sourceIndex && Boolean(ds.aggregate));
      const aggregationActive = Boolean(xBucket) || otherSourcesAggregating;
      if (
        aggregationActive &&
        form.getValues(`dataConfig.dataSources.${sourceIndex}.aggregate`) === undefined
      ) {
        setDataSourceAggregate(form, sourceIndex, "avg", xColumnName);
      }
    }
  };

  const handleAggregateChange = (raw: string) => {
    const fn = raw === AGG_NONE ? undefined : (raw as ExperimentAggregationFunction);
    setDataSourceAggregate(form, sourceIndex, fn, xColumnName);
  };

  // Always start collapsed (mirrors Filters/Group by); the header chip
  // surfaces the configured column so state reads without expanding.
  const [open, setOpen] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen} asChild>
      <section className="space-y-3">
        <CollapsibleTrigger className="flex w-full items-center gap-2 text-left">
          <h3 className="text-sm font-semibold">{t("workspace.shelves.sizeDimension")}</h3>
          {currentColumn && (
            <span className="text-muted-foreground text-xs">({currentColumn})</span>
          )}
          <ChevronDown
            className={cn(
              "text-muted-foreground ml-auto h-4 w-4 transition-transform",
              open && "rotate-180",
            )}
          />
        </CollapsibleTrigger>

        <CollapsibleContent className="space-y-3">
          <div className="grid grid-cols-[1fr_auto] items-end gap-3">
            <FormItem className="min-w-0">
              <FormLabel className="text-xs font-medium">{t("workspace.shelves.column")}</FormLabel>
              <Select value={currentColumn || undefined} onValueChange={handleColumnChange}>
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
            </FormItem>

            <FormItem className="w-[140px]">
              <FormLabel className="text-xs font-medium">
                {t("workspace.shelves.aggregate")}
              </FormLabel>
              <Select
                value={currentFunction}
                onValueChange={handleAggregateChange}
                disabled={!currentColumn}
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
                  {SIZE_FUNCTIONS.map((fn) => (
                    <SelectItem key={fn.value} value={fn.value}>
                      {fn.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormItem>
          </div>
        </CollapsibleContent>
      </section>
    </Collapsible>
  );
}
