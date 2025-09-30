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

import AreaChartConfigurator from "./basic/area-chart/area-chart-configurator";
import BarChartConfigurator from "./basic/bar-chart/bar-chart-configurator";
import BubbleChartConfigurator from "./basic/bubble-chart/bubble-chart-configurator";
import DotPlotConfigurator from "./basic/dot-plot/dot-plot-configurator";
// Import role-based configurators
import LineChartConfigurator from "./basic/line-chart/line-chart-configurator";
import LollipopChartConfigurator from "./basic/lollipop-chart/lollipop-chart-configurator";
import PieChartConfigurator from "./basic/pie-chart/pie-chart-configurator";
import ScatterChartConfigurator from "./basic/scatter-chart/scatter-chart-configurator";
// Import specific chart configurators and types
import ContourChartConfigurator from "./scientific/contour-chart/contour-chart-configurator";
import CorrelationMatrixChartConfigurator from "./scientific/correlation-matrix-chart/correlation-matrix-chart-configurator";
import HeatmapChartConfigurator from "./scientific/heatmap-chart/heatmap-chart-configurator";
import LogPlotChartConfigurator from "./scientific/log-plot/log-plot-chart-configurator";
import ParallelCoordinatesChartConfigurator from "./scientific/parallel-coordinates-chart/parallel-coordinates-chart-configurator";
import RadarChartConfigurator from "./scientific/radar-chart/radar-chart-configurator";
import TernaryChartConfigurator from "./scientific/ternary-chart/ternary-chart-configurator";
import BoxPlotConfigurator from "./statistical/box-plot/box-plot-configurator";
import HistogramChartConfigurator from "./statistical/histogram/histogram-chart-configurator";
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
  // Common props for old chart configurators (single table)
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
    form.setValue("dataConfig.tableName", tableName);

    // Update all data sources with the new table name
    const currentDataSources = form.getValues("dataConfig.dataSources");
    const updatedDataSources = currentDataSources.map((ds) => ({
      ...ds,
      tableName,
    }));
    form.setValue("dataConfig.dataSources", updatedDataSources);
  };

  /**
   * Update data sources when a column is selected - role-based approach
   */
  const handleColumnSelect = (columnType: string, columnName: string) => {
    const currentDataSources = form.getValues("dataConfig.dataSources");
    const tableName = form.getValues("dataConfig.tableName");

    // Parse role and series index from columnType (e.g., "y-0" -> role="y", index=0)
    const [role, indexStr] = columnType.split("-");
    const seriesIndex = indexStr ? parseInt(indexStr, 10) : undefined;

    // Find existing data source or create new one
    let targetIndex = -1;
    if (seriesIndex !== undefined) {
      // For indexed roles, find the Nth occurrence of this role
      const sameRoleItems = currentDataSources.filter((ds) => ds.role === role);
      if (sameRoleItems.length > seriesIndex) {
        targetIndex = currentDataSources.findIndex(
          (ds, idx) =>
            ds.role === role &&
            currentDataSources.slice(0, idx + 1).filter((d) => d.role === role).length ===
              seriesIndex + 1,
        );
      }
    } else {
      // For non-indexed roles, find first occurrence
      targetIndex = currentDataSources.findIndex((ds) => ds.role === role);
    }

    const updatedDataSources = [...currentDataSources];
    if (targetIndex !== -1) {
      // Update existing
      updatedDataSources[targetIndex] = {
        ...updatedDataSources[targetIndex],
        columnName,
        tableName,
      };
    } else {
      // Add new
      updatedDataSources.push({ tableName, columnName, role, alias: "" });
    }

    form.setValue("dataConfig.dataSources", updatedDataSources);
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
 * In the role-based approach, we simply return the dataSources array directly
 */
export function collectAllChartDataSources(form: UseFormReturn<ChartFormValues>): {
  tableName: string;
  columnName: string;
  alias?: string;
  role: string;
}[] {
  // Get the data sources directly from the form
  const dataSources = form.getValues("dataConfig.dataSources");

  // Filter out empty/invalid data sources and ensure role is defined
  const validDataSources = dataSources
    .filter((source) => source.columnName && source.columnName.trim() !== "")
    .filter((source) => source.role && source.role.trim() !== "") as {
    tableName: string;
    columnName: string;
    alias?: string;
    role: string;
  }[];

  console.log("Collected data sources:", validDataSources);
  return validDataSources;
}
