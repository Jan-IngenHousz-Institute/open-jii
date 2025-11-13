"use client";

import { Plus, Trash2, Layers } from "lucide-react";
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

import type { ChartFormValues } from "../../chart-configurator-util";
import { getDefaultSeriesColor } from "../../chart-configurator-util";

interface YAxisConfigurationProps {
  form: UseFormReturn<ChartFormValues>;
  table: SampleTable;
  yAxisDataSources: { field: { id: string; columnName: string; role: string }; index: number }[];
  addYAxisSeries: () => void;
  removeDataSource: (index: number) => void;
  isColorColumnSelected?: boolean;
}

export default function YAxisConfiguration({
  form,
  table,
  yAxisDataSources,
  addYAxisSeries,
  removeDataSource,
  isColorColumnSelected = false,
}: YAxisConfigurationProps) {
  const { t } = useTranslation("experimentVisualizations");

  const handleYAxisColumnChange = (value: string, seriesIndex: number) => {
    // Auto-fill Y-axis title for the first series
    if (seriesIndex === 0) {
      form.setValue("config.yAxisTitle", value);
    }

    // Handle alias assignment for the data source
    const currentAlias = form.getValues(
      `dataConfig.dataSources.${yAxisDataSources[seriesIndex]?.index}.alias`,
    );
    if (!currentAlias || currentAlias === "") {
      form.setValue(
        `dataConfig.dataSources.${yAxisDataSources[seriesIndex]?.index}.alias` as const,
        value,
      );
    }
  };

  // Simple wrapper to add series with color
  const handleAddYAxisSeries = () => {
    addYAxisSeries();
    // Add corresponding color for the new series
    const currentColors = form.getValues("config.color");
    const newSeriesColor = getDefaultSeriesColor(yAxisDataSources.length);
    if (Array.isArray(currentColors)) {
      // Add to existing array
      form.setValue("config.color", [...currentColors, newSeriesColor]);
    } else {
      // Convert single color to array and add new color
      form.setValue("config.color", [currentColors ?? "#3b82f6", newSeriesColor]);
    }
  };

  return (
    <div className="space-y-6 pt-6">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold leading-none tracking-tight">
          {t("configuration.columns.yAxis")}
        </h3>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleAddYAxisSeries}
          className="h-8 px-3"
        >
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          {t("configuration.series.add")}
        </Button>
      </div>

      <div className="space-y-4">
        {yAxisDataSources.map(({ field, index: dataSourceIndex }, seriesIndex) => {
          const columnName = form.watch(`dataConfig.dataSources.${dataSourceIndex}.columnName`);
          return (
            <Card key={field.id} className="border-l-primary/20 border-l-4 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-5 pt-4">
                <div className="flex items-center gap-2">
                  <Layers className="text-primary h-4 w-4" />
                  <CardTitle className="text-sm font-medium">
                    {columnName || `${t("configuration.series.title")} ${seriesIndex + 1}`}
                  </CardTitle>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeDataSource(dataSourceIndex)}
                  className={`h-8 w-8 p-0 ${
                    yAxisDataSources.length > 1
                      ? "text-muted-foreground hover:text-destructive"
                      : "invisible"
                  }`}
                  disabled={yAxisDataSources.length <= 1}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  {/* Data Column */}
                  <FormField
                    control={form.control}
                    name={`dataConfig.dataSources.${dataSourceIndex}.columnName` as const}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium">
                          {t("configuration.columns.dataColumn")}
                        </FormLabel>
                        <Select
                          value={String(field.value)}
                          onValueChange={(value) => {
                            field.onChange(value);
                            handleYAxisColumnChange(value, seriesIndex);
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

                  {/* Series Name */}
                  <FormField
                    control={form.control}
                    name={`dataConfig.dataSources.${dataSourceIndex}.alias` as const}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium">
                          {t("configuration.series.name")}
                        </FormLabel>
                        <FormControl>
                          <Input
                            placeholder={t("configuration.placeholders.enterSeriesName")}
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
                    name={`config.color.${seriesIndex}` as const}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium">
                          {t("configuration.series.color")}
                        </FormLabel>
                        <FormControl>
                          <div className="flex items-center gap-2">
                            <Input
                              type="color"
                              className="h-10 w-12 border-2 bg-white p-1"
                              value={field.value}
                              onChange={field.onChange}
                              onBlur={field.onBlur}
                              name={field.name}
                              ref={field.ref}
                              disabled={isColorColumnSelected}
                            />
                            <Input
                              type="text"
                              className="h-10 flex-1 bg-white font-mono text-sm"
                              placeholder="#000000"
                              value={field.value}
                              onChange={field.onChange}
                              onBlur={field.onBlur}
                              name={field.name}
                              ref={field.ref}
                              disabled={isColorColumnSelected}
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
                          {t("configuration.axes.type")}
                        </FormLabel>
                        <Select value={String(field.value)} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger className="h-10 bg-white">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="linear">
                              {t("configuration.axisTypes.linear")}
                            </SelectItem>
                            <SelectItem value="log">{t("configuration.axisTypes.log")}</SelectItem>
                            <SelectItem value="date">
                              {t("configuration.axisTypes.date")}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Show Y-Axis Title only for first series */}
                  {seriesIndex === 0 && (
                    <FormField
                      control={form.control}
                      name="config.yAxisTitle"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-medium">
                            {t("configuration.axes.title")}
                          </FormLabel>
                          <FormControl>
                            <Input
                              placeholder={t("configuration.placeholders.enterAxisTitle")}
                              className="h-10 bg-white"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
