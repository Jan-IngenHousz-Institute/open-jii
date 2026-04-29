"use client";

import { Plus, Trash2 } from "lucide-react";
import type { UseFormReturn } from "react-hook-form";
import { useFieldArray } from "react-hook-form";

import type { DataColumn } from "@repo/api/schemas/experiment.schema";
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

import {
  dataSourcesByRole,
  getDefaultSeriesColor,
  makeDataSource,
} from "../../charts/form-values";
import type { ChartFormValues } from "../../charts/form-values";

interface YAxisShelfProps {
  form: UseFormReturn<ChartFormValues>;
  columns: DataColumn[];
  /** When true, a per-series Color picker is shown. Disabled if a Color dimension column is selected. */
  showSeriesColor?: boolean;
}

export function YAxisShelf({ form, columns, showSeriesColor = true }: YAxisShelfProps) {
  const { t } = useTranslation("experimentVisualizations");

  const { append, remove } = useFieldArray({
    control: form.control,
    name: "dataConfig.dataSources",
  });

  const sources = form.watch("dataConfig.dataSources");
  const ySources = dataSourcesByRole(sources, "y");
  const colorSources = dataSourcesByRole(sources, "color");
  const isColorMapped = colorSources.length > 0 && Boolean(colorSources[0].source.columnName);

  const handleColumnChange = (value: string, seriesIndex: number) => {
    if (seriesIndex === 0) {
      form.setValue("config.yAxisTitle", value);
    }
    const yEntry = ySources[seriesIndex];
    if (!yEntry) return;
    const aliasKey = `dataConfig.dataSources.${yEntry.index}.alias` as const;
    if (!form.getValues(aliasKey)) {
      form.setValue(aliasKey, value);
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
      form.setValue("config.color", [(currentColors as string | undefined) ?? "#3b82f6", next]);
    }
  };

  return (
    <section className="space-y-3">
      <header className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{t("workspace.shelves.yAxis")}</h3>
        <Button type="button" variant="ghost" size="sm" onClick={handleAddSeries}>
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          {t("workspace.shelves.addSeries")}
        </Button>
      </header>

      <div className="space-y-3">
        {ySources.map((entry, seriesIndex) => {
          const dsIndex = entry.index;
          const canRemove = ySources.length > 1;
          return (
            <div key={entry.source.role + dsIndex} className="bg-muted/30 space-y-3 rounded-md border p-3">
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
                  <FormItem>
                    <FormLabel className="text-xs font-medium">
                      {t("workspace.shelves.column")}
                    </FormLabel>
                    <Select
                      value={String(field.value ?? "")}
                      onValueChange={(value) => {
                        field.onChange(value);
                        handleColumnChange(value, seriesIndex);
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

              <div
                className={
                  showSeriesColor ? "grid grid-cols-2 gap-3" : ""
                }
              >
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
                          <div className="flex items-center gap-2">
                            <Input
                              type="color"
                              className="h-9 w-12 shrink-0 p-1"
                              value={(field.value as string) ?? "#3b82f6"}
                              onChange={field.onChange}
                              disabled={isColorMapped}
                            />
                            <Input
                              type="text"
                              className="min-w-0 font-mono text-sm"
                              placeholder="#000000"
                              value={(field.value as string) ?? ""}
                              onChange={field.onChange}
                              disabled={isColorMapped}
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <FormField
          control={form.control}
          name="config.yAxisTitle"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-medium">{t("workspace.shelves.axisTitle")}</FormLabel>
              <FormControl>
                <Input
                  placeholder={t("workspace.shelves.axisTitlePlaceholder")}
                  value={(field.value as string | undefined) ?? ""}
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
          name="config.yAxisType"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-medium">{t("workspace.shelves.axisType")}</FormLabel>
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
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </section>
  );
}
