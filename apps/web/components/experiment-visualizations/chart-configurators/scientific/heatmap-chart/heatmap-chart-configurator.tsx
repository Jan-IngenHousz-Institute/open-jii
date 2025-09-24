"use client";

import { Eye, Database, Layers } from "lucide-react";
import type { UseFormReturn } from "react-hook-form";

import type { DataColumn } from "@repo/api";
import { useTranslation } from "@repo/i18n";
import {
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

interface HeatmapChartConfiguratorProps {
  form: UseFormReturn<ChartFormValues>;
  table: SampleTable;
  onColumnSelect: (columnType: "x" | "y" | "z", columnName: string) => void;
}

export default function HeatmapChartConfigurator({
  form,
  table,
  onColumnSelect,
}: HeatmapChartConfiguratorProps) {
  const { t } = useTranslation("experimentVisualizations");

  const columns = table.columns;
  const numericColumns = columns.filter(
    (col: DataColumn) =>
      col.type_name === "DOUBLE" ||
      col.type_name === "INT" ||
      col.type_name === "LONG" ||
      col.type_name === "BIGINT",
  );

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
                        {columns.map((column: DataColumn) => (
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
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>

          {/* Y-Axis Configuration */}
          <div className="rounded-lg border bg-white p-4">
            <h4 className="text-muted-foreground mb-3 text-sm font-medium uppercase tracking-wide">
              {t("yAxisConfiguration")}
            </h4>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <FormField
                control={form.control}
                name="config.config.yAxis.dataSource.columnName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">
                      {t("configuration.yAxis")}
                    </FormLabel>
                    <Select
                      value={field.value || ""}
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
                        {columns.map((column: DataColumn) => (
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
                name="config.config.yAxis.title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">{t("yAxisTitle")}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={t("enterAxisTitle")}
                        className="h-10 bg-white"
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>

          {/* Z-Axis (Values) Configuration */}
          <div className="rounded-lg border bg-white p-4">
            <h4 className="text-muted-foreground mb-3 text-sm font-medium uppercase tracking-wide">
              {t("heatmapValuesConfiguration")}
            </h4>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <FormField
                control={form.control}
                name="config.config.zAxis.dataSource.columnName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">{t("heatmapValues")}</FormLabel>
                    <Select
                      value={field.value || ""}
                      onValueChange={(value) => {
                        field.onChange(value);
                        onColumnSelect("z", value);
                      }}
                    >
                      <FormControl>
                        <SelectTrigger className="h-10 bg-white">
                          <SelectValue placeholder={t("selectNumericColumn")} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {numericColumns.length > 0 ? (
                          numericColumns.map((column: DataColumn) => (
                            <SelectItem key={column.name} value={column.name}>
                              <div className="flex items-center gap-2">
                                <span>{column.name}</span>
                                <Badge variant="secondary" className="text-xs">
                                  {column.type_name}
                                </Badge>
                              </div>
                            </SelectItem>
                          ))
                        ) : (
                          <SelectItem value="__no_numeric_columns__" disabled>
                            <span className="text-muted-foreground text-sm">
                              {t("noNumericColumns")}
                            </span>
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="config.config.zAxis.title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">{t("valuesLabel")}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={t("enterValuesLabel")}
                        className="h-10 bg-white"
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Heatmap Appearance Options */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Appearance */}
        <Card className="bg-white shadow-sm">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <Eye className="text-primary h-5 w-5" />
              <CardTitle className="text-lg font-semibold">{t("appearance")}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Chart Display Options */}
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
                        value={field.value ?? ""}
                      />
                    </FormControl>
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

            <div className="border-t pt-4">
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="config.config.showText"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <FormLabel className="text-sm font-medium">{t("showTextValues")}</FormLabel>
                        <div className="text-muted-foreground text-xs">
                          {t("showTextValuesDescription")}
                        </div>
                      </div>
                      <FormControl className="flex items-center">
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />

                {/* Text styling options in 50/50 grid */}
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="config.config.textTemplate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium">{t("textTemplate")}</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="%{z}"
                            className="h-10 bg-white"
                            {...field}
                            value={field.value}
                          />
                        </FormControl>
                        <div className="text-muted-foreground text-xs">
                          {t("textTemplateDescription")}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="config.config.textFont.color"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium">{t("textColor")}</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger className="h-10 bg-white">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="white">{t("colors.white")}</SelectItem>
                            <SelectItem value="black">{t("colors.black")}</SelectItem>
                            <SelectItem value="auto">{t("colors.auto")}</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Font size slider underneath as full width */}
                <FormField
                  control={form.control}
                  name="config.config.textFont.size"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium">{t("fontSize")}</FormLabel>
                      <FormControl>
                        <div className="space-y-3">
                          <Slider
                            min={8}
                            max={24}
                            step={1}
                            value={[field.value]}
                            onValueChange={(values) => field.onChange(values[0])}
                            className="w-full"
                          />
                          <div className="flex items-center justify-center">
                            <span className="text-muted-foreground text-sm">{field.value}px</span>
                          </div>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Heatmap Options */}
        <Card className="bg-white shadow-sm">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <Layers className="text-primary h-5 w-5" />
              <CardTitle className="text-lg font-semibold">{t("heatmapOptions")}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <FormField
              control={form.control}
              name="config.config.colorscale"
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
                    <div className="text-muted-foreground mb-1 text-xs">{t("preview.title")}</div>
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
              name="config.config.showScale"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <FormLabel className="text-sm font-medium">{t("showColorScale")}</FormLabel>
                    <div className="text-muted-foreground text-xs">
                      {t("showColorScaleDescription")}
                    </div>
                  </div>
                  <FormControl className="flex items-center">
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="config.config.colorbarTitle"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium">{t("colorbarTitle")}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t("enterColorbarTitle")}
                      className="h-10 bg-white"
                      {...field}
                      value={field.value ?? ""}
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
