"use client";

import {
  LineChart,
  BarChart3,
  PieChart,
  ScatterChart,
  TrendingUp,
  Layers,
  Activity,
  BarChart,
} from "lucide-react";
import { useState } from "react";
import type { ReactNode } from "react";
import type { UseFormReturn } from "react-hook-form";

import type { ChartFamily, ChartType } from "@repo/api";
import { useTranslation } from "@repo/i18n";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  RadioGroup,
  RadioGroupItem,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components";

// Import specific chart configurators and types
import {
  LineChartConfigurator,
  BarChartConfigurator,
  PieChartConfigurator,
  AreaChartConfigurator,
  ScatterChartConfigurator,
  DotPlotConfigurator,
  BubbleChartConfigurator,
  LollipopChartConfigurator,
  HeatmapChartConfigurator,
  ContourChartConfigurator,
  TernaryChartConfigurator,
  CorrelationMatrixChartConfigurator,
  LogPlotChartConfigurator,
  ParallelCoordinatesChartConfigurator,
  RadarChartConfigurator,
} from "./index";
import type { ChartFormValues, SampleTable } from "./types";

// Define chart types grouped by family for UX purposes - labels will be translated in component
const CHART_TYPES_CONFIG: {
  type: ChartType;
  family: ChartFamily;
  labelKey: string;
  icon: ReactNode;
}[] = [
  // Basic Charts
  {
    type: "line",
    family: "basic",
    labelKey: "chartTypes.line",
    icon: <LineChart className="h-5 w-5" />,
  },
  {
    type: "scatter",
    family: "basic",
    labelKey: "chartTypes.scatter",
    icon: <ScatterChart className="h-5 w-5" />,
  },
  {
    type: "bar",
    family: "basic",
    labelKey: "chartTypes.bar",
    icon: <BarChart3 className="h-5 w-5" />,
  },
  {
    type: "area",
    family: "basic",
    labelKey: "chartTypes.area",
    icon: <TrendingUp className="h-5 w-5" />,
  },
  {
    type: "pie",
    family: "basic",
    labelKey: "chartTypes.pie",
    icon: <PieChart className="h-5 w-5" />,
  },
  {
    type: "dot-plot",
    family: "basic",
    labelKey: "chartTypes.dot-plot",
    icon: <ScatterChart className="h-5 w-5" />,
  },

  // Scientific Charts
  {
    type: "heatmap",
    family: "scientific",
    labelKey: "chartTypes.heatmap",
    icon: <Layers className="h-5 w-5" />,
  },
  {
    type: "contour",
    family: "scientific",
    labelKey: "chartTypes.contour",
    icon: <Activity className="h-5 w-5" />,
  },
  {
    type: "ternary",
    family: "scientific",
    labelKey: "chartTypes.ternary",
    icon: <ScatterChart className="h-5 w-5" />,
  },
  {
    type: "correlation-matrix",
    family: "scientific",
    labelKey: "chartTypes.correlation-matrix",
    icon: <Layers className="h-5 w-5" />,
  },
  {
    type: "log-plot",
    family: "scientific",
    labelKey: "chartTypes.log-plot",
    icon: <TrendingUp className="h-5 w-5" />,
  },
  {
    type: "parallel-coordinates",
    family: "scientific",
    labelKey: "chartTypes.parallel-coordinates",
    icon: <BarChart className="h-5 w-5" />,
  },
  {
    type: "radar",
    family: "scientific",
    labelKey: "chartTypes.radar",
    icon: <Activity className="h-5 w-5" />,
  },
  {
    type: "polar",
    family: "scientific",
    labelKey: "chartTypes.polar",
    icon: <Activity className="h-5 w-5" />,
  },
  {
    type: "wind-rose",
    family: "scientific",
    labelKey: "chartTypes.wind-rose",
    icon: <Activity className="h-5 w-5" />,
  },
];

interface ChartConfiguratorProps {
  form: UseFormReturn<ChartFormValues>;
  tables: SampleTable[];
  selectedChartType: ChartType | null;
  onChartTypeSelect: (chartType: ChartType) => void;
}

export default function ChartConfigurator({
  form,
  tables,
  selectedChartType,
  onChartTypeSelect,
}: ChartConfiguratorProps) {
  const { t } = useTranslation("experimentVisualizations");
  const [selectedTableName, setSelectedTableName] = useState<string | undefined>(
    tables.length > 0 ? tables[0].name : undefined,
  );

  // Translate chart types with current locale
  const CHART_TYPES = CHART_TYPES_CONFIG.map((chartConfig) => ({
    ...chartConfig,
    label: t(chartConfig.labelKey),
  }));

  // Find the selected table
  const selectedTable = tables.find((table) => table.name === selectedTableName);

  // Handle table selection
  const handleTableChange = (tableName: string) => {
    setSelectedTableName(tableName);

    // Update dataConfig
    form.setValue("dataConfig.tableName", tableName);

    // Update the config with the new table name
    if (selectedChartType) {
      // Update the table name in the config
      switch (selectedChartType) {
        case "line":
        case "bar":
        case "scatter":
        case "area":
        case "dot-plot":
          form.setValue("config.config.xAxis.dataSource.tableName", tableName);
          form.setValue("config.config.yAxes.0.dataSource.tableName", tableName);
          break;
        case "bubble":
          form.setValue("config.config.xAxis.dataSource.tableName", tableName);
          form.setValue("config.config.yAxes.0.dataSource.tableName", tableName);
          form.setValue("config.config.sizeAxis.dataSource.tableName", tableName);
          break;
        case "heatmap":
        case "contour":
          form.setValue("config.config.xAxis.dataSource.tableName", tableName);
          form.setValue("config.config.yAxis.dataSource.tableName", tableName);
          form.setValue("config.config.zAxis.dataSource.tableName", tableName);
          break;
        case "ternary":
          form.setValue("config.config.aAxis.dataSource.tableName", tableName);
          form.setValue("config.config.bAxis.dataSource.tableName", tableName);
          form.setValue("config.config.cAxis.dataSource.tableName", tableName);
          break;
        case "correlation-matrix": {
          // Correlation matrix uses variables array, set table name for each variable
          const currentVariables = form.getValues("config.config.variables");
          currentVariables.forEach((_: unknown, index: number) => {
            form.setValue(`config.config.variables.${index}.tableName`, tableName);
          });
          break;
        }
        case "parallel-coordinates": {
          // Parallel coordinates uses dimensions array, set table name for each dimension
          const currentDimensions = form.getValues("config.config.dimensions");
          currentDimensions.forEach((_: unknown, index: number) => {
            form.setValue(`config.config.dimensions.${index}.dataSource.tableName`, tableName);
          });
          break;
        }
        case "radar": {
          // Radar chart uses categoryAxis and series array, set table name for each
          form.setValue("config.config.categoryAxis.dataSource.tableName", tableName);
          const currentSeries = form.getValues("config.config.series");
          currentSeries.forEach((_: unknown, index: number) => {
            form.setValue(`config.config.series.${index}.dataSource.tableName`, tableName);
          });
          break;
        }
        case "pie":
          form.setValue("config.config.labelSource.tableName", tableName);
          form.setValue("config.config.valueSource.tableName", tableName);
          break;
        default:
          break;
      }
    }
  };

  // Column selection handler
  const handleColumnSelect = (columnType: string, columnName: string) => {
    // Handle data sources
    const currentDataSources = form.getValues("dataConfig.dataSources");
    const filteredSources = Array.isArray(currentDataSources)
      ? currentDataSources.filter(
          (s) => typeof s === "object" && "columnName" in s && s.columnName !== columnName,
        )
      : [];

    switch (columnType) {
      case "x":
        form.setValue("config.config.xAxis.dataSource.columnName", columnName);
        form.setValue("dataConfig.dataSources", [
          ...filteredSources,
          { tableName: selectedTableName ?? "", columnName },
        ]);
        break;
      case "y":
        form.setValue("config.config.yAxes.0.dataSource.columnName", columnName);
        form.setValue("dataConfig.dataSources", [
          ...filteredSources,
          { tableName: selectedTableName ?? "", columnName },
        ]);
        break;
      case "label":
        form.setValue("config.config.labelSource.columnName", columnName);
        form.setValue("dataConfig.dataSources", [
          ...filteredSources,
          { tableName: selectedTableName ?? "", columnName },
        ]);
        break;
      case "value":
        form.setValue("config.config.valueSource.columnName", columnName);
        form.setValue("dataConfig.dataSources", [
          ...filteredSources,
          { tableName: selectedTableName ?? "", columnName },
        ]);
        break;
      default:
        // Handle parallel coordinates dimensions (dimension-0, dimension-1, etc.)
        if (columnType.startsWith("dimension-") && selectedChartType === "parallel-coordinates") {
          const dimensionIndex = parseInt(columnType.split("-")[1] ?? "0", 10);
          form.setValue(
            `config.config.dimensions.${dimensionIndex}.dataSource.columnName`,
            columnName,
          );
          form.setValue("dataConfig.dataSources", [
            ...filteredSources,
            { tableName: selectedTableName ?? "", columnName },
          ]);
        }
        // Handle radar chart category axis
        if (columnType === "category" && selectedChartType === "radar") {
          form.setValue("config.config.categoryAxis.dataSource.columnName", columnName);
          form.setValue("dataConfig.dataSources", [
            ...filteredSources,
            { tableName: selectedTableName ?? "", columnName },
          ]);
        }
        // Handle radar chart series (series-0, series-1, etc.)
        if (columnType.startsWith("series-") && selectedChartType === "radar") {
          const seriesIndex = parseInt(columnType.split("-")[1] ?? "0", 10);
          form.setValue(`config.config.series.${seriesIndex}.dataSource.columnName`, columnName);
          form.setValue("dataConfig.dataSources", [
            ...filteredSources,
            { tableName: selectedTableName ?? "", columnName },
          ]);
        }
        // Handle general series column type for radar
        if (columnType === "series" && selectedChartType === "radar") {
          // Add to the first available series or create a new one
          const currentSeries = form.getValues("config.config.series");
          if (currentSeries.length > 0) {
            form.setValue(`config.config.series.0.dataSource.columnName`, columnName);
          }
          form.setValue("dataConfig.dataSources", [
            ...filteredSources,
            { tableName: selectedTableName ?? "", columnName },
          ]);
        }
        break;
    }
  };

  return (
    <div className="space-y-8">
      {/* Chart Type Selection */}
      <Card>
        <CardHeader>
          <CardTitle>{t("selectChartType")}</CardTitle>
          <CardDescription>{t("selectChartTypeHelp")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Group chart types by family for better UX */}
            {(["basic", "scientific", "3d", "statistical"] as ChartFamily[]).map((family) => {
              const chartsInFamily = CHART_TYPES.filter((chart) => chart.family === family);
              if (chartsInFamily.length === 0) return null;

              return (
                <div key={family} className="space-y-3">
                  <h3 className="text-muted-foreground text-sm font-medium">
                    {t(`chartFamilies.${family}`)}
                  </h3>

                  <RadioGroup
                    value={selectedChartType ?? ""}
                    onValueChange={(value: string) => onChartTypeSelect(value as ChartType)}
                    className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
                  >
                    {chartsInFamily.map((chartType) => (
                      <FormItem key={chartType.type}>
                        <FormControl>
                          <RadioGroupItem
                            value={chartType.type}
                            id={chartType.type}
                            className="peer sr-only"
                          />
                        </FormControl>
                        <FormLabel
                          htmlFor={chartType.type}
                          className="border-muted hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary flex flex-col items-center justify-between rounded-md border-2 bg-transparent p-4"
                        >
                          {chartType.icon}
                          <span className="mt-2">{t(chartType.labelKey)}</span>
                        </FormLabel>
                      </FormItem>
                    ))}
                  </RadioGroup>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Step 3: Data Configuration - only show when chart type is selected */}
      {selectedChartType && (
        <Card>
          <CardHeader>
            <CardTitle>{t("dataConfiguration")}</CardTitle>
            <CardDescription>{t("selectDataSource")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* Table Selection */}
              <FormField
                control={form.control}
                name="dataConfig.tableName"
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                render={({ field }: any) => (
                  <FormItem>
                    <FormLabel>{t("dataTable")}</FormLabel>
                    <Select
                      value={selectedTableName}
                      onValueChange={(value: string) => {
                        handleTableChange(value);
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                        field.onChange(value);
                      }}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t("selectTable")} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {tables.map((table) => (
                          <SelectItem key={table.name} value={table.name}>
                            {table.name} ({table.totalRows} rows)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Chart-specific configuration - render the appropriate configurator */}
              {selectedTableName && selectedTable && (
                <>
                  {selectedChartType === "line" && (
                    <LineChartConfigurator
                      form={form}
                      table={selectedTable}
                      onColumnSelect={(columnType: string, columnName: string) => {
                        handleColumnSelect(columnType, columnName);
                      }}
                    />
                  )}

                  {selectedChartType === "bar" && (
                    <BarChartConfigurator
                      form={form}
                      table={selectedTable}
                      onColumnSelect={(columnType: string, columnName: string) => {
                        handleColumnSelect(columnType, columnName);
                      }}
                    />
                  )}

                  {selectedChartType === "pie" && (
                    <PieChartConfigurator
                      form={form}
                      table={selectedTable}
                      onColumnSelect={(columnType: string, columnName: string) => {
                        handleColumnSelect(columnType, columnName);
                      }}
                    />
                  )}

                  {selectedChartType === "area" && (
                    <AreaChartConfigurator
                      form={form}
                      table={selectedTable}
                      onColumnSelect={(columnType: "x" | "y", columnName: string) => {
                        handleColumnSelect(columnType, columnName);
                      }}
                    />
                  )}

                  {selectedChartType === "scatter" && (
                    <ScatterChartConfigurator
                      form={form}
                      table={selectedTable}
                      onColumnSelect={(columnType: string, columnName: string) => {
                        handleColumnSelect(columnType, columnName);
                      }}
                    />
                  )}

                  {selectedChartType === "dot-plot" && (
                    <DotPlotConfigurator
                      form={form}
                      table={selectedTable}
                      onColumnSelect={(columnType: string, columnName: string) => {
                        handleColumnSelect(columnType, columnName);
                      }}
                    />
                  )}

                  {selectedChartType === "bubble" && (
                    <BubbleChartConfigurator
                      form={form}
                      table={selectedTable}
                      onColumnSelect={(columnType: "x" | "y" | "size", columnName: string) => {
                        handleColumnSelect(columnType, columnName);
                      }}
                    />
                  )}

                  {selectedChartType === "lollipop" && (
                    <LollipopChartConfigurator
                      form={form}
                      table={selectedTable}
                      onColumnSelect={(columnType: string, columnName: string) => {
                        handleColumnSelect(columnType, columnName);
                      }}
                    />
                  )}

                  {selectedChartType === "heatmap" && (
                    <HeatmapChartConfigurator
                      form={form}
                      table={selectedTable}
                      onColumnSelect={(columnType: "x" | "y" | "z", columnName: string) => {
                        handleColumnSelect(columnType, columnName);
                      }}
                    />
                  )}

                  {selectedChartType === "contour" && (
                    <ContourChartConfigurator
                      form={form}
                      table={selectedTable}
                      onColumnSelect={(columnType: "x" | "y" | "z", columnName: string) => {
                        handleColumnSelect(columnType, columnName);
                      }}
                    />
                  )}

                  {selectedChartType === "ternary" && (
                    <TernaryChartConfigurator
                      form={form}
                      table={selectedTable}
                      onColumnSelect={(columnType: "a" | "b" | "c", columnName: string) => {
                        handleColumnSelect(columnType, columnName);
                      }}
                    />
                  )}

                  {selectedChartType === "log-plot" && (
                    <LogPlotChartConfigurator
                      form={form}
                      table={selectedTable}
                      onColumnSelect={(columnType: "x" | "y", columnName: string) => {
                        handleColumnSelect(columnType, columnName);
                      }}
                    />
                  )}

                  {selectedChartType === "correlation-matrix" && (
                    <CorrelationMatrixChartConfigurator
                      form={form}
                      table={selectedTable}
                      onColumnSelect={(_columnType: string, _columnName: string) => {
                        // Correlation matrix uses multiple variables, no single column selection needed
                      }}
                    />
                  )}

                  {selectedChartType === "parallel-coordinates" && (
                    <ParallelCoordinatesChartConfigurator
                      form={form}
                      table={selectedTable}
                      onColumnSelect={(columnType: string, columnName: string) => {
                        handleColumnSelect(columnType, columnName);
                      }}
                    />
                  )}

                  {selectedChartType === "radar" && (
                    <RadarChartConfigurator
                      form={form}
                      table={selectedTable}
                      onColumnSelect={(columnType: string, columnName: string) => {
                        handleColumnSelect(columnType, columnName);
                      }}
                    />
                  )}
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
