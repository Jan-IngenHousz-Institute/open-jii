"use client";

import { Plus, Trash2, ScatterChart, Layers, Palette, Database } from "lucide-react";
import React from "react";
import { useFieldArray } from "react-hook-form";
import type { UseFormReturn } from "react-hook-form";

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
} from "@repo/ui/components";

import type { ChartFormValues, SampleTable } from "../../types";

interface DotPlotConfiguratorProps {
  form: UseFormReturn<ChartFormValues>;
  table: SampleTable;
  onColumnSelect: (columnType: string, columnName: string) => void;
}

export default function DotPlotConfigurator({
  form,
  table,
  onColumnSelect,
}: DotPlotConfiguratorProps) {
  const { t } = useTranslation("experimentVisualizations");
  const { t: tCommon } = useTranslation("common");

  // Use field array for multiple Y-axis series
  const {
    fields: yAxesFields,
    append: appendYAxis,
    remove: removeYAxis,
  } = useFieldArray({
    control: form.control,
    name: "config.config.yAxes",
  });

  const addYAxisSeries = () => {
    appendYAxis({
      dataSource: {
        tableName: form.watch("dataConfig.tableName") || "",
        columnName: "",
        alias: "",
      },
      type: "linear",
      side: "left",
      title: "",
      color: `hsl(${(yAxesFields.length * 137.5) % 360}, 70%, 50%)`,
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
          <div className="rounded-lg border bg-white p-4">
            <h4 className="text-muted-foreground mb-3 text-sm font-medium uppercase tracking-wide">
              {t("xAxisConfiguration")}
            </h4>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <FormField
                control={form.control}
                name="config.config.xAxis.dataSource.columnName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">
                      {t("configuration.xAxis")}
                    </FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={(value) => {
                        field.onChange(value);
                        onColumnSelect("x", value);
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
                name="config.config.xAxis.title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">{t("xAxisTitle")}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={t("enterAxisTitle")}
                        className="h-10 bg-white"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>

          {/* Y-Axes Series Configuration */}
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
              {yAxesFields.map((field, index) => (
                <Card key={field.id} className="border-l-primary/20 border-l-4 shadow-sm">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                    <div className="flex items-center gap-2">
                      <Layers className="text-primary h-4 w-4" />
                      <CardTitle className="text-sm font-medium">
                        {t("series")} {index + 1}
                      </CardTitle>
                    </div>
                    {yAxesFields.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeYAxis(index)}
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
                        name={`config.config.yAxes.${index}.dataSource.columnName` as const}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-medium">{t("dataColumn")}</FormLabel>
                            <Select
                              value={field.value}
                              onValueChange={(value) => {
                                field.onChange(value);
                                onColumnSelect("y", value);
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
                        name={`config.config.yAxes.${index}.dataSource.alias` as const}
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
                        name={`config.config.yAxes.${index}.color` as const}
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

                      <FormField
                        control={form.control}
                        name={`config.config.yAxes.${index}.type` as const}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-medium">
                              {t("configuration.axisType")}
                            </FormLabel>
                            <Select value={field.value} onValueChange={field.onChange}>
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

                      <FormField
                        control={form.control}
                        name={`config.config.yAxes.${index}.side` as const}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-medium">{t("yAxisSide")}</FormLabel>
                            <Select value={field.value} onValueChange={field.onChange}>
                              <FormControl>
                                <SelectTrigger className="h-10 bg-white">
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="left">{t("left")}</SelectItem>
                                <SelectItem value="right">{t("right")}</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    {/* Y-axis Title - only show for first axis */}
                    {index === 0 && (
                      <FormField
                        control={form.control}
                        name={`config.config.yAxes.${index}.title` as const}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-medium">{t("yAxisTitle")}</FormLabel>
                            <FormControl>
                              <Input
                                placeholder={t("enterAxisTitle")}
                                className="h-10 bg-white"
                                {...field}
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
        </CardContent>
      </Card>

      {/* Dot Plot Options & Appearance */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Marker Configuration */}
        <Card className="bg-white shadow-sm">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <ScatterChart className="text-primary h-5 w-5" />
              <CardTitle className="text-lg font-semibold">
                {t("chartOptions.markerConfiguration")}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <FormField
              control={form.control}
              name="config.config.markerSize"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium">{t("markerSize")}</FormLabel>
                  <div className="space-y-3">
                    <Slider
                      min={1}
                      max={20}
                      step={1}
                      value={[field.value || 8]}
                      onValueChange={(value) => field.onChange(value[0])}
                      className="w-full"
                    />
                    <div className="text-muted-foreground text-center text-xs">
                      {field.value || 8}px
                    </div>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="config.config.markerShape"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium">
                    {t("chartOptions.markerShape")}
                  </FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="h-10 bg-white">
                        <SelectValue placeholder={t("selectMarkerShape")} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="circle">{t("markerShapes.circle")}</SelectItem>
                      <SelectItem value="square">{t("markerShapes.square")}</SelectItem>
                      <SelectItem value="diamond">{t("markerShapes.diamond")}</SelectItem>
                      <SelectItem value="triangle">{t("markerShapes.triangle")}</SelectItem>
                      <SelectItem value="cross">{t("markerShapes.cross")}</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Appearance */}
        <Card className="bg-white shadow-sm">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <Palette className="text-primary h-5 w-5" />
              <CardTitle className="text-lg font-semibold">{t("appearance")}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
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
                      <SelectItem value="true">{tCommon("common.yes")}</SelectItem>
                      <SelectItem value="false">{tCommon("common.no")}</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
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
                        <SelectValue placeholder={t("selectGridLines")} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="both">{t("gridLineOptions.both")}</SelectItem>
                      <SelectItem value="x">{t("gridLineOptions.x")}</SelectItem>
                      <SelectItem value="y">{t("gridLineOptions.y")}</SelectItem>
                      <SelectItem value="none">{t("gridLineOptions.none")}</SelectItem>
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
