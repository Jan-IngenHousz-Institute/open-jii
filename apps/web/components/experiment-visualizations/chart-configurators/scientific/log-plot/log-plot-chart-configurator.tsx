"use client";

import { TrendingUp, Layers, Eye, Plus, Trash2, Database } from "lucide-react";
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
  Switch,
} from "@repo/ui/components";

import type { ChartFormValues, SampleTable } from "../../types";

interface LogPlotChartConfiguratorProps {
  form: UseFormReturn<ChartFormValues>;
  table: SampleTable;
  onColumnSelect: (columnType: "x" | "y", columnName: string) => void;
}

export default function LogPlotChartConfigurator({
  form,
  table,
  onColumnSelect,
}: LogPlotChartConfiguratorProps) {
  const { t } = useTranslation("experimentVisualizations");
  const { t: _tCommon } = useTranslation("common");

  // Hook for managing data sources array (role-based approach)
  const {
    fields: dataSourceFields,
    append: appendDataSource,
    remove: removeDataSource,
  } = useFieldArray({
    control: form.control,
    name: "dataConfig.dataSources",
  });

  // Get data sources by role
  const _xAxisDataSources = dataSourceFields
    .map((field, index) => ({ field, index }))
    .filter(({ field }) => field.role === "x");
  const yAxisDataSources = dataSourceFields
    .map((field, index) => ({ field, index }))
    .filter(({ field }) => field.role === "y");

  const addYAxisSeries = () => {
    const selectedTableName = form.getValues("dataConfig.tableName") || table.name;
    appendDataSource({
      columnName: "",
      tableName: selectedTableName,
      alias: "",
      role: "y",
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
        <CardContent>
          {/* Two-axis configuration */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* X Axis */}
            <div className="rounded-lg border bg-white p-4">
              <h4 className="text-muted-foreground mb-3 text-sm font-medium uppercase tracking-wide">
                {t("xAxisConfiguration")}
              </h4>
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="config.dataSources.x"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium">
                        {t("configuration.xAxis")}
                      </FormLabel>
                      <Select
                        value={(field.value as { columnName?: string } | null)?.columnName ?? ""}
                        onValueChange={(value) => {
                          const column = table.columns.find((col) => col.name === value);
                          field.onChange({
                            columnName: value,
                            tableName: table.name,
                            alias: column?.name ?? value,
                          });
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
                  name="config.xAxis.title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium">{t("xAxisTitle")}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={t("enterAxisTitle")}
                          className="h-10 bg-white"
                          {...field}
                          value={(field.value as string | null) ?? ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="config.xAxis.type"
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
                          <SelectItem value="linear">
                            {t("configuration.axisTypeLinear")}
                          </SelectItem>
                          <SelectItem value="log">{t("configuration.axisTypeLog")}</SelectItem>
                          <SelectItem value="date">{t("configuration.axisTypeDate")}</SelectItem>
                          <SelectItem value="category">
                            {t("configuration.axisTypeCategory")}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Y Series (placeholder for role-based approach) */}
            <div className="rounded-lg border bg-white p-4">
              <h4 className="text-muted-foreground mb-3 text-sm font-medium uppercase tracking-wide">
                {t("ySeriesConfiguration")}
              </h4>
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="config.dataSources.y"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium">
                        {t("configuration.yAxis")}
                      </FormLabel>
                      <Select
                        value={(field.value as { columnName?: string } | null)?.columnName ?? ""}
                        onValueChange={(value) => {
                          const column = table.columns.find((col) => col.name === value);
                          field.onChange({
                            columnName: value,
                            tableName: table.name,
                            alias: column?.name ?? value,
                          });
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

                <div className="text-muted-foreground text-sm">{t("logPlotYSeriesNote")}</div>
              </div>
            </div>
          </div>

          {/* Y-Axes Series Configuration */}
          <div className="mt-8 space-y-4">
            <div className="flex items-center justify-between">
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
                {t("configuration.addYAxisSeries")}
              </Button>
            </div>

            <div className="space-y-4">
              {yAxisDataSources.map(({ field, index }) => (
                <Card key={field.id} className="border-l-primary/20 border-l-4 shadow-sm">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="text-primary h-4 w-4" />
                      <h5 className="font-medium">{t("yAxisLabel", { number: index + 1 })}</h5>
                    </div>
                    <Button
                      type="button"
                      onClick={() => removeDataSource(index)}
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                      {/* Data Column */}
                      <FormField
                        control={form.control}
                        name={`config.yAxes.${index}.dataSource.columnName`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-medium">
                              {t("configuration.dataColumn")}
                            </FormLabel>
                            <Select value={String(field.value)} onValueChange={field.onChange}>
                              <FormControl>
                                <SelectTrigger className="h-10 bg-white">
                                  <SelectValue placeholder={t("configuration.selectColumn")} />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {table.columns
                                  .filter(
                                    (col: DataColumn) =>
                                      col.type_name === "DOUBLE" ||
                                      col.type_name === "INT" ||
                                      col.type_name === "LONG" ||
                                      col.type_name === "BIGINT",
                                  )
                                  .map((column: DataColumn) => (
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

                      {/* Axis Title */}
                      <FormField
                        control={form.control}
                        name={`config.yAxes.${index}.title`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-medium">
                              {t("configuration.axisTitle")}
                            </FormLabel>
                            <FormControl>
                              <Input
                                placeholder={t("enterAxisTitle")}
                                className="h-10 bg-white"
                                {...field}
                                value={(field.value as string | null) ?? ""}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Axis Type */}
                      <FormField
                        control={form.control}
                        name={`config.yAxes.${index}.type`}
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
                                <SelectItem value="linear">
                                  {t("configuration.axisTypeLinear")}
                                </SelectItem>
                                <SelectItem value="log">
                                  {t("configuration.axisTypeLog")}
                                </SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Axis Side */}
                      <FormField
                        control={form.control}
                        name={`config.yAxes.${index}.side`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-medium">
                              {t("configuration.axisSide")}
                            </FormLabel>
                            <Select value={String(field.value)} onValueChange={field.onChange}>
                              <FormControl>
                                <SelectTrigger className="h-10 bg-white">
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="left">
                                  {t("configuration.axisSideLeft")}
                                </SelectItem>
                                <SelectItem value="right">
                                  {t("configuration.axisSideRight")}
                                </SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <Separator className="my-4" />

                    {/* Color Configuration */}
                    <FormField
                      control={form.control}
                      name={`config.yAxes.${index}.color`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-medium">
                            {t("configuration.color")}
                          </FormLabel>
                          <FormControl>
                            <div className="flex items-center gap-2">
                              <Input
                                {...field}
                                type="color"
                                className="h-10 w-16 p-1"
                                value={(field.value as string | null) ?? "#3b82f6"}
                              />
                              <Input
                                {...field}
                                placeholder="#3b82f6"
                                className="h-10 flex-1 bg-white"
                                value={(field.value as string | null) ?? ""}
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>
              ))}

              {yAxisDataSources.length === 0 && (
                <div className="border-muted-foreground/25 rounded-lg border border-dashed p-8 text-center">
                  <p className="text-muted-foreground mb-2 text-sm">{t("noYAxesAdded")}</p>
                  <p className="text-muted-foreground text-xs">{t("addYAxesDescription")}</p>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Configuration Options */}
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
            <FormField
              control={form.control}
              name="config.display.title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium">{t("chartTitle")}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t("enterChartTitle")}
                      {...field}
                      value={(field.value as string | null) ?? ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="config.display.showLegend"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <FormLabel className="text-sm font-medium">{t("showLegend")}</FormLabel>
                    <div className="text-muted-foreground text-xs">
                      {t("configuration.showLegendDescription")}
                    </div>
                  </div>
                  <FormControl className="flex items-center">
                    <Switch checked={field.value !== false} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="config.display.legendPosition"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium">
                    {t("chartOptions.legendPosition")}
                  </FormLabel>
                  <Select value={String(field.value)} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
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
          </CardContent>
        </Card>

        {/* Log Plot Options */}
        <Card className="shadow-sm">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <Layers className="text-primary h-5 w-5" />
              <CardTitle className="text-lg font-semibold">{t("logPlotOptions")}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-muted-foreground text-sm">{t("logPlotDescription")}</div>

            <FormField
              control={form.control}
              name="config.mode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium">{t("displayMode")}</FormLabel>
                  <Select value={String(field.value)} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="lines">{t("linesOnly")}</SelectItem>
                      <SelectItem value="markers">{t("markersOnly")}</SelectItem>
                      <SelectItem value="lines+markers">{t("linesAndMarkers")}</SelectItem>
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
