"use client";

import { TrendingUp, Eye, Database } from "lucide-react";
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
} from "@repo/ui/components";

import type { ChartFormValues, SampleTable } from "../../types";

interface AreaChartConfiguratorProps {
  form: UseFormReturn<ChartFormValues>;
  table: SampleTable;
  onColumnSelect: (columnType: string, columnName: string) => void;
}

export default function AreaChartConfigurator({ form, table }: AreaChartConfiguratorProps) {
  const { t } = useTranslation("experimentVisualizations");

  // Get data source fields filtered by role
  const dataSourceFields = form.watch("dataConfig.dataSources");
  const xField = dataSourceFields.find((field) => field.role === "x");
  const yField = dataSourceFields.find((field) => field.role === "y");

  // Use the provided table directly
  const selectedTable = table;

  // Handle column selection for specific roles
  const handleColumnSelect = (role: "x" | "y", columnName: string) => {
    const currentDataSources = form.getValues("dataConfig.dataSources");
    const updatedDataSources = currentDataSources.map((source) =>
      source.role === role ? { ...source, columnName } : source,
    );
    form.setValue("dataConfig.dataSources", updatedDataSources);
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
          {/* Data Source Configuration */}
          <div className="rounded-lg border bg-white p-4">
            <h4 className="text-muted-foreground mb-3 text-sm font-medium uppercase tracking-wide">
              {t("dataSource")}
            </h4>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {/* X-Axis Column Selection */}
              <FormItem>
                <FormLabel className="text-sm font-medium">{t("configuration.xAxis")}</FormLabel>
                <Select
                  value={xField?.columnName ?? ""}
                  onValueChange={(value) => handleColumnSelect("x", value)}
                >
                  <FormControl>
                    <SelectTrigger className="h-10 bg-white">
                      <SelectValue placeholder={t("configuration.selectColumn")} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {selectedTable.columns.map((column: DataColumn) => (
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
              </FormItem>

              {/* Y-Axis Column Selection */}
              <FormItem>
                <FormLabel className="text-sm font-medium">{t("configuration.yAxis")}</FormLabel>
                <Select
                  value={yField?.columnName ?? ""}
                  onValueChange={(value) => handleColumnSelect("y", value)}
                >
                  <FormControl>
                    <SelectTrigger className="h-10 bg-white">
                      <SelectValue placeholder={t("configuration.selectColumn")} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {selectedTable.columns.map((column: DataColumn) => (
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
              </FormItem>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Area Chart Options & Appearance */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Appearance */}
        <Card className="bg-white shadow-sm">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <Eye className="text-primary h-5 w-5" />
              <CardTitle className="text-lg font-semibold">{t("appearance")}</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-6">
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
                        {...field}
                        value={field.value as string}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="config.yAxisTitle"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">{t("yAxisTitle")}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={t("enterAxisTitle")}
                        className="h-10 bg-white"
                        {...field}
                        value={field.value as string}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="config.color"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">{t("color")}</FormLabel>
                    <Select value={String(field.value)} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="h-10 bg-white">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="#3b82f6">{t("colors.blue")}</SelectItem>
                        <SelectItem value="#ef4444">{t("colors.red")}</SelectItem>
                        <SelectItem value="#10b981">{t("colors.green")}</SelectItem>
                        <SelectItem value="#f59e0b">{t("colors.yellow")}</SelectItem>
                        <SelectItem value="#8b5cf6">{t("colors.purple")}</SelectItem>
                        <SelectItem value="#06b6d4">{t("colors.cyan")}</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>

        {/* Area Chart Specific Options */}
        <Card className="bg-white shadow-sm">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="text-primary h-5 w-5" />
              <CardTitle className="text-lg font-semibold">{t("areaChartOptions")}</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <FormField
                control={form.control}
                name="config.fillMode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">{t("fillMode")}</FormLabel>
                    <Select value={String(field.value)} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="h-10 bg-white">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="tozeroy">{t("fillMode.toZeroY")}</SelectItem>
                        <SelectItem value="tozerox">{t("fillMode.toZeroX")}</SelectItem>
                        <SelectItem value="tonexty">{t("fillMode.toNextY")}</SelectItem>
                        <SelectItem value="tonextx">{t("fillMode.toNextX")}</SelectItem>
                        <SelectItem value="toself">{t("fillMode.toSelf")}</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="config.fillOpacity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">
                      {t("fillOpacity")} ({field.value as number})
                    </FormLabel>
                    <FormControl>
                      <Slider
                        min={0}
                        max={1}
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

              <FormField
                control={form.control}
                name="config.smoothing"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">
                      {t("smoothing")} ({field.value as number})
                    </FormLabel>
                    <FormControl>
                      <Slider
                        min={0}
                        max={1.3}
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

              <FormField
                control={form.control}
                name="config.lineWidth"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">
                      {t("lineWidth")} ({field.value as number}px)
                    </FormLabel>
                    <FormControl>
                      <Slider
                        min={1}
                        max={10}
                        step={1}
                        value={[Number(field.value)]}
                        onValueChange={(value) => field.onChange(value[0])}
                        className="w-full"
                      />
                    </FormControl>
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
