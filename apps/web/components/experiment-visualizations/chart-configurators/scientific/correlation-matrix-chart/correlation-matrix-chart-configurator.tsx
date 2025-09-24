"use client";

import { Eye, Database, TrendingUp, Plus, Layers, Trash2 } from "lucide-react";
import type { UseFormReturn } from "react-hook-form";
import { useFieldArray } from "react-hook-form";

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
  Badge,
  Switch,
  Button,
} from "@repo/ui/components";

import type { ChartFormValues, SampleTable } from "../../types";

interface CorrelationMatrixChartConfiguratorProps {
  form: UseFormReturn<ChartFormValues>;
  table: SampleTable;
  onColumnSelect: (columnType: string, columnName: string) => void;
}

export default function CorrelationMatrixChartConfigurator({
  form,
  table,
  onColumnSelect,
}: CorrelationMatrixChartConfiguratorProps) {
  const { t } = useTranslation("experimentVisualizations");

  // Use field array for multiple variables
  const {
    fields: variablesFields,
    append: appendVariable,
    remove: removeVariable,
  } = useFieldArray({
    control: form.control,
    name: "config.config.variables",
  });

  const columns = table.columns;
  const numericColumns = columns.filter(
    (col: DataColumn) =>
      col.type_name === "DOUBLE" ||
      col.type_name === "INT" ||
      col.type_name === "LONG" ||
      col.type_name === "BIGINT",
  );

  const addVariable = () => {
    appendVariable({
      tableName: form.watch("dataConfig.tableName") || "",
      columnName: "",
      alias: "",
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
          {/* Variables Configuration */}
          <div className="rounded-lg border bg-white p-4">
            <div className="mb-4 flex items-center justify-between">
              <h4 className="text-muted-foreground text-sm font-medium uppercase tracking-wide">
                {t("correlationMatrix.variablesConfiguration")}
              </h4>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addVariable}
                className="h-8 px-3"
              >
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                {t("correlationMatrix.addVariable")}
              </Button>
            </div>

            <div className="space-y-4">
              {variablesFields.length === 0 && (
                <div className="text-muted-foreground py-8 text-center">
                  <TrendingUp className="mx-auto mb-2 h-12 w-12 opacity-50" />
                  <p className="text-sm">{t("correlationMatrix.noVariablesSelected")}</p>
                  <p className="mt-1 text-xs">{t("correlationMatrix.selectAtLeastTwoVariables")}</p>
                </div>
              )}

              {variablesFields.map((field, index) => (
                <Card key={field.id} className="border-l-primary/20 border-l-4 shadow-sm">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                    <div className="flex items-center gap-2">
                      <Layers className="text-primary h-4 w-4" />
                      <CardTitle className="text-sm font-medium">
                        {t("correlationMatrix.variable")} {index + 1}
                      </CardTitle>
                    </div>
                    {variablesFields.length > 2 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeVariable(index)}
                        className="text-muted-foreground hover:text-destructive h-8 w-8 p-0"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                      <FormField
                        control={form.control}
                        name={`config.config.variables.${index}.columnName`}
                        render={({ field: columnField }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-medium">{t("dataColumn")}</FormLabel>
                            <Select
                              value={columnField.value}
                              onValueChange={(value) => {
                                columnField.onChange(value);
                                onColumnSelect("variable", value);
                              }}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder={t("configuration.selectColumn")} />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {numericColumns.map((col) => (
                                  <SelectItem key={col.name} value={col.name}>
                                    <div className="flex items-center gap-2">
                                      <TrendingUp className="h-3.5 w-3.5" />
                                      <span className="font-medium">{col.name}</span>
                                      <Badge variant="secondary" className="text-xs">
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
                        name={`config.config.variables.${index}.alias`}
                        render={({ field: aliasField }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-medium">
                              {t("displayName")}
                            </FormLabel>
                            <FormControl>
                              <Input
                                placeholder={t("enterDisplayName")}
                                {...aliasField}
                                className="h-9"
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

      {/* Appearance */}
      <Card className="shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <Eye className="text-primary h-5 w-5" />
            <CardTitle className="text-lg font-semibold">{t("appearance")}</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Color Scale and Colorbar Title in 50/50 grid */}
          <div className="grid grid-cols-2 gap-6">
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
                      <SelectItem value="viridis">
                        <div className="flex items-center gap-3">
                          <div
                            className="h-4 w-8 rounded border"
                            style={{
                              background: getColorscaleGradient("viridis"),
                            }}
                          />
                          Viridis
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
                          Plasma
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
                          Inferno
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
                          Magma
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
                          Cividis
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
                          Blues
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
                          Greens
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
                          Reds
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
                          Oranges
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
                          Purples
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
                          Greys
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
                          Hot
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
                          Cool
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
                          Rainbow
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
                          Jet
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
              name="config.config.colorbarTitle"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium">
                    {t("correlationMatrix.colorbarTitle")}
                  </FormLabel>
                  <FormControl>
                    <Input placeholder={t("correlationMatrix.enterColorbarTitle")} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Display Options */}
          <div className="rounded-lg border bg-white p-4">
            <h4 className="text-muted-foreground mb-4 text-sm font-medium uppercase tracking-wide">
              {t("displayOptions")}
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="config.config.showValues"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <FormLabel className="text-sm font-medium">{t("showValues")}</FormLabel>
                      <div className="text-muted-foreground text-xs">
                        {t("correlationMatrix.showCorrelationValues")}
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
                name="config.config.showScale"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <FormLabel className="text-sm font-medium">
                        {t("correlationMatrix.showColorScale")}
                      </FormLabel>
                      <div className="text-muted-foreground text-xs">
                        {t("correlationMatrix.showColorScaleLegend")}
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
                name="config.config.display.showLegend"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <FormLabel className="text-sm font-medium">{t("showLegend")}</FormLabel>
                      <div className="text-muted-foreground text-xs">
                        {t("showLegendDescription")}
                      </div>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
