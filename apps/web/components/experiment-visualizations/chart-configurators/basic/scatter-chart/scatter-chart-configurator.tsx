"use client";

import { ScatterChart, Eye, Database } from "lucide-react";
import { useFieldArray } from "react-hook-form";
import type { UseFormReturn } from "react-hook-form";
import type { SampleTable } from "~/hooks/experiment/useExperimentData/useExperimentData";

import { useTranslation } from "@repo/i18n";
import {
  Badge,
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
  Slider,
} from "@repo/ui/components";

import type { ChartFormValues } from "../../chart-configurator-util";
import ColorDimensionConfiguration from "../../shared/color-dimension-configuration";
import XAxisConfiguration from "../../shared/x-axis-configuration";
import YAxisConfiguration from "../../shared/y-axis-configuration";

interface ScatterChartConfiguratorProps {
  form: UseFormReturn<ChartFormValues>;
  table: SampleTable;
  onColumnSelect: (columnType: string, columnName: string) => void;
}

export default function ScatterChartConfigurator({
  form,
  table,
  onColumnSelect,
}: ScatterChartConfiguratorProps) {
  const { t } = useTranslation("experimentVisualizations");
  const { t: tCommon } = useTranslation("common");

  // Use field array for multiple Y-axis series
  const {
    fields: dataSourceFields,
    append: appendDataSource,
    remove: removeDataSource,
  } = useFieldArray({
    control: form.control,
    name: "dataConfig.dataSources",
  });

  // Get data sources by role
  const xAxisDataSources = dataSourceFields
    .map((field, index) => ({ field, index }))
    .filter(({ field }) => field.role === "x");
  const yAxisDataSources = dataSourceFields
    .map((field, index) => ({ field, index }))
    .filter(({ field }) => field.role === "y");
  const colorAxisDataSources = dataSourceFields
    .map((field, index) => ({ field, index }))
    .filter(({ field }) => field.role === "color");

  const addYAxisSeries = () => {
    appendDataSource({
      tableName: form.watch("dataConfig.tableName") || "",
      columnName: "",
      role: "y",
      alias: "",
    });
  };

  return (
    <div className="space-y-8">
      {/* Data Configuration */}
      <Card className="shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <Database className="text-primary h-5 w-5" />
            <CardTitle className="text-lg font-semibold">{t("dataConfiguration")}</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* X-Axis Configuration */}
          <XAxisConfiguration
            form={form}
            table={table}
            onColumnSelect={onColumnSelect}
            xAxisDataSources={xAxisDataSources}
          />

          {/* Y-Axes Series Configuration */}
          <YAxisConfiguration
            form={form}
            table={table}
            onColumnSelect={onColumnSelect}
            yAxisDataSources={yAxisDataSources}
            addYAxisSeries={addYAxisSeries}
            removeDataSource={removeDataSource}
          />

          {/* Color Dimension Configuration */}
          <ColorDimensionConfiguration
            form={form}
            table={table}
            colorAxisDataSources={colorAxisDataSources}
            appendDataSource={appendDataSource}
            removeDataSource={removeDataSource}
            onColumnSelect={onColumnSelect}
          />
        </CardContent>
      </Card>

      {/* Scatter Chart Options & Appearance */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Scatter Chart Options */}
        <Card className="bg-white shadow-sm">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <ScatterChart className="text-primary h-5 w-5" />
              <CardTitle className="text-lg font-semibold">
                {t("chartOptions.scatterOptions")}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-6">
              <FormField
                control={form.control}
                name="config.mode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">
                      {t("chartOptions.scatterMode")}
                    </FormLabel>
                    <Select value={String(field.value)} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="h-10 bg-white">
                          <SelectValue placeholder={t("selectMode")} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="markers">{t("scatterModes.markers")}</SelectItem>
                        <SelectItem value="lines+markers">
                          {t("scatterModes.linesMarkers")}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="config.marker.size"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">
                      {t("chartOptions.markerSize")}
                    </FormLabel>
                    <FormControl>
                      <div className="space-y-3">
                        <Slider
                          min={1}
                          max={20}
                          step={1}
                          value={[typeof field.value === "number" ? field.value : 6]}
                          onValueChange={(values) => field.onChange(values[0])}
                          className="w-full"
                        />
                        <div className="flex items-center justify-center">
                          <Badge variant="outline" className="font-mono text-xs">
                            {Number(field.value)}px
                          </Badge>
                        </div>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="config.marker.symbol"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">
                      {t("chartOptions.markerShape")}
                    </FormLabel>
                    <Select value={String(field.value)} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="h-10 bg-white">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="circle">{t("shapes.circle")}</SelectItem>
                        <SelectItem value="square">{t("shapes.square")}</SelectItem>
                        <SelectItem value="diamond">{t("shapes.diamond")}</SelectItem>
                        <SelectItem value="triangle">{t("shapes.triangle")}</SelectItem>
                        <SelectItem value="cross">{t("shapes.cross")}</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="config.showGrid"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">
                      {t("chartOptions.showGrid")}
                    </FormLabel>
                    <Select
                      value={field.value?.toString()}
                      onValueChange={(value) => field.onChange(value === "true")}
                    >
                      <FormControl>
                        <SelectTrigger className="h-10 bg-white">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="true">{tCommon("common.yes")}</SelectItem>
                        <SelectItem value="false">{tCommon("common.no")}</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Show Color Bar - only when color mapping is configured */}
              {colorAxisDataSources.length > 0 && colorAxisDataSources[0]?.field.columnName && (
                <FormField
                  control={form.control}
                  name="config.marker.showscale"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium">
                        {t("chartOptions.showColorbar")}
                      </FormLabel>
                      <Select
                        value={String(field.value)}
                        onValueChange={(value) => field.onChange(value === "true")}
                      >
                        <FormControl>
                          <SelectTrigger className="h-10 bg-white">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="true">{tCommon("common.yes")}</SelectItem>
                          <SelectItem value="false">{tCommon("common.no")}</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>
          </CardContent>
        </Card>

        {/* Display Options */}
        <Card className="bg-white shadow-sm">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <Eye className="text-primary h-5 w-5" />
              <CardTitle className="text-lg font-semibold">{t("displayOptions")}</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-6">
              <FormField
                control={form.control}
                name="config.title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">{t("chartTitle")}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={t("enterChartTitle")}
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
                name="config.showLegend"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">{t("showLegend")}</FormLabel>
                    <Select
                      value={String(field.value)}
                      onValueChange={(value) => field.onChange(value === "true")}
                    >
                      <FormControl>
                        <SelectTrigger className="h-10 bg-white">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="true">{tCommon("common.yes")}</SelectItem>
                        <SelectItem value="false">{tCommon("common.no")}</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
