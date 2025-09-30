"use client";

import { ScatterChart, Layers, Eye, Plus, Trash2, Palette, Database } from "lucide-react";
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

import type { ChartFormValues, SampleTable } from "../../types";

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

  // Colorscale gradients based on Plotly's colorscales
  const getColorscaleGradient = (colorscale: string): string => {
    const gradients: Record<string, string> = {
      Viridis:
        "linear-gradient(to right, #440154, #482878, #3e4989, #31688e, #26828e, #1f9e89, #35b779, #6ece58, #b5de2b, #fde725)",
      Plasma:
        "linear-gradient(to right, #0d0887, #46039f, #7201a8, #9c179e, #bd3786, #d8576b, #ed7953, #fb9f3a, #fdca26, #f0f921)",
      Inferno:
        "linear-gradient(to right, #000004, #1b0c41, #4a0c6b, #781c6d, #a52c60, #cf4446, #ed6925, #fb9b06, #f7d13d, #fcffa4)",
      Magma:
        "linear-gradient(to right, #000004, #180f3d, #440f76, #721f81, #9e2f7f, #cd4071, #f1605d, #fd9567, #feca57, #fcfdbf)",
      Cividis:
        "linear-gradient(to right, #00224e, #123570, #3b496c, #575d6d, #707173, #8a8678, #a59c74, #c3b369, #e1cc55, #fde725)",
      Blues:
        "linear-gradient(to right, #f7fbff, #deebf7, #c6dbef, #9ecae1, #6baed6, #4292c6, #2171b5, #08519c, #08306b)",
      Greens:
        "linear-gradient(to right, #f7fcf5, #e5f5e0, #c7e9c0, #a1d99b, #74c476, #41ab5d, #238b45, #006d2c, #00441b)",
      Reds: "linear-gradient(to right, #fff5f0, #fee0d2, #fcbba1, #fc9272, #fb6a4a, #ef3b2c, #cb181d, #a50f15, #67000d)",
      Oranges:
        "linear-gradient(to right, #fff5eb, #fee6ce, #fdd0a2, #fdae6b, #fd8d3c, #f16913, #d94801, #a63603, #7f2704)",
      Purples:
        "linear-gradient(to right, #fcfbfd, #efedf5, #dadaeb, #bcbddc, #9e9ac8, #807dba, #6a51a3, #54278f, #3f007d)",
      Greys:
        "linear-gradient(to right, #ffffff, #f0f0f0, #d9d9d9, #bdbdbd, #969696, #737373, #525252, #252525, #000000)",
      Hot: "linear-gradient(to right, #000000, #ff0000, #ffff00, #ffffff)",
      Cool: "linear-gradient(to right, #00ffff, #0080ff, #0000ff, #8000ff, #ff00ff)",
      Rainbow:
        "linear-gradient(to right, #ff0000, #ff8000, #ffff00, #80ff00, #00ff00, #00ff80, #00ffff, #0080ff, #0000ff, #8000ff, #ff00ff)",
      Jet: "linear-gradient(to right, #000080, #0000ff, #0080ff, #00ffff, #80ff00, #ffff00, #ff8000, #ff0000, #800000)",
    };
    return gradients[colorscale] || gradients.Viridis;
  };

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
          <div className="rounded-lg border bg-white p-4">
            <h4 className="text-muted-foreground mb-3 text-sm font-medium uppercase tracking-wide">
              {t("xAxisConfiguration")}
            </h4>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <FormField
                control={form.control}
                name={
                  xAxisDataSources[0]
                    ? (`dataConfig.dataSources.${xAxisDataSources[0].index}.columnName` as const)
                    : ("dataConfig.dataSources.0.columnName" as const)
                }
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">
                      {t("configuration.xAxis")}
                    </FormLabel>
                    <Select
                      value={String(field.value)}
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
                name="config.xTitle"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">{t("xAxisTitle")}</FormLabel>
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

              <FormField
                control={form.control}
                name="config.xAxisType"
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
                                onColumnSelect(`y-${seriesIndex}`, value);
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

                      <FormField
                        control={form.control}
                        name={`config.ySeries[${seriesIndex}].side` as const}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-medium">{t("yAxisSide")}</FormLabel>
                            <Select value={String(field.value)} onValueChange={field.onChange}>
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
                    {seriesIndex === 0 && (
                      <FormField
                        control={form.control}
                        name="config.yTitle"
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

          {/* Color Dimension Configuration */}
          <div className="rounded-lg border bg-white p-4">
            <h4 className="text-muted-foreground mb-3 text-sm font-medium uppercase tracking-wide">
              {t("colorDimensionConfiguration")}
            </h4>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div>
                <FormLabel className="text-sm font-medium">
                  {t("configuration.colorColumn")}
                </FormLabel>
                <Select
                  value={colorAxisDataSources[0]?.field.columnName || "none"}
                  onValueChange={(value) => {
                    if (value === "none") {
                      // Remove the color data source when "None" is selected
                      if (colorAxisDataSources[0]) {
                        removeDataSource(colorAxisDataSources[0].index);
                      }
                    } else {
                      if (colorAxisDataSources[0]) {
                        // Update existing color data source
                        form.setValue(
                          `dataConfig.dataSources.${colorAxisDataSources[0].index}.columnName` as const,
                          value,
                        );
                      } else {
                        // Add new color data source
                        appendDataSource({
                          tableName: form.watch("dataConfig.tableName") || "",
                          columnName: value,
                          role: "color",
                          alias: "",
                        });
                      }
                      onColumnSelect("color", value);
                    }
                  }}
                >
                  <SelectTrigger className="h-10 bg-white">
                    <SelectValue placeholder={t("configuration.selectColorColumn")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">
                      <span className="text-muted-foreground italic">
                        {t("configuration.noColorMapping")}
                      </span>
                    </SelectItem>
                    {table.columns.map((column) => (
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
              </div>

              {/* Color Scale Selection - only show when colorAxis is configured */}
              {colorAxisDataSources.length > 0 && colorAxisDataSources[0]?.field.columnName && (
                <FormField
                  control={form.control}
                  name="config.colorScale"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium">
                        {t("configuration.colorScale")}
                      </FormLabel>
                      <Select value={String(field.value)} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger className="h-10 bg-white">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Viridis">
                            <div className="flex items-center gap-3">
                              <div
                                className="h-4 w-8 rounded border"
                                style={{
                                  background: getColorscaleGradient("Viridis"),
                                }}
                              />
                              {t("colorscales.viridis")}
                            </div>
                          </SelectItem>
                          <SelectItem value="Plasma">
                            <div className="flex items-center gap-3">
                              <div
                                className="h-4 w-8 rounded border"
                                style={{
                                  background: getColorscaleGradient("Plasma"),
                                }}
                              />
                              {t("colorscales.plasma")}
                            </div>
                          </SelectItem>
                          <SelectItem value="Inferno">
                            <div className="flex items-center gap-3">
                              <div
                                className="h-4 w-8 rounded border"
                                style={{
                                  background: getColorscaleGradient("Inferno"),
                                }}
                              />
                              {t("colorscales.inferno")}
                            </div>
                          </SelectItem>
                          <SelectItem value="Magma">
                            <div className="flex items-center gap-3">
                              <div
                                className="h-4 w-8 rounded border"
                                style={{
                                  background: getColorscaleGradient("Magma"),
                                }}
                              />
                              {t("colorscales.magma")}
                            </div>
                          </SelectItem>
                          <SelectItem value="Cividis">
                            <div className="flex items-center gap-3">
                              <div
                                className="h-4 w-8 rounded border"
                                style={{
                                  background: getColorscaleGradient("Cividis"),
                                }}
                              />
                              {t("colorscales.cividis")}
                            </div>
                          </SelectItem>
                          <SelectItem value="Blues">
                            <div className="flex items-center gap-3">
                              <div
                                className="h-4 w-8 rounded border"
                                style={{
                                  background: getColorscaleGradient("Blues"),
                                }}
                              />
                              {t("colorscales.blues")}
                            </div>
                          </SelectItem>
                          <SelectItem value="Greens">
                            <div className="flex items-center gap-3">
                              <div
                                className="h-4 w-8 rounded border"
                                style={{
                                  background: getColorscaleGradient("Greens"),
                                }}
                              />
                              {t("colorscales.greens")}
                            </div>
                          </SelectItem>
                          <SelectItem value="Reds">
                            <div className="flex items-center gap-3">
                              <div
                                className="h-4 w-8 rounded border"
                                style={{
                                  background: getColorscaleGradient("Reds"),
                                }}
                              />
                              {t("colorscales.reds")}
                            </div>
                          </SelectItem>
                          <SelectItem value="Oranges">
                            <div className="flex items-center gap-3">
                              <div
                                className="h-4 w-8 rounded border"
                                style={{
                                  background: getColorscaleGradient("Oranges"),
                                }}
                              />
                              {t("colorscales.oranges")}
                            </div>
                          </SelectItem>
                          <SelectItem value="Purples">
                            <div className="flex items-center gap-3">
                              <div
                                className="h-4 w-8 rounded border"
                                style={{
                                  background: getColorscaleGradient("Purples"),
                                }}
                              />
                              {t("colorscales.purples")}
                            </div>
                          </SelectItem>
                          <SelectItem value="Greys">
                            <div className="flex items-center gap-3">
                              <div
                                className="h-4 w-8 rounded border"
                                style={{
                                  background: getColorscaleGradient("Greys"),
                                }}
                              />
                              {t("colorscales.greys")}
                            </div>
                          </SelectItem>
                          <SelectItem value="Hot">
                            <div className="flex items-center gap-3">
                              <div
                                className="h-4 w-8 rounded border"
                                style={{
                                  background: getColorscaleGradient("Hot"),
                                }}
                              />
                              {t("colorscales.hot")}
                            </div>
                          </SelectItem>
                          <SelectItem value="Cool">
                            <div className="flex items-center gap-3">
                              <div
                                className="h-4 w-8 rounded border"
                                style={{
                                  background: getColorscaleGradient("Cool"),
                                }}
                              />
                              {t("colorscales.cool")}
                            </div>
                          </SelectItem>
                          <SelectItem value="Rainbow">
                            <div className="flex items-center gap-3">
                              <div
                                className="h-4 w-8 rounded border"
                                style={{
                                  background: getColorscaleGradient("Rainbow"),
                                }}
                              />
                              {t("colorscales.rainbow")}
                            </div>
                          </SelectItem>
                          <SelectItem value="Jet">
                            <div className="flex items-center gap-3">
                              <div
                                className="h-4 w-8 rounded border"
                                style={{
                                  background: getColorscaleGradient("Jet"),
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
                            background: getColorscaleGradient(field.value ?? "Viridis"),
                          }}
                        />
                      </div>

                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>

            {/* Color Axis Title - only show when colorAxis is configured */}
            {colorAxisDataSources.length > 0 && colorAxisDataSources[0]?.field.columnName && (
              <div className="mt-4">
                <FormField
                  control={form.control}
                  name="config.zTitle"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium">
                        {t("configuration.colorAxisTitle")}
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder={t("enterColorAxisTitle")}
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
              </div>
            )}
          </div>
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
                name="config.markerSize"
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
                name="config.markerShape"
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
                name="config.gridLines"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">
                      {t("chartOptions.gridLines")}
                    </FormLabel>
                    <Select value={String(field.value)} onValueChange={field.onChange}>
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

              {/* Show Color Bar - only when color mapping is configured */}
              {colorAxisDataSources.length > 0 && colorAxisDataSources[0]?.field.columnName && (
                <FormField
                  control={form.control}
                  name="config.showColorBar"
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

              <FormField
                control={form.control}
                name="config.legendPosition"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">
                      {t("chartOptions.legendPosition")}
                    </FormLabel>
                    <Select value={String(field.value)} onValueChange={field.onChange}>
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
