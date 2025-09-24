"use client";

import { Radar, Database, Plus, Trash2, Layers, Eye, Target } from "lucide-react";
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
  Switch,
} from "@repo/ui/components";

import type { ChartFormValues, SampleTable } from "../../types";

interface RadarChartConfiguratorProps {
  form: UseFormReturn<ChartFormValues>;
  table: SampleTable;
  onColumnSelect: (columnType: string, columnName: string) => void;
}

export default function RadarChartConfigurator({
  form,
  table,
  onColumnSelect,
}: RadarChartConfiguratorProps) {
  const { t } = useTranslation("experimentVisualizations");

  // Use field array for multiple radar series
  const {
    fields: seriesFields,
    append: appendSeries,
    remove: removeSeries,
  } = useFieldArray({
    control: form.control,
    name: "config.config.series",
  });

  const columns = table.columns;
  const numericColumns = columns.filter(
    (col: DataColumn) =>
      col.type_name === "DOUBLE" ||
      col.type_name === "INT" ||
      col.type_name === "LONG" ||
      col.type_name === "BIGINT",
  );
  const textColumns = columns.filter(
    (col: DataColumn) => col.type_name === "VARCHAR" || col.type_name === "TEXT",
  );

  const addSeries = () => {
    appendSeries({
      dataSource: {
        tableName: form.watch("dataConfig.tableName") || "",
        columnName: "",
        alias: "",
      },
      name: `Series ${seriesFields.length + 1}`,
      color: `hsl(${(seriesFields.length * 137.5) % 360}, 70%, 50%)`,
      fill: "toself",
      mode: "lines+markers",
      opacity: 0.6,
      line: {
        width: 2,
        dash: "solid",
      },
      marker: {
        size: 6,
        symbol: "circle",
      },
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
          {/* Category Axis Configuration */}
          <div className="rounded-lg border bg-white p-4">
            <h4 className="text-muted-foreground mb-3 text-sm font-medium uppercase tracking-wide">
              {t("categoryAxisConfiguration")}
            </h4>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <FormField
                control={form.control}
                name="config.config.categoryAxis.dataSource.columnName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">
                      {t("configuration.categoryColumn")}
                    </FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={(value) => {
                        field.onChange(value);
                        onColumnSelect("category", value);
                      }}
                    >
                      <FormControl>
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder={t("selectColumn")} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {textColumns.map((col) => (
                          <SelectItem key={col.name} value={col.name}>
                            <div className="flex items-center gap-2">
                              <Target className="h-3 w-3" />
                              <span>{col.name}</span>
                              <Badge variant="outline" className="text-xs">
                                {col.type_name}
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
                name="config.config.categoryAxis.title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">
                      {t("configuration.axisTitle")}
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder={t("configuration.axisTitle")}
                        className="h-9"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="config.config.categoryAxis.dataSource.alias"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">
                      {t("configuration.columnAlias")}
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder={t("configuration.columnAlias")}
                        className="h-9"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>

          {/* Series Configuration */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-muted-foreground text-sm font-medium uppercase tracking-wide">
                {t("seriesConfiguration")}
              </h4>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addSeries}
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
                      <Radar className="text-primary h-4 w-4" />
                      <h5 className="font-medium">{t("seriesLabel", { number: index + 1 })}</h5>
                    </div>
                    {seriesFields.length > 1 && (
                      <Button
                        type="button"
                        onClick={() => removeSeries(index)}
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
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
                        name={`config.config.series.${index}.dataSource.columnName`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-medium">
                              {t("configuration.dataColumn")}
                            </FormLabel>
                            <Select
                              value={field.value}
                              onValueChange={(value) => {
                                field.onChange(value);
                                onColumnSelect("series", value);
                              }}
                            >
                              <FormControl>
                                <SelectTrigger className="h-9">
                                  <SelectValue placeholder={t("selectColumn")} />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {numericColumns.map((col) => (
                                  <SelectItem key={col.name} value={col.name}>
                                    <div className="flex items-center gap-2">
                                      <Target className="h-3 w-3" />
                                      <span>{col.name}</span>
                                      <Badge variant="outline" className="text-xs">
                                        {col.type_name}
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
                        name={`config.config.series.${index}.name`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-medium">
                              {t("configuration.seriesName")}
                            </FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                placeholder={t("configuration.seriesName")}
                                className="h-9"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Series Color */}
                      <FormField
                        control={form.control}
                        name={`config.config.series.${index}.color`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-medium">
                              {t("configuration.color")}
                            </FormLabel>
                            <FormControl>
                              <div className="flex items-center gap-2">
                                <Input {...field} type="color" className="h-9 w-16 p-1" />
                                <Input {...field} placeholder="#3b82f6" className="h-9 flex-1" />
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Fill Mode */}
                      <FormField
                        control={form.control}
                        name={`config.config.series.${index}.fill`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-medium">
                              {t("configuration.fillMode")}
                            </FormLabel>
                            <Select value={field.value} onValueChange={field.onChange}>
                              <FormControl>
                                <SelectTrigger className="h-9">
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="none">{t("configuration.fillNone")}</SelectItem>
                                <SelectItem value="toself">
                                  {t("configuration.fillToSelf")}
                                </SelectItem>
                                <SelectItem value="tonext">
                                  {t("configuration.fillToNext")}
                                </SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <Separator className="my-4" />

                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                      {/* Display Mode */}
                      <FormField
                        control={form.control}
                        name={`config.config.series.${index}.mode`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-medium">
                              {t("configuration.displayMode")}
                            </FormLabel>
                            <Select value={field.value} onValueChange={field.onChange}>
                              <FormControl>
                                <SelectTrigger className="h-9">
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="lines">
                                  {t("configuration.linesOnly")}
                                </SelectItem>
                                <SelectItem value="markers">
                                  {t("configuration.markersOnly")}
                                </SelectItem>
                                <SelectItem value="lines+markers">
                                  {t("configuration.linesAndMarkers")}
                                </SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Opacity */}
                      <FormField
                        control={form.control}
                        name={`config.config.series.${index}.opacity`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-medium">
                              {t("configuration.opacity")} ({Math.round((field.value || 0.6) * 100)}
                              %)
                            </FormLabel>
                            <FormControl>
                              <Slider
                                value={[field.value || 0.6]}
                                onValueChange={(value) => field.onChange(value[0])}
                                max={1}
                                step={0.1}
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
                        name={`config.config.series.${index}.line.width`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-medium">
                              {t("configuration.lineWidth")} ({field.value || 2})
                            </FormLabel>
                            <FormControl>
                              <Slider
                                value={[field.value || 2]}
                                onValueChange={(value) => field.onChange(value[0])}
                                min={1}
                                max={8}
                                step={1}
                                className="py-2"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Line Dash Style */}
                      <FormField
                        control={form.control}
                        name={`config.config.series.${index}.line.dash`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-medium">
                              {t("configuration.lineStyle")}
                            </FormLabel>
                            <Select value={field.value} onValueChange={field.onChange}>
                              <FormControl>
                                <SelectTrigger className="h-9">
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="solid">
                                  {t("configuration.lineSolid")}
                                </SelectItem>
                                <SelectItem value="dash">{t("configuration.lineDash")}</SelectItem>
                                <SelectItem value="dot">{t("configuration.lineDot")}</SelectItem>
                                <SelectItem value="dashdot">
                                  {t("configuration.lineDashDot")}
                                </SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Marker Size */}
                      <FormField
                        control={form.control}
                        name={`config.config.series.${index}.marker.size`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-medium">
                              {t("configuration.markerSize")} ({field.value || 6})
                            </FormLabel>
                            <FormControl>
                              <Slider
                                value={[field.value || 6]}
                                onValueChange={(value) => field.onChange(value[0])}
                                min={3}
                                max={15}
                                step={1}
                                className="py-2"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Marker Symbol */}
                      <FormField
                        control={form.control}
                        name={`config.config.series.${index}.marker.symbol`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-medium">
                              {t("configuration.markerSymbol")}
                            </FormLabel>
                            <Select value={field.value} onValueChange={field.onChange}>
                              <FormControl>
                                <SelectTrigger className="h-9">
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="circle">
                                  {t("configuration.symbolCircle")}
                                </SelectItem>
                                <SelectItem value="square">
                                  {t("configuration.symbolSquare")}
                                </SelectItem>
                                <SelectItem value="diamond">
                                  {t("configuration.symbolDiamond")}
                                </SelectItem>
                                <SelectItem value="triangle">
                                  {t("configuration.symbolTriangle")}
                                </SelectItem>
                                <SelectItem value="cross">
                                  {t("configuration.symbolCross")}
                                </SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </CardContent>
                </Card>
              ))}

              {seriesFields.length === 0 && (
                <div className="border-muted-foreground/25 rounded-lg border border-dashed p-8 text-center">
                  <div>
                    <Layers className="text-muted-foreground mx-auto mb-2 h-8 w-8" />
                    <p className="text-muted-foreground mb-2 text-sm">{t("noSeriesConfigured")}</p>
                    <Button type="button" onClick={addSeries} size="sm" variant="outline">
                      <Plus className="mr-1 h-4 w-4" />
                      {t("addFirstSeries")}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Two-column layout: Appearance (left) and Radar Plot Options (right) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Appearance (formerly Display Options) */}
        <Card className="shadow-sm">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <Eye className="text-primary h-5 w-5" />
              <CardTitle className="text-lg font-semibold">{t("appearance")}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
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
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Show Legend */}
            <FormField
              control={form.control}
              name="config.config.display.showLegend"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <FormLabel className="text-sm font-medium">{t("showLegend")}</FormLabel>
                    <div className="text-muted-foreground text-xs">
                      {t("chartOptions.displayChartLegend")}
                    </div>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />

            {/* Show Tick Labels */}
            <FormField
              control={form.control}
              name="config.config.showTickLabels"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <FormLabel className="text-sm font-medium">{t("showTickLabels")}</FormLabel>
                    <div className="text-muted-foreground text-xs">
                      {t("showTickLabelsDescription")}
                    </div>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />

            {/* Radial Axis Visible */}
            <FormField
              control={form.control}
              name="config.config.radialAxisVisible"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <FormLabel className="text-sm font-medium">{t("radialAxisVisible")}</FormLabel>
                    <div className="text-muted-foreground text-xs">
                      {t("radialAxisVisibleDescription")}
                    </div>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />

            {/* Angular Axis Visible */}
            <FormField
              control={form.control}
              name="config.config.angularAxisVisible"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <FormLabel className="text-sm font-medium">{t("angularAxisVisible")}</FormLabel>
                    <div className="text-muted-foreground text-xs">
                      {t("angularAxisVisibleDescription")}
                    </div>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Radar Plot Options */}
        <Card className="bg-white shadow-sm">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <Radar className="text-primary h-5 w-5" />
              <CardTitle className="text-lg font-semibold">{t("radarPlotOptions")}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Range Mode */}
            <FormField
              control={form.control}
              name="config.config.rangeMode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium">{t("rangeMode")}</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="normal">{t("rangeNormal")}</SelectItem>
                      <SelectItem value="tozero">{t("rangeToZero")}</SelectItem>
                      <SelectItem value="nonnegative">{t("rangeNonNegative")}</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Grid Shape */}
            <FormField
              control={form.control}
              name="config.config.gridShape"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium">{t("gridShape")}</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="circular">{t("gridCircular")}</SelectItem>
                      <SelectItem value="linear">{t("gridLinear")}</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Tick Angle */}
            <FormField
              control={form.control}
              name="config.config.tickAngle"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium">
                    {t("tickAngle")} ({field.value || 0}°)
                  </FormLabel>
                  <FormControl>
                    <Slider
                      value={[field.value || 0]}
                      onValueChange={(value) => field.onChange(value[0])}
                      min={-180}
                      max={180}
                      step={15}
                      className="py-2"
                    />
                  </FormControl>
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
