"use client";

import { Plus, X as XIcon } from "lucide-react";
import { useParams } from "next/navigation";
import { useMemo } from "react";
import type { UseFormReturn } from "react-hook-form";
import { useFieldArray, useWatch } from "react-hook-form";

import type { DataColumn } from "@repo/api/schemas/experiment.schema";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@repo/ui/components/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";

import { useExperimentVisualizationData } from "../../../../hooks/experiment/useExperimentVisualizationData/useExperimentVisualizationData";
import type { ChartFormValues } from "../../charts/form-values";

interface FiltersShelfProps {
  form: UseFormReturn<ChartFormValues>;
  /**
   * Columns the user can pick from in the filter column dropdown. Each
   * chart type narrows this to its own filter-eligible set (typically
   * categorical columns).
   */
  filterableColumns: DataColumn[];
}

/**
 * Per-chart row-filter shelf. Renders a list of `equals` filter rows
 * against `dataConfig.filters` plus an "Add filter" trigger. The renderer
 * side honours the persisted filters via `applyRowFilters` before any
 * chart-specific aggregation or series construction runs.
 */
export function FiltersShelf({ form, filterableColumns }: FiltersShelfProps) {
  const { t } = useTranslation("experimentVisualizations");
  const {
    fields: filterFields,
    append: appendFilter,
    remove: removeFilter,
  } = useFieldArray({ control: form.control, name: "dataConfig.filters" });
  const filtersWatchedRaw = useWatch({ control: form.control, name: "dataConfig.filters" });
  const filtersWatched = useMemo(() => filtersWatchedRaw ?? [], [filtersWatchedRaw]);

  const routeParams = useParams<{ id: string }>();
  const resolvedExperimentId = routeParams.id;
  const tableName = useWatch({ control: form.control, name: "dataConfig.tableName" });

  const activeFilterColumns = useMemo(() => {
    const set = new Set<string>();
    for (const f of filtersWatched) {
      if (f.column) set.add(f.column);
    }
    return Array.from(set);
  }, [filtersWatched]);

  // Fetch a sample of the configured filter columns so the value picker
  // is a closed list of real values rather than a free-form input — that
  // way the user can't typo a school name and end up with an empty chart.
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
    <section className="space-y-3">
      <header className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{t("workspace.shelves.filters")}</h3>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => appendFilter({ column: "", operator: "equals", value: "" })}
        >
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          {t("workspace.shelves.addFilter")}
        </Button>
      </header>
      {filterFields.length === 0 && (
        <p className="text-muted-foreground text-xs">{t("workspace.shelves.noFiltersHelp")}</p>
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
                    {t("workspace.shelves.filterColumn")}
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
                      {filterableColumns.map((column) => (
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
                    {t("workspace.shelves.filterValue")}
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
                              ? t("workspace.shelves.filterValuePickColumn")
                              : valueOptions.length === 0
                                ? t("workspace.shelves.filterValueLoading")
                                : t("workspace.shelves.filterValuePlaceholder")
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
              aria-label={t("workspace.shelves.removeFilter")}
            >
              <XIcon className="h-4 w-4" />
            </Button>
          </div>
        );
      })}
    </section>
  );
}
