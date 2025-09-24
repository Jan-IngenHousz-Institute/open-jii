"use client";

import { Plus, Trash2, BarChart3, Layers, Eye, Palette, Database, Activity } from "lucide-react";
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
  RadioGroup,
  RadioGroupItem,
} from "@repo/ui/components";

import type { ChartFormValues, SampleTable } from "../../types";

interface BoxPlotConfiguratorProps {
  form: UseFormReturn<ChartFormValues>;
  table: SampleTable;
  onColumnSelect: (columnType: "x" | "y", columnName: string) => void;
}

export default function BoxPlotConfigurator({
  form,
  table,
  onColumnSelect,
}: BoxPlotConfiguratorProps) {
  const { t } = useTranslation("experimentVisualizations");
  const { t: tCommon } = useTranslation("common");

  // Hook for managing Y-axes array
  const {
    fields: yAxesFields,
    append: appendYAxis,
    remove: removeYAxis,
  } = useFieldArray({
    control: form.control,
    name: "config.config.yAxes",
  });

  // Function to add a new Y-axis series
  const addYAxisSeries = () => {
    appendYAxis({
      dataSource: { columnName: "", tableName: "", alias: "" },
      type: "linear",
      title: "",
      side: "left",
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
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
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

              <FormField
                control={form.control}
                name="config.config.xAxis.type"
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
                        <SelectItem value="category">{t("axisTypes.category")}</SelectItem>
                        <SelectItem value="date">{t("axisTypes.date")}</SelectItem>
                      </SelectContent>
                    </Select>
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
                              {t("chartOptions.boxColor")}
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
                            <FormLabel className="text-sm font-medium">
                              {t("configuration.axisSide")}
                            </FormLabel>
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

                    {/* Y-Axis Title */}
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

              {yAxesFields.length === 0 && (
                <div className="text-muted-foreground flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 text-center">
                  <Activity className="mb-2 h-8 w-8" />
                  <p className="text-sm">{t("noDataSeries")}</p>
                  <p className="text-muted-foreground/70 text-xs">{t("addDataSeriesToStart")}</p>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Box Plot Options & Appearance */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Appearance & Style */}
        <Card className="shadow-sm">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <Eye className="text-primary h-5 w-5" />
              <CardTitle className="text-lg font-semibold">{t("appearance")}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Orientation */}
            <FormField
              control={form.control}
              name="config.config.orientation"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium">
                    {t("chartOptions.orientation")}
                  </FormLabel>
                  <FormControl>
                    <RadioGroup
                      value={field.value}
                      onValueChange={field.onChange}
                      className="flex space-x-4"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="v" id="vertical" />
                        <FormLabel htmlFor="vertical" className="text-sm font-normal">
                          {t("chartOptions.vertical")}
                        </FormLabel>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="h" id="horizontal" />
                        <FormLabel htmlFor="horizontal" className="text-sm font-normal">
                          {t("chartOptions.horizontal")}
                        </FormLabel>
                      </div>
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Box Mode */}
            <FormField
              control={form.control}
              name="config.config.boxMode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium">{t("chartOptions.boxMode")}</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="h-10 bg-white">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="group">{t("chartOptions.grouped")}</SelectItem>
                      <SelectItem value="overlay">{t("chartOptions.overlay")}</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Box Points */}
            <FormField
              control={form.control}
              name="config.config.boxPoints"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium">
                    {t("chartOptions.boxPoints")}
                  </FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="h-10 bg-white">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="all">{t("chartOptions.allPoints")}</SelectItem>
                      <SelectItem value="outliers">{t("chartOptions.outliers")}</SelectItem>
                      <SelectItem value="suspectedoutliers">
                        {t("chartOptions.suspectedOutliers")}
                      </SelectItem>
                      <SelectItem value="false">{t("chartOptions.noPoints")}</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Notched */}
            <FormField
              control={form.control}
              name="config.config.notched"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <FormLabel className="text-sm font-medium">
                      {t("chartOptions.notched")}
                    </FormLabel>
                    <div className="text-muted-foreground text-xs">
                      {t("chartOptions.notchedDescription")}
                    </div>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />

            {/* Box Mean */}
            <FormField
              control={form.control}
              name="config.config.boxMean"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium">{t("chartOptions.boxMean")}</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="h-10 bg-white">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="false">{t("chartOptions.noMean")}</SelectItem>
                      <SelectItem value="true">{t("chartOptions.showMean")}</SelectItem>
                      <SelectItem value="sd">{t("chartOptions.meanWithSD")}</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Box Plot Options */}
        <Card className="shadow-sm">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="text-primary h-5 w-5" />
              <CardTitle className="text-lg font-semibold">
                {t("chartOptions.boxPlotOptions")}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Jitter */}
            <FormField
              control={form.control}
              name="config.config.jitter"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between">
                    <FormLabel className="text-sm font-medium">
                      {t("chartOptions.jitter")}
                    </FormLabel>
                    <span className="text-muted-foreground text-xs">{field.value}</span>
                  </div>
                  <FormControl>
                    <Slider
                      value={[field.value]}
                      onValueChange={(value) => field.onChange(value[0])}
                      min={0}
                      max={1}
                      step={0.1}
                      className="py-2"
                    />
                  </FormControl>
                  <div className="text-muted-foreground text-xs">
                    {t("chartOptions.jitterDescription")}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Point Position */}
            <FormField
              control={form.control}
              name="config.config.pointPos"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between">
                    <FormLabel className="text-sm font-medium">
                      {t("chartOptions.pointPosition")}
                    </FormLabel>
                    <span className="text-muted-foreground text-xs">{field.value}</span>
                  </div>
                  <FormControl>
                    <Slider
                      value={[field.value]}
                      onValueChange={(value) => field.onChange(value[0])}
                      min={-2}
                      max={2}
                      step={0.1}
                      className="py-2"
                    />
                  </FormControl>
                  <div className="text-muted-foreground text-xs">
                    {t("chartOptions.pointPositionDescription")}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Notch Width */}
            <FormField
              control={form.control}
              name="config.config.notchWidth"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between">
                    <FormLabel className="text-sm font-medium">
                      {t("chartOptions.notchWidth")}
                    </FormLabel>
                    <span className="text-muted-foreground text-xs">{field.value}</span>
                  </div>
                  <FormControl>
                    <Slider
                      value={[field.value]}
                      onValueChange={(value) => field.onChange(value[0])}
                      min={0}
                      max={1}
                      step={0.05}
                      className="py-2"
                    />
                  </FormControl>
                  <div className="text-muted-foreground text-xs">
                    {t("chartOptions.notchWidthDescription")}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Marker Size */}
            <FormField
              control={form.control}
              name="config.config.markerSize"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between">
                    <FormLabel className="text-sm font-medium">
                      {t("chartOptions.markerSize")}
                    </FormLabel>
                    <span className="text-muted-foreground text-xs">{field.value}px</span>
                  </div>
                  <FormControl>
                    <Slider
                      value={[field.value]}
                      onValueChange={(value) => field.onChange(value[0])}
                      min={1}
                      max={20}
                      step={1}
                      className="py-2"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Line Width */}
            <FormField
              control={form.control}
              name="config.config.lineWidth"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between">
                    <FormLabel className="text-sm font-medium">
                      {t("chartOptions.lineWidth")}
                    </FormLabel>
                    <span className="text-muted-foreground text-xs">{field.value}px</span>
                  </div>
                  <FormControl>
                    <Slider
                      value={[field.value]}
                      onValueChange={(value) => field.onChange(value[0])}
                      min={0.5}
                      max={10}
                      step={0.5}
                      className="py-2"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Fill Opacity */}
            <FormField
              control={form.control}
              name="config.config.fillOpacity"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between">
                    <FormLabel className="text-sm font-medium">
                      {t("chartOptions.fillOpacity")}
                    </FormLabel>
                    <span className="text-muted-foreground text-xs">
                      {Math.round(field.value * 100)}%
                    </span>
                  </div>
                  <FormControl>
                    <Slider
                      value={[field.value]}
                      onValueChange={(value) => field.onChange(value[0])}
                      min={0}
                      max={1}
                      step={0.1}
                      className="py-2"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Grid Lines */}
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
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="both">{t("chartOptions.both")}</SelectItem>
                      <SelectItem value="x">{t("chartOptions.xOnly")}</SelectItem>
                      <SelectItem value="y">{t("chartOptions.yOnly")}</SelectItem>
                      <SelectItem value="none">{tCommon("common.none")}</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>
      </div>

      {/* Chart Display Options */}
      <Card className="shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <Eye className="text-primary h-5 w-5" />
            <CardTitle className="text-lg font-semibold">{t("displayOptions")}</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Chart Title */}
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

            {/* Legend Position */}
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
                      <SelectItem value="top">{t("legendPositions.top")}</SelectItem>
                      <SelectItem value="bottom">{t("legendPositions.bottom")}</SelectItem>
                      <SelectItem value="left">{t("legendPositions.left")}</SelectItem>
                      <SelectItem value="right">{t("legendPositions.right")}</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Show Legend */}
            <FormField
              control={form.control}
              name="config.config.display.showLegend"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <FormLabel className="text-sm font-medium">{t("showLegend")}</FormLabel>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />

            {/* Interactive */}
            <FormField
              control={form.control}
              name="config.config.display.interactive"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <FormLabel className="text-sm font-medium">{t("interactive")}</FormLabel>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />

            {/* Color Scheme */}
            <FormField
              control={form.control}
              name="config.config.display.colorScheme"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium">{t("colorScheme")}</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="h-10 bg-white">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
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
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
