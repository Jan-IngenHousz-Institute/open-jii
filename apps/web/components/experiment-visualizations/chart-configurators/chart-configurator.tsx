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
  BubblesIcon,
  TriangleDashed,
  Radar,
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
  BoxPlotConfigurator,
  HistogramChartConfigurator,
} from "./index";
import type { ChartFormValues, SampleTable } from "./types";

// Define chart types grouped by family for UX purposes - labels will be translated in component
const CHART_TYPES_CONFIG: {
  type: ChartType;
  family: ChartFamily;
  labelKey: string;
  icon: ReactNode;
  disabled?: boolean;
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
  {
    type: "bubble",
    family: "basic",
    labelKey: "chartTypes.bubble",
    icon: <BubblesIcon className="h-5 w-5" />,
  },
  {
    type: "lollipop",
    family: "basic",
    labelKey: "chartTypes.lollipop",
    icon: <BarChart className="h-5 w-5" />,
  },

  // Statistical Charts
  {
    type: "box-plot",
    family: "statistical",
    labelKey: "chartTypes.boxPlot",
    icon: <BarChart3 className="h-5 w-5" />,
  },
  {
    type: "histogram",
    family: "statistical",
    labelKey: "chartTypes.histogram",
    icon: <BarChart3 className="h-5 w-5" />,
  },
  // Disabled statistical charts
  {
    type: "violin-plot",
    family: "statistical",
    labelKey: "chartTypes.violin-plot",
    icon: <BarChart3 className="h-5 w-5" />,
    disabled: true,
  },
  {
    type: "error-bar",
    family: "statistical",
    labelKey: "chartTypes.error-bar",
    icon: <BarChart3 className="h-5 w-5" />,
    disabled: true,
  },
  {
    type: "density-plot",
    family: "statistical",
    labelKey: "chartTypes.density-plot",
    icon: <Activity className="h-5 w-5" />,
    disabled: true,
  },
  {
    type: "ridge-plot",
    family: "statistical",
    labelKey: "chartTypes.ridge-plot",
    icon: <Layers className="h-5 w-5" />,
    disabled: true,
  },
  {
    type: "histogram-2d",
    family: "statistical",
    labelKey: "chartTypes.histogram-2d",
    icon: <Layers className="h-5 w-5" />,
    disabled: true,
  },
  {
    type: "scatter2density",
    family: "statistical",
    labelKey: "chartTypes.scatter2density",
    icon: <ScatterChart className="h-5 w-5" />,
    disabled: true,
  },
  {
    type: "spc-control-chart",
    family: "statistical",
    labelKey: "chartTypes.spc-control-chart",
    icon: <LineChart className="h-5 w-5" />,
    disabled: true,
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
    icon: <TriangleDashed className="h-5 w-5" />,
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
    icon: <Radar className="h-5 w-5" />,
  },
  {
    type: "polar",
    family: "scientific",
    labelKey: "chartTypes.polar",
    icon: <Activity className="h-5 w-5" />,
    disabled: true,
  },
  {
    type: "wind-rose",
    family: "scientific",
    labelKey: "chartTypes.wind-rose",
    icon: <Activity className="h-5 w-5" />,
    disabled: true,
  },
  // Disabled scientific charts
  {
    type: "carpet",
    family: "scientific",
    labelKey: "chartTypes.carpet",
    icon: <Layers className="h-5 w-5" />,
    disabled: true,
  },
  {
    type: "alluvial",
    family: "scientific",
    labelKey: "chartTypes.alluvial",
    icon: <Activity className="h-5 w-5" />,
    disabled: true,
  },
];

interface ChartConfiguratorProps {
  form: UseFormReturn<ChartFormValues>;
  tables: SampleTable[];
  selectedChartType: ChartType | null;
  onChartTypeSelect: (chartType: ChartType) => void;
}

// Component to render the appropriate chart configurator based on chart type
function ChartTypeConfigurator({
  chartType,
  form,
  table,
  onColumnSelect,
}: {
  chartType: ChartType;
  form: UseFormReturn<ChartFormValues>;
  table: SampleTable;
  onColumnSelect: (columnType: string, columnName: string) => void;
}) {
  // Common props for all chart configurators
  const commonProps = {
    form,
    table,
    onColumnSelect,
  };

  // Handle chart type selection to return the appropriate configurator
  switch (chartType) {
    case "line":
      return <LineChartConfigurator {...commonProps} />;
    case "bar":
      return <BarChartConfigurator {...commonProps} />;
    case "pie":
      return <PieChartConfigurator {...commonProps} />;
    case "area":
      return <AreaChartConfigurator {...commonProps} />;
    case "scatter":
      return <ScatterChartConfigurator {...commonProps} />;
    case "dot-plot":
      return <DotPlotConfigurator {...commonProps} />;
    case "bubble":
      return <BubbleChartConfigurator {...commonProps} />;
    case "lollipop":
      return <LollipopChartConfigurator {...commonProps} />;
    case "box-plot":
      return <BoxPlotConfigurator {...commonProps} />;
    case "heatmap":
      return <HeatmapChartConfigurator {...commonProps} />;
    case "contour":
      return <ContourChartConfigurator {...commonProps} />;
    case "ternary":
      return <TernaryChartConfigurator {...commonProps} />;
    case "log-plot":
      return <LogPlotChartConfigurator {...commonProps} />;
    case "correlation-matrix":
      return <CorrelationMatrixChartConfigurator {...commonProps} />;
    case "parallel-coordinates":
      return <ParallelCoordinatesChartConfigurator {...commonProps} />;
    case "radar":
      return <RadarChartConfigurator {...commonProps} />;
    case "histogram":
      return <HistogramChartConfigurator {...commonProps} />;
    // Disabled chart types
    case "violin-plot":
    case "error-bar":
    case "density-plot":
    case "ridge-plot":
    case "histogram-2d":
    case "scatter2density":
    case "spc-control-chart":
    case "polar":
    case "wind-rose":
    case "carpet":
    case "alluvial":
    default:
      return null;
  }
}

export default function ChartConfigurator({
  form,
  tables,
  selectedChartType,
  onChartTypeSelect,
}: ChartConfiguratorProps) {
  const { t } = useTranslation("experimentVisualizations");
  const { t: tCommon } = useTranslation("common");
  const [selectedTableName, setSelectedTableName] = useState<string | undefined>(
    form.getValues("dataConfig.tableName") || (tables.length > 0 ? tables[0].name : undefined),
  );

  // Translate chart types with current locale
  const CHART_TYPES = CHART_TYPES_CONFIG.map((chartConfig) => ({
    ...chartConfig,
    label: t(chartConfig.labelKey),
  }));

  // Find the selected table
  const selectedTable = tables.find((table) => table.name === selectedTableName);

  /**
   * Update form values when the selected table changes
   */
  const handleTableChange = (tableName: string) => {
    setSelectedTableName(tableName);

    // Update dataConfig
    form.setValue("dataConfig.tableName", tableName);

    // Only proceed if a chart type is selected
    if (!selectedChartType) return;

    // Helper functions for common chart configurations
    const updateXYChartTables = (tableName: string) => {
      form.setValue("config.config.xAxis.dataSource.tableName", tableName);

      // Update all Y-axes with the new table name
      const yAxes = form.getValues("config.config.yAxes");
      if (Array.isArray(yAxes)) {
        yAxes.forEach((_, index) => {
          form.setValue(`config.config.yAxes.${index}.dataSource.tableName`, tableName);
        });
      } else {
        // Fallback to just updating the first one
        form.setValue("config.config.yAxes.0.dataSource.tableName", tableName);
      }
    };

    const updateXYCChartTables = (tableName: string) => {
      form.setValue("config.config.xAxis.dataSource.tableName", tableName);

      // Update all Y-axes with the new table name
      const yAxes = form.getValues("config.config.yAxes");
      if (Array.isArray(yAxes)) {
        yAxes.forEach((_, index) => {
          form.setValue(`config.config.yAxes.${index}.dataSource.tableName`, tableName);
        });
      } else {
        // Fallback to just updating the first one
        form.setValue("config.config.yAxes.0.dataSource.tableName", tableName);
      }

      form.setValue("config.config.colorAxis.dataSource.tableName", tableName);
    };

    const updateXYZChartTables = (tableName: string) => {
      form.setValue("config.config.xAxis.dataSource.tableName", tableName);
      form.setValue("config.config.yAxis.dataSource.tableName", tableName);
      form.setValue("config.config.zAxis.dataSource.tableName", tableName);
    };

    // Update table names based on chart type
    switch (selectedChartType) {
      // Basic xy charts with similar structure
      case "line":
      case "bar":
      case "area":
      case "dot-plot":
      case "lollipop":
      case "box-plot":
      case "log-plot":
        updateXYChartTables(tableName);
        break;

      case "scatter":
        updateXYCChartTables(tableName);
        break;

      // Charts with additional axes
      case "bubble":
        updateXYChartTables(tableName);
        form.setValue("config.config.sizeAxis.dataSource.tableName", tableName);
        break;

      // Charts with z-axis
      case "heatmap":
      case "contour":
        updateXYZChartTables(tableName);
        break;

      case "histogram":
        form.setValue("config.config.series.0.dataSource.tableName", tableName);
        break;

      // Special chart types
      case "ternary":
        form.setValue("config.config.aAxis.dataSource.tableName", tableName);
        form.setValue("config.config.bAxis.dataSource.tableName", tableName);
        form.setValue("config.config.cAxis.dataSource.tableName", tableName);
        break;

      case "correlation-matrix": {
        // Update variables array
        const currentVariables = form.getValues("config.config.variables");
        if (Array.isArray(currentVariables)) {
          currentVariables.forEach((_: unknown, index: number) => {
            form.setValue(`config.config.variables.${index}.tableName`, tableName);
          });
        }
        break;
      }

      case "parallel-coordinates": {
        // Update dimensions array
        const currentDimensions = form.getValues("config.config.dimensions");
        if (Array.isArray(currentDimensions)) {
          currentDimensions.forEach((_: unknown, index: number) => {
            form.setValue(`config.config.dimensions.${index}.dataSource.tableName`, tableName);
          });
        }
        break;
      }

      case "radar": {
        // Update category axis and series array
        form.setValue("config.config.categoryAxis.dataSource.tableName", tableName);
        const currentSeries = form.getValues("config.config.series");
        if (Array.isArray(currentSeries)) {
          currentSeries.forEach((_: unknown, index: number) => {
            form.setValue(`config.config.series.${index}.dataSource.tableName`, tableName);
          });
        }
        break;
      }

      case "pie":
        form.setValue("config.config.labelSource.tableName", tableName);
        form.setValue("config.config.valueSource.tableName", tableName);
        break;

      // No special handling for disabled chart types or unknown types
      default:
        console.debug(`No table update handler for chart type: ${selectedChartType}`);
        break;
    }
  };

  /**
   * Update data sources and form values when a column is selected
   */
  const handleColumnSelect = (columnType: string, columnName: string) => {
    // Helper function to update form values and data sources
    const updateFormValues = (configPath: string) => {
      console.log(`Updating column ${columnType} with value ${columnName} at path ${configPath}`);
      // Use type assertion for the path - this is safe as we're just setting a string value
      form.setValue(configPath as keyof ChartFormValues, columnName);

      // After setting, collect all data sources using our exported function
      setTimeout(() => {
        const sources = collectAllChartDataSources(form);
        console.log("Updated dataSources:", sources);
        form.setValue("dataConfig.dataSources", sources);
      }, 0);
    };

    // Determine the correct path to update based on column type
    let configPath: string;

    // Handle column types with indexed components (e.g., "y-0", "series-2", etc.)
    if (columnType.includes("-")) {
      const [baseType, indexStr] = columnType.split("-");
      const index = parseInt(indexStr, 10);

      switch (baseType) {
        case "y":
          configPath = `config.config.yAxes.${index}.dataSource.columnName`;
          break;
        case "series":
          configPath = `config.config.series.${index}.dataSource.columnName`;
          break;
        case "dimension":
          configPath = `config.config.dimensions.${index}.dataSource.columnName`;
          break;
        default:
          console.warn(`Unhandled indexed column type: ${columnType}`);
          return; // Exit early if no match
      }
    } else {
      // Handle simple column types
      switch (columnType) {
        case "x":
          configPath = "config.config.xAxis.dataSource.columnName";
          break;
        case "y": // Default to first Y-axis for backwards compatibility
          configPath = "config.config.yAxes.0.dataSource.columnName";
          break;
        case "color":
          configPath = "config.config.colorAxis.dataSource.columnName";
          break;
        case "size":
          configPath = "config.config.sizeAxis.dataSource.columnName";
          break;
        case "label":
          configPath = "config.config.labelSource.columnName";
          break;
        case "value":
          configPath = "config.config.valueSource.columnName";
          break;
        case "series":
          // Handle based on chart type for better specificity
          if (selectedChartType === "radar") {
            configPath = "config.config.series.0.dataSource.columnName";
          } else {
            configPath = "config.config.series.0.dataSource.columnName";
          }
          break;
        case "category":
          configPath = "config.config.categoryAxis.dataSource.columnName";
          break;
        default:
          console.warn(`Unhandled column type: ${columnType}`);
          return; // Exit early if no match
      }
    }

    // Apply the update if we found a valid path
    if (configPath) {
      updateFormValues(configPath);
    }
  };

  return (
    <div className="space-y-8">
      {/* Chart Type Selection */}
      <Card>
        <CardHeader>
          <CardTitle>{t("configuration.selectChartType")}</CardTitle>
          <CardDescription>{t("configuration.selectChartTypeDescription")}</CardDescription>
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
                            disabled={chartType.disabled}
                          />
                        </FormControl>
                        <FormLabel
                          htmlFor={chartType.type}
                          className={`group relative flex flex-col items-center justify-center rounded-xl border-2 bg-white p-6 shadow-sm transition-all duration-200 ${
                            chartType.disabled
                              ? "cursor-not-allowed opacity-50 grayscale"
                              : "cursor-pointer hover:border-gray-300 hover:shadow-md"
                          } ${
                            selectedChartType === chartType.type
                              ? "border-primary bg-primary/5 shadow-md"
                              : "border-gray-200"
                          }`}
                        >
                          <div
                            className={`mb-3 transition-colors duration-200 group-hover:text-gray-700 ${
                              selectedChartType === chartType.type
                                ? "text-gray-700"
                                : "text-gray-600"
                            }`}
                          >
                            {chartType.icon}
                          </div>
                          <span
                            className={`text-center text-sm font-medium transition-colors duration-200 ${
                              chartType.disabled
                                ? "text-gray-500"
                                : selectedChartType === chartType.type
                                  ? "text-gray-900"
                                  : "text-gray-700 group-hover:text-gray-900"
                            }`}
                          >
                            {t(chartType.labelKey)}
                          </span>
                          {chartType.disabled && (
                            <div className="absolute right-2 top-2">
                              <span className="rounded-full bg-yellow-100 px-2 py-1 text-xs text-yellow-800">
                                {tCommon("common.comingSoon")}
                              </span>
                            </div>
                          )}
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
              {selectedTable && (
                <ChartTypeConfigurator
                  chartType={selectedChartType}
                  form={form}
                  table={selectedTable}
                  onColumnSelect={handleColumnSelect}
                />
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/**
 * Helper function to collect all data sources for a chart form
 * This is exported for use in both new and edit forms to ensure consistent collection
 */
export function collectAllChartDataSources(form: UseFormReturn<ChartFormValues>): {
  tableName: string;
  columnName: string;
  alias?: string;
}[] {
  const sources: {
    tableName: string;
    columnName: string;
    alias?: string;
  }[] = [];
  // Get the table name or empty string if undefined
  const tableName = String(form.getValues("dataConfig.tableName") || "");

  // Helper to push if value exists
  const pushIf = (col: string | undefined, alias?: string) => {
    if (col && col.trim() !== "") {
      sources.push({ tableName, columnName: col, alias });
    }
  };

  const chartType = form.getValues("chartType");

  switch (chartType) {
    case "line":
    case "bar":
    case "area":
    case "dot-plot":
    case "lollipop":
    case "box-plot":
    case "log-plot": {
      // Add X-Axis
      pushIf(form.getValues("config.config.xAxis.dataSource.columnName"));

      // Add all Y-Axes with their aliases
      const yAxes = form.getValues("config.config.yAxes");
      if (Array.isArray(yAxes)) {
        yAxes.forEach((axis, i) => {
          pushIf(
            form.getValues(`config.config.yAxes.${i}.dataSource.columnName`),
            form.getValues(`config.config.yAxes.${i}.dataSource.alias`),
          );
        });
      }
      break;
    }

    case "scatter": {
      // Add X-Axis
      pushIf(form.getValues("config.config.xAxis.dataSource.columnName"));

      // Add all Y-Axes with their aliases
      const yAxes = form.getValues("config.config.yAxes");
      if (Array.isArray(yAxes)) {
        yAxes.forEach((axis, i) => {
          pushIf(
            form.getValues(`config.config.yAxes.${i}.dataSource.columnName`),
            form.getValues(`config.config.yAxes.${i}.dataSource.alias`),
          );
        });
      }

      // Add color axis
      pushIf(form.getValues("config.config.colorAxis.dataSource.columnName"));
      break;
    }

    case "bubble": {
      // Add X-Axis
      pushIf(form.getValues("config.config.xAxis.dataSource.columnName"));

      // Add all Y-Axes with their aliases
      const yAxes = form.getValues("config.config.yAxes");
      if (Array.isArray(yAxes)) {
        yAxes.forEach((axis, i) => {
          pushIf(
            form.getValues(`config.config.yAxes.${i}.dataSource.columnName`),
            form.getValues(`config.config.yAxes.${i}.dataSource.alias`),
          );
        });
      }

      // Add size axis
      pushIf(form.getValues("config.config.sizeAxis.dataSource.columnName"));
      break;
    }

    // Add all other chart types...
    default: {
      console.log("No specific collection function for chart type:", chartType);
      // Try to collect from existing dataSources as fallback
      const existingSources = form.getValues("dataConfig.dataSources");
      if (Array.isArray(existingSources)) {
        existingSources.forEach((source) => {
          if (source.columnName && source.columnName.trim() !== "") {
            sources.push(source);
          }
        });
      }
      break;
    }
  }

  console.log("Collected data sources:", sources);
  return sources;
}
