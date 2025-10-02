"use client";

import type { UseFormReturn } from "react-hook-form";
import type { SampleTable } from "~/hooks/experiment/useExperimentData/useExperimentData";

import type { DataColumn } from "@repo/api";
import { useTranslation } from "@repo/i18n";
import {
  Badge,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components";

import type { ChartFormValues } from "../chart-configurator-util";

interface XAxisConfigurationProps {
  form: UseFormReturn<ChartFormValues>;
  table: SampleTable;
  onColumnSelect: (columnType: string, columnName: string) => void;
  xAxisDataSources?: { field: { columnName: string; role: string }; index: number }[];
}

export default function XAxisConfiguration({
  form,
  table,
  onColumnSelect,
  xAxisDataSources,
}: XAxisConfigurationProps) {
  const { t } = useTranslation("experimentVisualizations");

  const handleXAxisColumnChange = (value: string) => {
    onColumnSelect("x", value);
    // Auto-fill X-axis title if it's empty
    const currentXAxisTitle = form.getValues("config.xAxisTitle");
    if (!currentXAxisTitle || currentXAxisTitle.trim() === "") {
      form.setValue("config.xAxisTitle", value);
    }
  };

  return (
    <div className="rounded-lg border bg-white p-4">
      <h4 className="text-muted-foreground mb-3 text-sm font-medium uppercase tracking-wide">
        {t("xAxisConfiguration")}
      </h4>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <FormField
          control={form.control}
          name={
            xAxisDataSources?.[0]
              ? `dataConfig.dataSources.${xAxisDataSources[0].index}.columnName`
              : "dataConfig.dataSources.0.columnName"
          }
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-sm font-medium">{t("configuration.xAxis")}</FormLabel>
              <Select
                value={String(field.value)}
                onValueChange={(value) => {
                  field.onChange(value);
                  handleXAxisColumnChange(value);
                }}
              >
                <FormControl>
                  <SelectTrigger className="h-10 bg-white">
                    <SelectValue placeholder={t("configuration.selectColumn")} />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {table.columns.map((column: DataColumn) => (
                    <SelectItem key={column.name} value={column.name}>
                      <div className="flex items-center gap-2">
                        <span>{column.name}</span>
                        <Badge variant="secondary" className="text-xs">
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
          name="config.xAxisTitle"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-sm font-medium">{t("xAxisTitle")}</FormLabel>
              <FormControl>
                <Input
                  placeholder={t("enterAxisTitle")}
                  className="h-10 bg-white"
                  value={typeof field.value === "string" ? field.value : ""}
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
          name="config.xAxisType"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-sm font-medium">{t("configuration.axisType")}</FormLabel>
              <Select value={String(field.value)} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger className="h-10 bg-white">
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="linear">{t("axisTypes.linear")}</SelectItem>
                  <SelectItem value="log">{t("axisTypes.log")}</SelectItem>
                  <SelectItem value="date">{t("axisTypes.date")}</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </div>
  );
}