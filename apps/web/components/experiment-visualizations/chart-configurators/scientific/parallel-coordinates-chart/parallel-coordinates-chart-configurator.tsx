"use client";

import { Database, Plus, Settings2, Trash2 } from "lucide-react";
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
  Slider,
  Switch,
} from "@repo/ui/components";

import type { ChartFormValues, SampleTable } from "../../types";

interface ParallelCoordinatesChartConfiguratorProps {
  form: UseFormReturn<ChartFormValues>;
  table: SampleTable;
  onColumnSelect: (columnType: "dimensions", columnName: string) => void;
}

export default function ParallelCoordinatesChartConfigurator({
  form,
  table,
  onColumnSelect,
}: ParallelCoordinatesChartConfiguratorProps) {
  const { t } = useTranslation("experimentVisualizations");

  // Use field array for managing data sources
  const {
    fields: dataSourceFields,
    append: appendDataSource,
    remove: removeDataSource,
  } = useFieldArray({
    control: form.control,
    name: "dataConfig.dataSources",
  });

  // Get dimensions data sources
  const dimensionDataSources = dataSourceFields
    .map((field, index) => ({ field, index }))
    .filter(({ field }) => field.role === "dimensions");

  const columns = table.columns;
  const numericColumns = columns.filter(
    (col: DataColumn) =>
      col.type_name === "DOUBLE" ||
      col.type_name === "INT" ||
      col.type_name === "LONG" ||
      col.type_name === "BIGINT",
  );

  const addDimension = () => {
    const selectedTableName = form.getValues("dataConfig.tableName") || table.name;
    appendDataSource({
      columnName: "",
      tableName: selectedTableName,
      alias: `Dimension ${dimensionDataSources.length + 1}`,
      role: "dimensions",
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
          {/* Dimensions Configuration */}
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-medium">{t("parallelCoordinates.dimensions")}</h4>
                <p className="text-muted-foreground text-xs">
                  {t("parallelCoordinates.dimensionsDescription")}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addDimension}
                disabled={numericColumns.length === 0}
              >
                <Plus className="mr-1 h-4 w-4" />
                {t("parallelCoordinates.addDimension")}
              </Button>
            </div>

            <div className="space-y-4">
              {dimensionDataSources.length === 0 ? (
                <div className="border-muted-foreground/25 bg-muted/30 rounded-lg border-2 border-dashed p-8 text-center">
                  <Settings2 className="text-muted-foreground mx-auto mb-3 h-8 w-8" />
                  <p className="text-muted-foreground font-medium">
                    {t("parallelCoordinates.noDimensions")}
                  </p>
                  <p className="text-muted-foreground mt-1 text-sm">
                    {t("parallelCoordinates.addDimensionsToStart")}
                  </p>
                </div>
              ) : (
                dimensionDataSources.map(({ index }, dataSourceIndex) => (
                  <div key={`dimension-${index}`} className="rounded-lg border bg-white p-4">
                    <div className="flex items-start gap-4">
                      <div className="flex-1 space-y-4">
                        <div className="flex items-center justify-between">
                          <Badge variant="outline" className="text-xs">
                            {t("parallelCoordinates.dimension")} {dataSourceIndex + 1}
                          </Badge>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeDataSource(index)}
                            disabled={dimensionDataSources.length <= 1}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>

                        <FormField
                          control={form.control}
                          name={`dataConfig.dataSources.${index}.columnName`}
                          render={({ field: columnField }) => (
                            <FormItem>
                              <FormLabel className="text-sm font-medium">
                                {t("configuration.selectColumn")}
                              </FormLabel>
                              <Select
                                value={columnField.value || ""}
                                onValueChange={(value) => {
                                  const column = numericColumns.find((col) => col.name === value);
                                  columnField.onChange(value);
                                  form.setValue(
                                    `dataConfig.dataSources.${index}.alias`,
                                    column?.name ?? value,
                                  );
                                  onColumnSelect("dimensions", value);
                                }}
                              >
                                <FormControl>
                                  <SelectTrigger className="h-10 bg-white">
                                    <SelectValue placeholder={t("configuration.selectColumn")} />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {numericColumns.map((column) => (
                                    <SelectItem key={column.name} value={column.name}>
                                      <div className="flex items-center gap-2">
                                        <Database className="h-3 w-3" />
                                        <span className="font-medium">{column.name}</span>
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
                          render={({ field: aliasField }) => (
                            <FormItem>
                              <FormLabel className="text-sm font-medium">
                                {t("configuration.displayName")}
                              </FormLabel>
                              <FormControl>
                                <Input
                                  {...aliasField}
                                  value={aliasField.value ?? ""}
                                  placeholder={t("configuration.displayNamePlaceholder")}
                                  className="h-10"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Chart Configuration */}
      <Card className="shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <Settings2 className="text-primary h-5 w-5" />
            <CardTitle className="text-lg font-semibold">{t("chartConfiguration")}</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {/* Line Opacity */}
            <FormField
              control={form.control}
              name="config.lineOpacity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium">
                    {t("parallelCoordinates.lineOpacity")}
                  </FormLabel>
                  <div className="space-y-3">
                    <FormControl>
                      <Slider
                        value={[Number(field.value)]}
                        onValueChange={(value) => field.onChange(value[0])}
                        max={1}
                        min={0}
                        step={0.1}
                        className="w-full"
                      />
                    </FormControl>
                    <div className="text-muted-foreground flex justify-between text-xs">
                      <span>0</span>
                      <span className="font-medium">{Number(field.value) || 0.7}</span>
                      <span>1</span>
                    </div>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Color Scale */}
            <FormField
              control={form.control}
              name="config.colorscale"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium">
                    {t("parallelCoordinates.colorScale")}
                  </FormLabel>
                  <Select value={String(field.value) || "Viridis"} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="h-10">
                        <SelectValue placeholder={t("parallelCoordinates.selectColorScale")} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {[
                        "Viridis",
                        "Plasma",
                        "Inferno",
                        "Magma",
                        "Cividis",
                        "Blues",
                        "Greens",
                        "Reds",
                        "Oranges",
                        "Purples",
                      ].map((colorscale) => (
                        <SelectItem key={colorscale} value={colorscale}>
                          {colorscale}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Show Ranges */}
            <FormField
              control={form.control}
              name="config.showRanges"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <FormLabel className="text-sm font-medium">
                      {t("parallelCoordinates.showRanges")}
                    </FormLabel>
                    <div className="text-muted-foreground text-xs">
                      {t("parallelCoordinates.showRangesDescription")}
                    </div>
                  </div>
                  <FormControl>
                    <Switch checked={Boolean(field.value)} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />

            {/* Show Tick Labels */}
            <FormField
              control={form.control}
              name="config.showTickLabels"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <FormLabel className="text-sm font-medium">
                      {t("parallelCoordinates.showTickLabels")}
                    </FormLabel>
                    <div className="text-muted-foreground text-xs">
                      {t("parallelCoordinates.showTickLabelsDescription")}
                    </div>
                  </div>
                  <FormControl>
                    <Switch
                      checked={Boolean(field.value) !== false}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
