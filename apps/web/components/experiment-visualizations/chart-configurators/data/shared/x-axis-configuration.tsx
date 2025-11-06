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

import type { ChartFormValues } from "../../chart-configurator-util";

interface XAxisConfigurationProps {
  form: UseFormReturn<ChartFormValues>;
  table: SampleTable;
  xAxisDataSources?: { field: { columnName: string; role: string }; index: number }[];
}

export default function XAxisConfiguration({
  form,
  table,
  xAxisDataSources,
}: XAxisConfigurationProps) {
  const { t } = useTranslation("experimentVisualizations");

  const handleXAxisColumnChange = (value: string) => {
    // Update table name for X-axis data source if needed
    const tableName = form.getValues("dataConfig.tableName");
    const xAxisDataSourceIndex = xAxisDataSources?.[0]?.index ?? 0;
    form.setValue(`dataConfig.dataSources.${xAxisDataSourceIndex}.tableName`, tableName);

    // Auto-fill X-axis title if it's empty
    const currentXAxisTitle = form.getValues("config.xAxisTitle");
    if (!currentXAxisTitle || currentXAxisTitle.trim() === "") {
      form.setValue("config.xAxisTitle", value);
    }
  };

  return (
    <div className="space-y-4">
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
              <FormLabel className="text-sm font-medium">
                {t("configuration.columns.xAxis")}
              </FormLabel>
              <Select
                value={String(field.value)}
                onValueChange={(value) => {
                  field.onChange(value);
                  handleXAxisColumnChange(value);
                }}
              >
                <FormControl>
                  <SelectTrigger className="h-10 bg-white">
                    <SelectValue placeholder={t("configuration.columns.select")} />
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
              <FormLabel className="text-sm font-medium">{t("configuration.axes.title")}</FormLabel>
              <FormControl>
                <Input
                  placeholder={t("configuration.placeholders.enterAxisTitle")}
                  className="h-10 bg-white"
                  value={field.value}
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
              <FormLabel className="text-sm font-medium">{t("configuration.axes.type")}</FormLabel>
              <Select value={String(field.value)} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger className="h-10 bg-white">
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="linear">{t("configuration.axisTypes.linear")}</SelectItem>
                  <SelectItem value="log">{t("configuration.axisTypes.log")}</SelectItem>
                  <SelectItem value="date">{t("configuration.axisTypes.date")}</SelectItem>
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
