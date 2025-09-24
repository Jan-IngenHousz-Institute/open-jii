"use client";

import { Activity, Database, Eye, Plus, Trash2 } from "lucide-react";
import type { UseFormReturn } from "react-hook-form";
import { useFieldArray } from "react-hook-form";

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

import type { ChartFormValues, SampleTable } from "../types";

interface ParallelCoordinatesChartConfiguratorProps {
  form: UseFormReturn<ChartFormValues>;
  table: SampleTable;
  onColumnSelect: (columnType: string, columnName: string) => void;
}

export default function ParallelCoordinatesChartConfigurator({
  form,
  table,
  onColumnSelect,
}: ParallelCoordinatesChartConfiguratorProps) {
  const { t } = useTranslation("experimentVisualizations");
  const { t: tCommon } = useTranslation("common");

  // Use field array for dimensions
  const {
    fields: dimensionFields,
    append: appendDimension,
    remove: removeDimension,
  } = useFieldArray({
    control: form.control,
    name: "config.config.dimensions",
  });

  const columns = table.columns;
  const numericColumns = columns.filter(
    (col: DataColumn) =>
      col.type_name === "DOUBLE" ||
      col.type_name === "INT" ||
      col.type_name === "LONG" ||
      col.type_name === "BIGINT",
  );

  const addDimension = () => {
    appendDimension({
      dataSource: {
        tableName: form.watch("dataConfig.tableName") || "",
        columnName: "",
        alias: "",
      },
      label: "",
      visible: true,
      multiselect: true,
    });
  };

  // Colorscale gradients based on Plotly's colorscales
  const getColorscaleGradient = (colorscale: string): string => {
    const gradients: Record<string, string> = {
      viridis:
        "linear-gradient(to right, #440154, #482878, #3e4989, #31688e, #26828e, #1f9e89, #35b779, #6ece58, #b5de2b, #fde725)",
      plasma:
        "linear-gradient(to right, #0d0887, #46039f, #7201a8, #9c179e, #bd3786, #d8576b, #ed7953, #fb9f3a, #fdca26, #f0f921)",
      inferno:
        "linear-gradient(to right, #000004, #1b0c41, #4a0c6b, #781c6d, #a52c60, #cf4446, #ed6925, #fb9b06, #f7d13d, #fcffa4)",
      magma:
        "linear-gradient(to right, #000004, #180f3d, #440f76, #721f81, #9e2f7f, #cd4071, #f1605d, #fd9567, #feca57, #fcfdbf)",
      cividis:
        "linear-gradient(to right, #00224e, #123570, #3b496c, #575d6d, #707173, #8a8678, #a59c74, #c3b369, #e1cc55, #fde725)",
      blues:
        "linear-gradient(to right, #f7fbff, #deebf7, #c6dbef, #9ecae1, #6baed6, #4292c6, #2171b5, #08519c, #08306b)",
      greens:
        "linear-gradient(to right, #f7fcf5, #e5f5e0, #c7e9c0, #a1d99b, #74c476, #41ab5d, #238b45, #006d2c, #00441b)",
      reds: "linear-gradient(to right, #fff5f0, #fee0d2, #fcbba1, #fc9272, #fb6a4a, #ef3b2c, #cb181d, #a50f15, #67000d)",
      oranges:
        "linear-gradient(to right, #fff5eb, #fee6ce, #fdd0a2, #fdae6b, #fd8d3c, #f16913, #d94801, #a63603, #7f2704)",
      purples:
        "linear-gradient(to right, #fcfbfd, #efedf5, #dadaeb, #bcbddc, #9e9ac8, #807dba, #6a51a3, #54278f, #3f007d)",
      greys:
        "linear-gradient(to right, #ffffff, #f0f0f0, #d9d9d9, #bdbdbd, #969696, #737373, #525252, #252525, #000000)",
      hot: "linear-gradient(to right, #000000, #ff0000, #ffff00, #ffffff)",
      cool: "linear-gradient(to right, #00ffff, #0080ff, #0000ff, #8000ff, #ff00ff)",
      rainbow:
        "linear-gradient(to right, #ff0000, #ff8000, #ffff00, #80ff00, #00ff00, #00ff80, #00ffff, #0080ff, #0000ff, #8000ff, #ff00ff)",
      jet: "linear-gradient(to right, #000080, #0000ff, #0080ff, #00ffff, #80ff00, #ffff00, #ff8000, #ff0000, #800000)",
    };
    return gradients[colorscale] || gradients.viridis;
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
          {/* Dimensions Configuration */}
          <div className="rounded-lg border bg-white p-4">
            <div className="mb-4 flex items-center justify-between">
              <h4 className="text-muted-foreground text-sm font-medium uppercase tracking-wide">
                {t("configuration.dimensions")}
              </h4>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addDimension}
                className="h-8"
              >
                <Plus className="mr-2 h-4 w-4" />
                {t("configuration.addDimension")}
              </Button>
            </div>

            {dimensionFields.length === 0 && (
              <div className="border-border rounded-lg border-2 border-dashed p-6 text-center">
                <p className="text-muted-foreground text-sm">
                  {t("configuration.noDimensionsAdded")}
                </p>
                <p className="text-muted-foreground text-xs">
                  {t("configuration.parallelCoordinatesRequiresDimensions")}
                </p>
              </div>
            )}

            <div className="space-y-4">
              {dimensionFields.map((field, index) => (
                <Card key={field.id} className="border-l-primary/20 border-l-4 shadow-sm">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                    <div className="space-y-1">
                      <h3 className="text-base font-semibold">
                        {t("configuration.dimension")} {index + 1}
                      </h3>
                      <p className="text-muted-foreground text-sm">
                        {t("configuration.configureDimensionSettings")}
                      </p>
                    </div>
                    {dimensionFields.length > 1 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => removeDimension(index)}
                        className="h-8 w-8 p-0"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                      <FormField
                        control={form.control}
                        name={`config.config.dimensions.${index}.dataSource.columnName`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-medium">
                              {t("configuration.column")}
                            </FormLabel>
                            <Select
                              value={field.value}
                              onValueChange={(value) => {
                                field.onChange(value);
                                onColumnSelect(`dimension-${index}`, value);
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

                      <FormField
                        control={form.control}
                        name={`config.config.dimensions.${index}.label`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-medium">
                              {t("configuration.customLabel")}
                            </FormLabel>
                            <FormControl>
                              <Input
                                placeholder={t("configuration.optionalCustomLabel")}
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

                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                      <FormField
                        control={form.control}
                        name={`config.config.dimensions.${index}.visible`}
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                            <div className="space-y-0.5">
                              <FormLabel className="text-sm font-medium">
                                {t("configuration.visible")}
                              </FormLabel>
                              <div className="text-muted-foreground text-xs">
                                {t("configuration.showDimension")}
                              </div>
                            </div>
                            <FormControl>
                              <Switch checked={field.value} onCheckedChange={field.onChange} />
                            </FormControl>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name={`config.config.dimensions.${index}.multiselect`}
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                            <div className="space-y-0.5">
                              <FormLabel className="text-sm font-medium">
                                {t("configuration.multiselect")}
                              </FormLabel>
                              <div className="text-muted-foreground text-xs">
                                {t("configuration.allowMultipleSelections")}
                              </div>
                            </div>
                            <FormControl>
                              <Switch checked={field.value} onCheckedChange={field.onChange} />
                            </FormControl>
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

      {/* Two-column layout: Appearance (left) and Parallel Coordinates Options (right) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Appearance */}
        <Card className="shadow-sm">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <Eye className="text-primary h-5 w-5" />
              <CardTitle className="text-lg font-semibold">{t("appearance")}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-4">
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
                  <FormItem className="flex items-center justify-between rounded-lg border p-3">
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

              <FormField
                control={form.control}
                name="config.config.display.legendPosition"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">
                      {t("chartOptions.legendPosition")}
                    </FormLabel>
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
          </CardContent>
        </Card>

        {/* Parallel Coordinates Options */}
        <Card className="bg-white shadow-sm">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <Activity className="text-primary h-5 w-5" />
              <CardTitle className="text-lg font-semibold">
                {t("chartOptions.parallelCoordinatesOptions")}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Line Configuration */}
            <div className="space-y-4">
              <h5 className="text-sm font-medium">{t("configuration.lineConfiguration")}</h5>

              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="config.config.line.colorscale"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium">{t("colorScale")}</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger className="h-10 bg-white">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="viridis">
                            <div className="flex items-center gap-3">
                              <div
                                className="h-4 w-8 rounded border"
                                style={{
                                  background: getColorscaleGradient("viridis"),
                                }}
                              />
                              {t("colorscales.viridis")}
                            </div>
                          </SelectItem>
                          <SelectItem value="plasma">
                            <div className="flex items-center gap-3">
                              <div
                                className="h-4 w-8 rounded border"
                                style={{
                                  background: getColorscaleGradient("plasma"),
                                }}
                              />
                              {t("colorscales.plasma")}
                            </div>
                          </SelectItem>
                          <SelectItem value="inferno">
                            <div className="flex items-center gap-3">
                              <div
                                className="h-4 w-8 rounded border"
                                style={{
                                  background: getColorscaleGradient("inferno"),
                                }}
                              />
                              {t("colorscales.inferno")}
                            </div>
                          </SelectItem>
                          <SelectItem value="magma">
                            <div className="flex items-center gap-3">
                              <div
                                className="h-4 w-8 rounded border"
                                style={{
                                  background: getColorscaleGradient("magma"),
                                }}
                              />
                              {t("colorscales.magma")}
                            </div>
                          </SelectItem>
                          <SelectItem value="cividis">
                            <div className="flex items-center gap-3">
                              <div
                                className="h-4 w-8 rounded border"
                                style={{
                                  background: getColorscaleGradient("cividis"),
                                }}
                              />
                              {t("colorscales.cividis")}
                            </div>
                          </SelectItem>
                          <SelectItem value="blues">
                            <div className="flex items-center gap-3">
                              <div
                                className="h-4 w-8 rounded border"
                                style={{
                                  background: getColorscaleGradient("blues"),
                                }}
                              />
                              {t("colorscales.blues")}
                            </div>
                          </SelectItem>
                          <SelectItem value="greens">
                            <div className="flex items-center gap-3">
                              <div
                                className="h-4 w-8 rounded border"
                                style={{
                                  background: getColorscaleGradient("greens"),
                                }}
                              />
                              {t("colorscales.greens")}
                            </div>
                          </SelectItem>
                          <SelectItem value="reds">
                            <div className="flex items-center gap-3">
                              <div
                                className="h-4 w-8 rounded border"
                                style={{
                                  background: getColorscaleGradient("reds"),
                                }}
                              />
                              {t("colorscales.reds")}
                            </div>
                          </SelectItem>
                          <SelectItem value="oranges">
                            <div className="flex items-center gap-3">
                              <div
                                className="h-4 w-8 rounded border"
                                style={{
                                  background: getColorscaleGradient("oranges"),
                                }}
                              />
                              {t("colorscales.oranges")}
                            </div>
                          </SelectItem>
                          <SelectItem value="purples">
                            <div className="flex items-center gap-3">
                              <div
                                className="h-4 w-8 rounded border"
                                style={{
                                  background: getColorscaleGradient("purples"),
                                }}
                              />
                              {t("colorscales.purples")}
                            </div>
                          </SelectItem>
                          <SelectItem value="greys">
                            <div className="flex items-center gap-3">
                              <div
                                className="h-4 w-8 rounded border"
                                style={{
                                  background: getColorscaleGradient("greys"),
                                }}
                              />
                              {t("colorscales.greys")}
                            </div>
                          </SelectItem>
                          <SelectItem value="hot">
                            <div className="flex items-center gap-3">
                              <div
                                className="h-4 w-8 rounded border"
                                style={{
                                  background: getColorscaleGradient("hot"),
                                }}
                              />
                              {t("colorscales.hot")}
                            </div>
                          </SelectItem>
                          <SelectItem value="cool">
                            <div className="flex items-center gap-3">
                              <div
                                className="h-4 w-8 rounded border"
                                style={{
                                  background: getColorscaleGradient("cool"),
                                }}
                              />
                              {t("colorscales.cool")}
                            </div>
                          </SelectItem>
                          <SelectItem value="rainbow">
                            <div className="flex items-center gap-3">
                              <div
                                className="h-4 w-8 rounded border"
                                style={{
                                  background: getColorscaleGradient("rainbow"),
                                }}
                              />
                              {t("colorscales.rainbow")}
                            </div>
                          </SelectItem>
                          <SelectItem value="jet">
                            <div className="flex items-center gap-3">
                              <div
                                className="h-4 w-8 rounded border"
                                style={{
                                  background: getColorscaleGradient("jet"),
                                }}
                              />
                              {t("colorscales.jet")}
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>

                      {/* Colorscale Preview */}
                      <div className="mt-2">
                        <div className="text-muted-foreground mb-1 text-xs">
                          {t("preview.title")}
                        </div>
                        <div
                          className="h-6 w-full rounded border"
                          style={{
                            background: getColorscaleGradient(field.value),
                          }}
                        />
                      </div>

                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="config.config.line.showscale"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <FormLabel className="text-sm font-medium">
                          {t("configuration.showColorScale")}
                        </FormLabel>
                        <div className="text-muted-foreground text-xs">
                          {t("configuration.displayColorScaleBar")}
                        </div>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="config.config.line.width"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium">
                        {t("configuration.lineWidth")}
                      </FormLabel>
                      <div className="space-y-3">
                        <FormControl>
                          <Slider
                            min={0.5}
                            max={5}
                            step={0.1}
                            value={[field.value || 1]}
                            onValueChange={(value) => field.onChange(value[0])}
                            className="w-full"
                          />
                        </FormControl>
                        <div className="text-muted-foreground text-xs">
                          {tCommon("common.currentValue")} {field.value || 1}
                        </div>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="config.config.line.opacity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium">
                        {t("configuration.lineOpacity")}
                      </FormLabel>
                      <div className="space-y-3">
                        <FormControl>
                          <Slider
                            min={0.1}
                            max={1}
                            step={0.1}
                            value={[field.value || 1]}
                            onValueChange={(value) => field.onChange(value[0])}
                            className="w-full"
                          />
                        </FormControl>
                        <div className="text-muted-foreground text-xs">
                          {tCommon("common.currentValue")} {field.value || 1}
                        </div>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Label Configuration */}
            <div className="space-y-4">
              <h5 className="text-sm font-medium">{t("configuration.labelConfiguration")}</h5>

              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="config.config.labelside"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium">
                        {t("configuration.labelPosition")}
                      </FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger className="h-10 bg-white">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="top">{t("configuration.top")}</SelectItem>
                          <SelectItem value="bottom">{t("configuration.bottom")}</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="config.config.labelangle"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium">
                        {t("configuration.labelAngle")}
                      </FormLabel>
                      <div className="space-y-3">
                        <FormControl>
                          <Slider
                            min={-90}
                            max={90}
                            step={5}
                            value={[field.value || 0]}
                            onValueChange={(value) => field.onChange(value[0])}
                            className="w-full"
                          />
                        </FormControl>
                        <div className="text-muted-foreground text-xs">
                          {tCommon("common.currentValue")} {field.value || 0}°
                        </div>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
