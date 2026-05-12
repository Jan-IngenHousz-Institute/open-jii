"use client";

import type { UseFormReturn } from "react-hook-form";
import { useWatch } from "react-hook-form";

import type { DataColumn } from "@repo/api/schemas/experiment.schema";
import { useTranslation } from "@repo/i18n";
import { Badge } from "@repo/ui/components/badge";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@repo/ui/components/form";
import { Input } from "@repo/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";

import { defaultAxisTypeFor, firstDataSourceByRole } from "../../charts/form-values";
import type { ChartFormValues } from "../../charts/form-values";

interface XAxisShelfProps {
  form: UseFormReturn<ChartFormValues>;
  columns: DataColumn[];
}

export function XAxisShelf({ form, columns }: XAxisShelfProps) {
  const { t } = useTranslation("experimentVisualizations");

  const sources = useWatch({ control: form.control, name: "dataConfig.dataSources" });
  const indexed = firstDataSourceByRole(sources, "x");
  const xIndex = indexed?.index ?? 0;

  const handleColumnChange = (value: string) => {
    const tableName = form.getValues("dataConfig.tableName");
    form.setValue(`dataConfig.dataSources.${xIndex}.tableName`, tableName);
    form.setValue("config.xAxisTitle", value);
    // Auto-pick the axis scale for the picked column's data type. Strings
    // become category axes, timestamps/dates become date axes, numerics
    // stay linear. Users can still override via the "Axis type" select.
    const picked = columns.find((c) => c.name === value);
    form.setValue("config.xAxisType", defaultAxisTypeFor(picked?.type_text), {
      shouldDirty: true,
    });
  };

  return (
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
                handleColumnChange(value);
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

      <div className="grid grid-cols-2 gap-3">
        <FormField
          control={form.control}
          name="config.xAxisTitle"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-medium">
                {t("workspace.shelves.axisTitle")}
              </FormLabel>
              <FormControl>
                <Input placeholder={t("workspace.shelves.axisTitlePlaceholder")} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="config.xAxisType"
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
                  <SelectItem value="category">
                    {t("workspace.axisTypes.category", "Category")}
                  </SelectItem>
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
