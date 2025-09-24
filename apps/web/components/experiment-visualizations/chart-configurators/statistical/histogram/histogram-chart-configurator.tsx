"use client";

import { Plus, Trash2, BarChart3, Layers, Eye, Palette, Database } from "lucide-react";
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
  Separator,
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

  // Hook for managing series array
  const {
    fields: seriesFields,
    append: appendSeries,
    remove: removeSeries,
  } = useFieldArray({
    control: form.control,
    name: "config.config.series",
  });

  // Function to add a new histogram series
  const addHistogramSeries = () => {
    appendSeries({
      dataSource: {
        columnName: "",
        tableName: form.watch("dataConfig.tableName") || "",
        alias: "",
      },
      color: `hsl(${(seriesFields.length * 137.5) % 360}, 70%, 50%)`,
      opacity: 0.7,
      name: `Series ${seriesFields.length + 1}`,
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
          {/* Histogram Series Configuration */}
          <div className="rounded-lg border bg-white p-4">
            <div className="mb-4 flex items-center justify-between">
              <h4 className="text-muted-foreground text-sm font-medium uppercase tracking-wide">
                {t("yAxisConfiguration")}
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
              {seriesFields.map((field, index) => (
                <Card key={field.id} className="border-l-primary/20 border-l-4 shadow-sm">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                    <div className="flex items-center gap-2">
                      <Layers className="text-primary h-4 w-4" />
                      <CardTitle className="text-sm font-medium">
                        {t("series")} {index + 1}
                      </CardTitle>
                    </div>
                    {seriesFields.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeSeries(index)}
                        className="text-muted-foreground hover:text-destructive h-8 w-8 p-0"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                      {/* Data Column */}
                      <FormField
                        control={form.control}
                        name={`config.config.series.${index}.dataSource.columnName` as const}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-medium">{t("dataColumn")}</FormLabel>
                            <Select
                              value={field.value}
                              onValueChange={(value) => {
                                field.onChange(value);
                                onColumnSelect("data", value);
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
                        name={`config.config.series.${index}.dataSource.alias` as const}
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
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Color */}
                      <FormField
                        control={form.control}
                        name={`config.config.series.${index}.color` as const}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="flex items-center gap-2 text-sm font-medium">
                              <Palette className="h-3.5 w-3.5" />
                              {t("configuration.color")}
                            </FormLabel>
                            <FormControl>
                              <div className="flex items-center gap-2">
                                <Input
                                  type="color"
                                  className="h-10 w-12 border-2 bg-white p-1"
                                  {...field}
                                />
                                <Input
                                  type="text"
                                  className="h-10 flex-1 bg-white font-mono text-sm"
                                  placeholder="#000000"
                                  {...field}
                                />
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <Separator className="my-4" />

                    {/* Histogram Options for this series */}
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                      <FormField
                        control={form.control}
                        name={`config.config.series.${index}.histfunc` as const}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-medium">
                              {t("configuration.histogramFunction")}
                            </FormLabel>
                            <Select
                              value={field.value ?? "none"}
                              onValueChange={(value) =>
                                field.onChange(value === "none" ? "" : value)
                              }
                            >
                              <FormControl>
                                <SelectTrigger className="h-10 bg-white">
                                  <SelectValue placeholder={tCommon("none")} />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="none">{tCommon("none")}</SelectItem>
                                <SelectItem value="count">
                                  {t("histogramFunction.count")}
                                </SelectItem>
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
                        name={`config.config.series.${index}.histnorm` as const}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-medium">
                              {t("configuration.normalization")}
                            </FormLabel>
                            <Select
                              value={field.value ?? "none"}
                              onValueChange={(value) =>
                                field.onChange(value === "none" ? "" : value)
                              }
                            >
                              <FormControl>
                                <SelectTrigger className="h-10 bg-white">
                                  <SelectValue placeholder={tCommon("none")} />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="none">{tCommon("none")}</SelectItem>
                                <SelectItem value="percent">
                                  {t("normalization.percent")}
                                </SelectItem>
                                <SelectItem value="probability">
                                  {t("normalization.probability")}
                                </SelectItem>
                                <SelectItem value="density">
                                  {t("normalization.density")}
                                </SelectItem>
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
                        name={`config.config.series.${index}.opacity` as const}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-medium">{t("opacity")}</FormLabel>
                            <FormControl>
                              <div className="space-y-3">
                                <Slider
                                  min={0}
                                  max={1}
                                  step={0.1}
                                  value={[field.value || 0.7]}
                                  onValueChange={(values) => field.onChange(values[0])}
                                  className="w-full"
                                />
                                <div className="flex items-center justify-center">
                                  <Badge variant="outline" className="font-mono text-xs">
                                    {Math.round((field.value || 0.7) * 100)}%
                                  </Badge>
                                </div>
                              </div>
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
                name="config.config.nbins"
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
                          value={[field.value || 20]}
                          onValueChange={(values) => field.onChange(values[0])}
                          className="w-full"
                        />
                        <div className="text-muted-foreground flex items-center justify-between text-xs">
                          <span>5</span>
                          <Badge variant="outline" className="font-mono text-xs">
                            {field.value || 20}
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
                name="config.config.barmode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">
                      {t("configuration.barMode")}
                    </FormLabel>
                    <Select
                      value={field.value}
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
              name="config.config.orientation"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium">
                    {t("chartOptions.orientation")}
                  </FormLabel>
                  <Select
                    value={field.value}
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
              name="config.config.autobinx"
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
                    <Switch checked={field.value || true} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="config.config.gridLines"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium">
                    {t("chartOptions.gridLines")}
                  </FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
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
              name="config.config.display.title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium">{t("chartTitle")}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t("enterChartTitle")}
                      className="h-10 bg-white"
                      {...field}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="config.config.display.showLegend"
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
              name="config.config.display.legendPosition"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium">
                    {t("chartOptions.legendPosition")}
                  </FormLabel>
                  <Select
                    value={field.value}
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
              name="config.config.display.colorScheme"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium">{t("colorScheme")}</FormLabel>
                  <Select
                    value={field.value}
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
