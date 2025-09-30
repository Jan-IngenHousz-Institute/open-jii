"use client";

import { Plus, Trash2, BarChart3, Layers, Eye, Database } from "lucide-react";
import type { UseFormReturn } from "react-hook-form";
import { useFieldArray } from "react-hook-form";

import type { DataColumn } from "@repo/api";
import { useTranslation } from "@repo/i18n";
import {
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
  Slider,
  Badge,
  Switch,
} from "@repo/ui/components";

import type { ChartFormValues, SampleTable } from "../../types";

interface HistogramChartConfiguratorProps {
  form: UseFormReturn<ChartFormValues>;
  table: SampleTable;
  onColumnSelect: (columnType: string, columnName: string) => void;
}

export default function HistogramChartConfigurator({
  form,
  table,
  onColumnSelect,
}: HistogramChartConfiguratorProps) {
  const { t } = useTranslation("experimentVisualizations");
  const { t: tCommon } = useTranslation("common");

  // Hook for managing data sources array
  const {
    fields: dataSourceFields,
    append: appendDataSource,
    remove: removeDataSource,
  } = useFieldArray({
    control: form.control,
    name: "dataConfig.dataSources",
  });

  // Get value data sources
  const valueDataSources = dataSourceFields
    .map((field, index) => ({ field, index }))
    .filter(({ field }) => field.role === "value");

  // Function to add a new histogram series
  const addHistogramSeries = () => {
    const selectedTableName = form.getValues("dataConfig.tableName") || table.name;
    appendDataSource({
      columnName: "",
      tableName: selectedTableName,
      alias: `Series ${dataSourceFields.length + 1}`,
      role: "value",
    });
  };

  const numericColumns = table.columns.filter(
    (col: DataColumn) =>
      col.type_name === "DOUBLE" ||
      col.type_name === "INT" ||
      col.type_name === "LONG" ||
      col.type_name === "BIGINT",
  );

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
          {/* Value Data Sources Configuration */}
          <div className="rounded-lg border bg-white p-4">
            <div className="mb-4 flex items-center justify-between">
              <h4 className="text-muted-foreground text-sm font-medium uppercase tracking-wide">
                {t("valueConfiguration")}
              </h4>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addHistogramSeries}
                className="h-8 px-3"
              >
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                {t("configuration.addSeries")}
              </Button>
            </div>

            <div className="space-y-4">
              {valueDataSources.map(({ field, index }) => (
                <Card key={field.id} className="border-l-primary/20 border-l-4 shadow-sm">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                    <div className="flex items-center gap-2">
                      <Layers className="text-primary h-4 w-4" />
                      <CardTitle className="text-sm font-medium">
                        {t("series")} {valueDataSources.findIndex((v) => v.index === index) + 1}
                      </CardTitle>
                    </div>
                    {valueDataSources.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeDataSource(index)}
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
                        name={`dataConfig.dataSources.${index}.columnName` as const}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-medium">
                              {t("valueColumn")}
                            </FormLabel>
                            <Select
                              value={field.value}
                              onValueChange={(value) => {
                                field.onChange(value);
                                onColumnSelect("value", value);
                              }}
                            >
                              <FormControl>
                                <SelectTrigger className="h-10 bg-white">
                                  <SelectValue placeholder={t("configuration.selectColumn")} />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {numericColumns.map((column: DataColumn) => (
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

                      {/* Series Label */}
                      <FormField
                        control={form.control}
                        name={`dataConfig.dataSources.${index}.alias` as const}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-medium">
                              {t("seriesLabel")}
                            </FormLabel>
                            <FormControl>
                              <Input
                                placeholder={t("enterSeriesLabel")}
                                className="h-10 bg-white"
                                {...field}
                                value={String(field.value)}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Two-column layout: Chart Options (left) and Display Options (right) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Chart Options */}
        <Card className="bg-white shadow-sm">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="text-primary h-5 w-5" />
              <CardTitle className="text-lg font-semibold">{t("chartOptions.title")}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="config.nbins"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">
                      {t("configuration.numberOfBins")}
                    </FormLabel>
                    <FormControl>
                      <div className="space-y-3">
                        <Slider
                          min={5}
                          max={100}
                          step={1}
                          value={[Number(field.value)]}
                          onValueChange={(values) => field.onChange(values[0])}
                          className="w-full"
                        />
                        <div className="text-muted-foreground flex items-center justify-between text-xs">
                          <span>5</span>
                          <Badge variant="outline" className="font-mono text-xs">
                            {Number(field.value) || 20}
                          </Badge>
                          <span>100</span>
                        </div>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="config.barmode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">
                      {t("configuration.barMode")}
                    </FormLabel>
                    <Select
                      value={String(field.value)}
                      onValueChange={(value) => field.onChange(value === "none" ? "" : value)}
                    >
                      <FormControl>
                        <SelectTrigger className="h-10 bg-white">
                          <SelectValue placeholder={tCommon("none")} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">{tCommon("none")}</SelectItem>
                        <SelectItem value="overlay">{t("barModes.overlay")}</SelectItem>
                        <SelectItem value="group">{t("barModes.group")}</SelectItem>
                        <SelectItem value="stack">{t("barModes.stack")}</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="config.orientation"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium">
                    {t("chartOptions.orientation")}
                  </FormLabel>
                  <Select
                    value={String(field.value)}
                    onValueChange={(value) => field.onChange(value === "none" ? "" : value)}
                  >
                    <FormControl>
                      <SelectTrigger className="h-10 bg-white">
                        <SelectValue placeholder={tCommon("none")} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">{tCommon("none")}</SelectItem>
                      <SelectItem value="v">{t("orientations.vertical")}</SelectItem>
                      <SelectItem value="h">{t("orientations.horizontal")}</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="config.autobinx"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <FormLabel className="text-sm font-medium">
                      {t("configuration.automaticBinning")}
                    </FormLabel>
                    <div className="text-muted-foreground text-xs">
                      {t("configuration.automaticBinningDescription")}
                    </div>
                  </div>
                  <FormControl className="flex items-center">
                    <Switch checked={Boolean(field.value)} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="config.histfunc"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium">
                    {t("configuration.histogramFunction")}
                  </FormLabel>
                  <Select
                    value={String(field.value)}
                    onValueChange={(value) => field.onChange(value === "none" ? "" : value)}
                  >
                    <FormControl>
                      <SelectTrigger className="h-10 bg-white">
                        <SelectValue placeholder={tCommon("none")} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">{tCommon("none")}</SelectItem>
                      <SelectItem value="count">{t("histogramFunction.count")}</SelectItem>
                      <SelectItem value="sum">{t("histogramFunction.sum")}</SelectItem>
                      <SelectItem value="avg">{t("histogramFunction.avg")}</SelectItem>
                      <SelectItem value="min">{t("histogramFunction.min")}</SelectItem>
                      <SelectItem value="max">{t("histogramFunction.max")}</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="config.histnorm"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium">
                    {t("configuration.normalization")}
                  </FormLabel>
                  <Select
                    value={String(field.value)}
                    onValueChange={(value) => field.onChange(value === "none" ? "" : value)}
                  >
                    <FormControl>
                      <SelectTrigger className="h-10 bg-white">
                        <SelectValue placeholder={tCommon("none")} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">{tCommon("none")}</SelectItem>
                      <SelectItem value="percent">{t("normalization.percent")}</SelectItem>
                      <SelectItem value="probability">{t("normalization.probability")}</SelectItem>
                      <SelectItem value="density">{t("normalization.density")}</SelectItem>
                      <SelectItem value="probability density">
                        {t("normalization.probabilityDensity")}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="config.opacity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium">{t("opacity")}</FormLabel>
                  <FormControl>
                    <div className="space-y-3">
                      <Slider
                        min={0}
                        max={1}
                        step={0.1}
                        value={[Number(field.value)]}
                        onValueChange={(values) => field.onChange(values[0])}
                        className="w-full"
                      />
                      <div className="flex items-center justify-center">
                        <Badge variant="outline" className="font-mono text-xs">
                          {Math.round((Number(field.value) || 0.7) * 100)}%
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
              name="config.gridLines"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium">
                    {t("chartOptions.gridLines")}
                  </FormLabel>
                  <Select value={String(field.value)} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="h-10 bg-white">
                        <SelectValue placeholder={t("gridLines.none")} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="both">{t("gridLines.both")}</SelectItem>
                      <SelectItem value="x">{t("gridLines.x")}</SelectItem>
                      <SelectItem value="y">{t("gridLines.y")}</SelectItem>
                      <SelectItem value="none">{t("gridLines.none")}</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
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
          <CardContent className="space-y-4">
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
                      {...field}
                      value={String(field.value)}
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
                    value={field.value ? "true" : "false"}
                    onValueChange={(value) => field.onChange(value === "true")}
                  >
                    <FormControl>
                      <SelectTrigger className="h-10 bg-white">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="true">{tCommon("yes")}</SelectItem>
                      <SelectItem value="false">{tCommon("no")}</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="config.legendPosition"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium">
                    {t("chartOptions.legendPosition")}
                  </FormLabel>
                  <Select
                    value={String(field.value)}
                    onValueChange={(value) => field.onChange(value === "none" ? "" : value)}
                  >
                    <FormControl>
                      <SelectTrigger className="h-10 bg-white">
                        <SelectValue placeholder={tCommon("none")} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">{tCommon("none")}</SelectItem>
                      <SelectItem value="top">{t("positions.top")}</SelectItem>
                      <SelectItem value="bottom">{t("positions.bottom")}</SelectItem>
                      <SelectItem value="left">{t("positions.left")}</SelectItem>
                      <SelectItem value="right">{t("positions.right")}</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="config.colorScheme"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium">{t("colorScheme")}</FormLabel>
                  <Select
                    value={String(field.value)}
                    onValueChange={(value) => field.onChange(value === "none" ? "" : value)}
                  >
                    <FormControl>
                      <SelectTrigger className="h-10 bg-white">
                        <SelectValue placeholder={tCommon("none")} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">{tCommon("none")}</SelectItem>
                      <SelectItem value="default">{t("colorSchemes.default")}</SelectItem>
                      <SelectItem value="pastel">{t("colorSchemes.pastel")}</SelectItem>
                      <SelectItem value="dark">{t("colorSchemes.dark")}</SelectItem>
                      <SelectItem value="colorblind">{t("colorSchemes.colorblind")}</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
