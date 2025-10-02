"use client";

import { Plus, Trash2, Layers, Palette } from "lucide-react";
import type { UseFormReturn } from "react-hook-form";
import type { SampleTable } from "~/hooks/experiment/useExperimentData/useExperimentData";

import type { DataColumn } from "@repo/api";
import { useTranslation } from "@repo/i18n";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
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
  Separator,
} from "@repo/ui/components";

import type { ChartFormValues } from "../chart-configurator-util";

interface YAxisConfigurationProps {
  form: UseFormReturn<ChartFormValues>;
  table: SampleTable;
  onColumnSelect: (columnType: string, columnName: string) => void;
  yAxisDataSources: { field: { id: string; columnName: string; role: string }; index: number }[];
  addYAxisSeries: () => void;
  removeDataSource: (index: number) => void;
}

export default function YAxisConfiguration({
  form,
  table,
  onColumnSelect,
  yAxisDataSources,
  addYAxisSeries,
  removeDataSource,
}: YAxisConfigurationProps) {
  const { t } = useTranslation("experimentVisualizations");

  const handleYAxisColumnChange = (value: string, seriesIndex: number) => {
    onColumnSelect(`y-${seriesIndex}`, value);
    // Auto-fill Y-axis title if it's empty
    const currentYAxisTitle = form.getValues("config.yAxisTitle");
    if (!currentYAxisTitle || currentYAxisTitle.trim() === "") {
      form.setValue("config.yAxisTitle", value);
    }
  };

  return (
    <div className="rounded-lg border bg-white p-4">
      <div className="mb-4 flex items-center justify-between">
        <h4 className="text-muted-foreground text-sm font-medium uppercase tracking-wide">
          {t("yAxesSeries")}
        </h4>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addYAxisSeries}
          className="h-8 px-3"
        >
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          {t("configuration.addSeries")}
        </Button>
      </div>

      <div className="space-y-4">
        {yAxisDataSources.map(({ field, index: dataSourceIndex }, seriesIndex) => (
          <Card key={field.id} className="border-l-primary/20 border-l-4 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <div className="flex items-center gap-2">
                <Layers className="text-primary h-4 w-4" />
                <CardTitle className="text-sm font-medium">
                  {t("series")} {seriesIndex + 1}
                </CardTitle>
              </div>
              {yAxisDataSources.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeDataSource(dataSourceIndex)}
                  className="text-muted-foreground hover:text-destructive h-8 w-8 p-0"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {/* Data Column */}
                <FormField
                  control={form.control}
                  name={`dataConfig.dataSources.${dataSourceIndex}.columnName` as const}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium">{t("dataColumn")}</FormLabel>
                      <Select
                        value={String(field.value)}
                        onValueChange={(value) => {
                          field.onChange(value);
                          handleYAxisColumnChange(value, seriesIndex);
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

                {/* Series Name */}
                <FormField
                  control={form.control}
                  name={`dataConfig.dataSources.${dataSourceIndex}.alias` as const}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium">{t("seriesName")}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={t("enterSeriesName")}
                          className="h-10 bg-white"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <Separator className="my-4" />

              {/* Series Styling */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <FormField
                  control={form.control}
                  name="config.color"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2 text-sm font-medium">
                        <Palette className="h-3.5 w-3.5" />
                        {t("chartOptions.pointColor")}
                      </FormLabel>
                      <FormControl>
                        <div className="flex items-center gap-2">
                          <Input
                            type="color"
                            className="h-10 w-12 border-2 bg-white p-1"
                            value={typeof field.value === "string" ? field.value : "#3b82f6"}
                            onChange={field.onChange}
                            onBlur={field.onBlur}
                            name={field.name}
                            ref={field.ref}
                          />
                          <Input
                            type="text"
                            className="h-10 flex-1 bg-white font-mono text-sm"
                            placeholder="#000000"
                            value={typeof field.value === "string" ? field.value : "#3b82f6"}
                            onChange={field.onChange}
                            onBlur={field.onBlur}
                            name={field.name}
                            ref={field.ref}
                          />
                        </div>
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
                      <FormLabel className="text-sm font-medium">
                        {t("configuration.axisType")}
                      </FormLabel>
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

              {/* Y-axis Title - only show for first axis */}
              {seriesIndex === 0 && (
                <FormField
                  control={form.control}
                  name="config.yAxisTitle"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium">{t("yAxisTitle")}</FormLabel>
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
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}