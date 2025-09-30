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
  const variableDataSources = dataSourceFields
    .map((field, index) => ({ field, index }))
    .filter(({ field }) => field.role === "variable");

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
    const selectedTableName = form.getValues("dataConfig.tableName") || table.name;
    appendDataSource({
      columnName: "",
      tableName: selectedTableName,
      alias: "",
      role: "variable",
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
          {/* Categories Configuration */}
          <div className="rounded-lg border bg-white p-4">
            <h4 className="text-muted-foreground mb-3 text-sm font-medium uppercase tracking-wide">
              {t("categoryAxisConfiguration")}
            </h4>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <FormField
                control={form.control}
                name="config.dataSources.categories"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">
                      {t("configuration.categoryColumn")}
                    </FormLabel>
                    <Select
                      value={(field.value as { columnName?: string } | null)?.columnName ?? ""}
                      onValueChange={(value) => {
                        const column = textColumns.find((col) => col.name === value);
                        field.onChange({
                          columnName: value,
                          tableName: table.name,
                          alias: column?.name ?? value,
                        });
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
                name="config.categoryAxis.title"
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
                        value={(field.value as string | null) ?? ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="config.categoryAxis.dataSource.alias"
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
                        value={(field.value as string | null) ?? ""}
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
              {variableDataSources.map(({ field, index }) => (
                <Card key={field.id} className="border-l-primary/20 border-l-4 shadow-sm">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                    <div className="flex items-center gap-2">
                      <Radar className="text-primary h-4 w-4" />
                      <h5 className="font-medium">{t("seriesLabel", { number: index + 1 })}</h5>
                    </div>
                    {variableDataSources.length > 1 && (
                      <Button
                        type="button"
                        onClick={() => removeDataSource(index)}
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
                        name={`config.series.${index}.dataSource.columnName`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-medium">
                              {t("configuration.dataColumn")}
                            </FormLabel>
                            <Select
                              value={String(field.value)}
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
                        name={`config.series.${index}.name`}
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
                                value={(field.value as string | null) ?? ""}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Series Color */}
                      <FormField
                        control={form.control}
                        name={`config.series.${index}.color`}
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
                                  className="h-9 w-16 p-1"
                                  value={(field.value as string | null) ?? "#3b82f6"}
                                />
                                <Input
                                  {...field}
                                  placeholder="#3b82f6"
                                  className="h-9 flex-1"
                                  value={(field.value as string | null) ?? ""}
                                />
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Fill Mode */}
                      <FormField
                        control={form.control}
                        name={`config.series.${index}.fill`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-medium">
                              {t("configuration.fillMode")}
                            </FormLabel>
                            <Select value={String(field.value)} onValueChange={field.onChange}>
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
                        name={`config.series.${index}.mode`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-medium">
                              {t("configuration.displayMode")}
                            </FormLabel>
                            <Select value={String(field.value)} onValueChange={field.onChange}>
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
                        name={`config.series.${index}.opacity`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-medium">
                              {t("configuration.opacity")} (
                              {Math.round(((field.value as number | null) ?? 0.6) * 100)}
                              %)
                            </FormLabel>
                            <FormControl>
                              <Slider
                                value={[Number(field.value)]}
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
                        name={`config.series.${index}.line.width`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-medium">
                              {t("configuration.lineWidth")}
                            </FormLabel>
                            <FormControl>
                              <Slider
                                value={[Number(field.value)]}
                                onValueChange={(value) => field.onChange(value[0])}
                                max={8}
                                min={0.5}
                                step={0.5}
                                className="py-2"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                      {/* Line Dash Style */}
                      <FormField
                        control={form.control}
                        name={`config.series.${index}.line.dash`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-medium">
                              {t("configuration.lineDash")}
                            </FormLabel>
                            <Select value={String(field.value)} onValueChange={field.onChange}>
                              <FormControl>
                                <SelectTrigger className="h-9">
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="solid">
                                  {t("configuration.lineDashSolid")}
                                </SelectItem>
                                <SelectItem value="dot">
                                  {t("configuration.lineDashDot")}
                                </SelectItem>
                                <SelectItem value="dash">
                                  {t("configuration.lineDashDash")}
                                </SelectItem>
                                <SelectItem value="longdash">
                                  {t("configuration.lineDashLongDash")}
                                </SelectItem>
                                <SelectItem value="dashdot">
                                  {t("configuration.lineDashDashDot")}
                                </SelectItem>
                                <SelectItem value="longdashdot">
                                  {t("configuration.lineDashLongDashDot")}
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
                        name={`config.series.${index}.marker.size`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-medium">
                              {t("configuration.markerSize")}
                            </FormLabel>
                            <FormControl>
                              <Slider
                                value={[Number(field.value)]}
                                onValueChange={(value) => field.onChange(value[0])}
                                max={20}
                                min={2}
                                step={1}
                                className="py-2"
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

              {variableDataSources.length === 0 && (
                <div className="border-muted-foreground/25 rounded-lg border border-dashed p-8 text-center">
                  <p className="text-muted-foreground mb-2 text-sm">{t("noSeriesAdded")}</p>
                  <p className="text-muted-foreground text-xs">{t("addSeriesDescription")}</p>
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

        {/* Radar Options */}
        <Card className="shadow-sm">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <Layers className="text-primary h-5 w-5" />
              <CardTitle className="text-lg font-semibold">{t("radarOptions")}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Show Grid */}
            <FormField
              control={form.control}
              name="config.showgrid"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <FormLabel className="text-sm font-medium">{t("showGrid")}</FormLabel>
                    <div className="text-muted-foreground text-xs">{t("showGridDescription")}</div>
                  </div>
                  <FormControl className="flex items-center">
                    <Switch checked={field.value !== false} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />

            {/* Show Tick Labels */}
            <FormField
              control={form.control}
              name="config.showticklabels"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <FormLabel className="text-sm font-medium">{t("showTickLabels")}</FormLabel>
                    <div className="text-muted-foreground text-xs">
                      {t("showTickLabelsDescription")}
                    </div>
                  </div>
                  <FormControl className="flex items-center">
                    <Switch checked={field.value !== false} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />

            {/* Angular Unit */}
            <FormField
              control={form.control}
              name="config.angularaxis.thetaunit"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium">{t("angularUnit")}</FormLabel>
                  <Select value={String(field.value)} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="degrees">{t("degrees")}</SelectItem>
                      <SelectItem value="radians">{t("radians")}</SelectItem>
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
