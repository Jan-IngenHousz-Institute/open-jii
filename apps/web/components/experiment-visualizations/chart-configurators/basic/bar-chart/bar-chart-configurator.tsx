"use client";

import { Layers, Eye, Plus, Trash2, Palette, Database } from "lucide-react";
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
  Slider,
} from "@repo/ui/components";

import type { ChartFormValues, SampleTable } from "../../types";

interface BarChartConfiguratorProps {
  form: UseFormReturn<ChartFormValues>;
  table: SampleTable;
  onColumnSelect: (columnType: string, columnName: string) => void;
}

export default function BarChartConfigurator({
  form,
  table,
  onColumnSelect,
}: BarChartConfiguratorProps) {
  const { t } = useTranslation("experimentVisualizations");
  const { t: tCommon } = useTranslation("common");

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
  const categoryDataSources = dataSourceFields
    .map((field, index) => ({ field, index }))
    .filter(({ field }) => field.role === "category");
  const valueDataSources = dataSourceFields
    .map((field, index) => ({ field, index }))
    .filter(({ field }) => field.role === "value");

  // Function to add a new value series
  const addValueSeries = () => {
    const selectedTableName = form.getValues("dataConfig.tableName") || table.name;
    appendDataSource({
      columnName: "",
      tableName: selectedTableName,
      alias: "",
      role: "value",
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
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {categoryDataSources.length > 0 && (
                <>
                  <FormField
                    control={form.control}
                    name={`dataConfig.dataSources.${categoryDataSources[0].index}.columnName`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium">
                          {t("configuration.categoryColumn")}
                        </FormLabel>
                        <Select
                          value={String(field.value)}
                          onValueChange={(value) => {
                            field.onChange(value);
                            onColumnSelect("category", value);
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
                    name={`dataConfig.dataSources.${categoryDataSources[0].index}.alias`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium">
                          {t("categoryAxisTitle")}
                        </FormLabel>
                        <FormControl>
                          <Input
                            placeholder={t("enterAxisTitle")}
                            className="h-10 bg-white"
                            value={String(field.value)}
                            onChange={field.onChange}
                            onBlur={field.onBlur}
                            name={field.name}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              )}
              {categoryDataSources.length === 0 && (
                <div className="text-muted-foreground bg-muted/20 col-span-2 rounded-lg border p-4 text-sm">
                  No category data source configured. This will be handled by the parent form
                  initialization.
                </div>
              )}
            </div>
          </div>

          {/* Value Series Configuration */}
          <div className="rounded-lg border bg-white p-4">
            <div className="mb-4 flex items-center justify-between">
              <h4 className="text-muted-foreground text-sm font-medium uppercase tracking-wide">
                {t("valueSeriesConfiguration")}
              </h4>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addValueSeries}
                className="flex items-center gap-1"
              >
                <Plus className="h-4 w-4" />
                {t("addValueSeries")}
              </Button>
            </div>

            <div className="space-y-4">
              {valueDataSources.map(({ field, index }, seriesIndex) => (
                <Card key={field.id} className="border-l-4 border-l-blue-500">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Layers className="text-primary h-4 w-4" />
                        <CardTitle className="text-sm font-medium">
                          {t("valueSeries")} {seriesIndex + 1}
                        </CardTitle>
                      </div>
                      {valueDataSources.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeDataSource(index)}
                          className="text-destructive hover:text-destructive h-8 w-8 p-0"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                      <FormField
                        control={form.control}
                        name={`dataConfig.dataSources.${index}.columnName`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-medium">
                              {t("configuration.valueColumn")}
                            </FormLabel>
                            <Select
                              value={String(field.value)}
                              onValueChange={(value) => {
                                field.onChange(value);
                                onColumnSelect(`value-${seriesIndex}`, value);
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
                        name={`dataConfig.dataSources.${index}.alias`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-medium">{t("seriesName")}</FormLabel>
                            <FormControl>
                              <Input
                                placeholder={t("enterSeriesName")}
                                className="h-10 bg-white"
                                value={String(field.value)}
                                onChange={field.onChange}
                                onBlur={field.onBlur}
                                name={field.name}
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

      {/* Chart Style Configuration */}
      <Card className="shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <Palette className="text-primary h-5 w-5" />
            <CardTitle className="text-lg font-semibold">{t("styleConfiguration")}</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Bar Orientation */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <FormField
              control={form.control}
              name="config.orientation"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium">{t("barOrientation")}</FormLabel>
                  <Select value={String(field.value)} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="h-10 bg-white">
                        <SelectValue placeholder={t("selectOrientation")} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="vertical">{t("vertical")}</SelectItem>
                      <SelectItem value="horizontal">{t("horizontal")}</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="config.barMode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium">{t("barMode")}</FormLabel>
                  <Select value={String(field.value)} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="h-10 bg-white">
                        <SelectValue placeholder={t("selectBarMode")} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="overlay">{t("overlay")}</SelectItem>
                      <SelectItem value="group">{t("group")}</SelectItem>
                      <SelectItem value="stack">{t("stack")}</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Bar Width */}
          <FormField
            control={form.control}
            name="config.barWidth"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-medium">
                  {t("barWidth")}: {Number(field.value).toFixed(1)}
                </FormLabel>
                <FormControl>
                  <Slider
                    min={0.1}
                    max={1.0}
                    step={0.1}
                    value={[Number(field.value)]}
                    onValueChange={(value) => field.onChange(value[0])}
                    className="w-full"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Show Values */}
          <FormField
            control={form.control}
            name="config.showValues"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-medium">{t("showValues")}</FormLabel>
                <Select
                  value={String(field.value)}
                  onValueChange={(value) => field.onChange(value === "true")}
                >
                  <FormControl>
                    <SelectTrigger className="h-10 bg-white">
                      <SelectValue placeholder={t("selectOption")} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="true">{tCommon("yes")}</SelectItem>
                    <SelectItem value="false">{tCommon("no")}</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </CardContent>
      </Card>

      {/* Display Configuration */}
      <Card className="shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <Eye className="text-primary h-5 w-5" />
            <CardTitle className="text-lg font-semibold">{t("displayConfiguration")}</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <FormField
            control={form.control}
            name="config.chartTitle"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-medium">{t("chartTitle")}</FormLabel>
                <FormControl>
                  <Input
                    placeholder={t("enterChartTitle")}
                    className="h-10 bg-white"
                    value={String(field.value)}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    name={field.name}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </CardContent>
      </Card>
    </div>
  );
}
