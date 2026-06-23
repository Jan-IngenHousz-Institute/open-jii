"use client";

import { Plus, Trash2 } from "lucide-react";
import type { UseFormReturn } from "react-hook-form";
import { useWatch } from "react-hook-form";

import type { DataColumn, Role } from "@repo/api/schemas/experiment.schema";
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

import type { ChartFormValues } from "../../charts/chart-config";
import { getDefaultSeriesColor } from "../../charts/colors/palettes";
import { dataSourcesByRole, makeDataSource } from "../../charts/data/data-sources";
import { useDataSourcesFieldArray } from "../context/data-sources-field-array-context";

interface MultiColumnShelfProps {
  form: UseFormReturn<ChartFormValues>;
  columns: DataColumn[];
  role: Role;
  heading: string;
  columnLabel: string;
  placeholder: string;
  maxSeries?: number;
  minSeries?: number;
  showAlias?: boolean;
  showSeriesColor?: boolean;
}

export function MultiColumnShelf({
  form,
  columns,
  role,
  heading,
  columnLabel,
  placeholder,
  maxSeries,
  minSeries = 1,
  showAlias = false,
  showSeriesColor = false,
}: MultiColumnShelfProps) {
  const { t } = useTranslation("experimentVisualizations");

  const { append, remove } = useDataSourcesFieldArray();

  const sources = useWatch({ control: form.control, name: "dataConfig.dataSources" });
  const entries = dataSourcesByRole(sources, role);
  // A color dimension takes precedence over per-series colors: when it's
  // set, the renderer cycles palette colors by category, so the per-
  // series picker has no visible effect. Disable + tooltip rather than
  // silently ignoring user input. Mirrors y-axis-shelf's isColorMapped.
  const colorSources = dataSourcesByRole(sources, "color");
  const isColorMapped = colorSources.length > 0 && Boolean(colorSources[0]?.source.columnName);

  const handleColumnChange = (value: string, dsIndex: number, seriesIndex: number) => {
    // Stamp alias from column name so the legend reads sensibly by default.
    if (showAlias) {
      form.setValue(`dataConfig.dataSources.${dsIndex}.alias` as const, value);
    }
    if (seriesIndex === 0) {
      form.setValue("config.yAxisTitle", value);
    }
  };

  const handleAddSeries = () => {
    const tableName = form.getValues("dataConfig.tableName");
    append(makeDataSource(tableName, role));

    if (showSeriesColor) {
      const currentColors = form.getValues("config.color");
      const next = getDefaultSeriesColor(entries.length);
      if (Array.isArray(currentColors)) {
        form.setValue("config.color", [...currentColors, next]);
      } else {
        form.setValue("config.color", [currentColors ?? "#3b82f6", next]);
      }
    }
  };

  return (
    <section className="space-y-3">
      <header className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{heading}</h3>
        {(maxSeries === undefined || entries.length < maxSeries) && (
          <Button type="button" variant="ghost" size="sm" onClick={handleAddSeries}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            {t("workspace.shelves.addSeries")}
          </Button>
        )}
      </header>

      <div className="space-y-3">
        {entries.map((entry, seriesIndex) => {
          const dsIndex = entry.index;
          const canRemove = entries.length > minSeries;
          return (
            <div
              key={entry.source.role + dsIndex}
              className="bg-muted/30 space-y-3 rounded-md border p-3"
            >
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
                    onClick={() => remove(dsIndex)}
                    aria-label={t("workspace.shelves.removeSeries")}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>

              <FormField
                control={form.control}
                name={`dataConfig.dataSources.${dsIndex}.columnName` as const}
                render={({ field }) => (
                  <FormItem className="min-w-0">
                    <FormLabel className="text-xs font-medium">{columnLabel}</FormLabel>
                    <Select
                      value={String(field.value)}
                      onValueChange={(value) => {
                        field.onChange(value);
                        handleColumnChange(value, dsIndex, seriesIndex);
                      }}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={placeholder} />
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

              {(showAlias || showSeriesColor) && (
                <div className={showSeriesColor && showAlias ? "grid grid-cols-2 gap-3" : ""}>
                  {showAlias && (
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
                  )}

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
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
