"use client";

import { ScatterChart, TrendingUp, Layers, Eye, Plus, Trash2 } from "lucide-react";
import { useFieldArray } from "react-hook-form";
import type { UseFormReturn } from "react-hook-form";

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
  Slider,
} from "@repo/ui/components";

import type { ChartFormValues, SampleTable } from "../types";

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
      color: "#3b82f6",
    });
  };

  return (
    <div className="space-y-8">
      {/* Data Configuration */}
      <Card className="shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <ScatterChart className="text-primary h-5 w-5" />
            <CardTitle className="text-lg font-semibold">{t("dataConfiguration")}</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* X-Axis Configuration */}
          <div className="rounded-lg border bg-white p-4">
            <h4 className="text-muted-foreground mb-3 text-sm font-medium uppercase tracking-wide">
              {t("xAxisConfiguration")}
            </h4>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <FormField
                control={form.control}
                name="config.config.xAxis.dataSource.columnName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">{t("xAxis")}</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={(value) => {
                        field.onChange(value);
                        onColumnSelect("x", value);
                      }}
                    >
                      <FormControl>
                        <SelectTrigger className="h-10 bg-white">
                          <SelectValue placeholder={t("selectColumn")} />
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

              <FormField
                control={form.control}
                name="config.config.xAxis.type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">{t("axisType")}</FormLabel>
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
                        <SelectItem value="category">{t("axisTypes.category")}</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Y-Axes Series Configuration */}
      <Card className="shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="text-primary h-5 w-5" />
              <CardTitle className="text-lg font-semibold">{t("yAxisSeries")}</CardTitle>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={addYAxisSeries}>
              <Plus className="mr-2 h-4 w-4" />
              {t("addSeries")}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {yAxesFields.map((field, index) => (
            <Card key={field.id} className="border-2 border-dashed bg-white shadow-sm">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="text-primary h-4 w-4" />
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
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
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
                              <SelectValue placeholder={t("selectColumn")} />
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

                  {/* Series Name/Alias */}
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

                <Separator />

                {/* Display Options */}
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                  <FormField
                    control={form.control}
                    name={`config.config.yAxes.${index}.color` as const}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium">{t("pointColor")}</FormLabel>
                        <FormControl>
                          <Input type="color" className="h-10 bg-white" {...field} />
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
                        <FormLabel className="text-sm font-medium">{t("axisType")}</FormLabel>
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
                            <SelectItem value="category">{t("axisTypes.category")}</SelectItem>
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

                {/* Axis Title */}
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
              </CardContent>
            </Card>
          ))}
        </CardContent>
      </Card>

      {/* Scatter Chart Options & Appearance */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Scatter Chart Options */}
        <Card className="bg-white shadow-sm">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <ScatterChart className="text-primary h-5 w-5" />
              <CardTitle className="text-lg font-semibold">{t("scatterOptions")}</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-6">
              <FormField
                control={form.control}
                name="config.config.mode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">{t("scatterMode")}</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="h-10 bg-white">
                          <SelectValue placeholder={t("selectMode")} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="markers">{t("markers")}</SelectItem>
                        <SelectItem value="lines+markers">{t("linesMarkers")}</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="config.config.markerSize"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">{t("markerSize")}</FormLabel>
                    <FormControl>
                      <div className="space-y-3">
                        <Slider
                          min={1}
                          max={20}
                          step={1}
                          value={[field.value]}
                          onValueChange={(values) => field.onChange(values[0])}
                          className="w-full"
                        />
                        <div className="flex items-center justify-center">
                          <Badge variant="outline" className="font-mono text-xs">
                            {field.value}px
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
                name="config.config.markerShape"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">{t("markerShape")}</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
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
                name="config.config.gridLines"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">{t("gridLines")}</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="h-10 bg-white">
                          <SelectValue />
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
                        <SelectItem value="true">{t("common.yes")}</SelectItem>
                        <SelectItem value="false">{t("common.no")}</SelectItem>
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
                    <FormLabel className="text-sm font-medium">{t("legendPosition")}</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="h-10 bg-white">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
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
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
