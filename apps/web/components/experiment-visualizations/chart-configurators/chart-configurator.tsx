"use client";

import { LineChart, ScatterChart } from "lucide-react";
import { useState } from "react";
import type { ReactNode } from "react";
import type { UseFormReturn } from "react-hook-form";
import { SampleTable } from "~/hooks/experiment/useExperimentData/useExperimentData";

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

// Import role-based configurators
import LineChartConfigurator from "./basic/line-chart/line-chart-configurator";
import ScatterChartConfigurator from "./basic/scatter-chart/scatter-chart-configurator";
import { ChartFormValues } from "./chart-configurator-util";

// Define chart types grouped by family for UX purposes - labels will be translated in component
const CHART_TYPES_CONFIG: {
  type: "line" | "scatter";
  family: "basic";
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
];

interface ChartConfiguratorProps {
  form: UseFormReturn<ChartFormValues>;
  tables: SampleTable[];
  selectedChartType: "line" | "scatter" | null;
  onChartTypeSelect: (chartType: "line" | "scatter") => void;
}

// Component to render the appropriate chart configurator based on chart type
function ChartTypeConfigurator({
  chartType,
  form,
  table,
  onColumnSelect,
}: {
  chartType: "line" | "scatter";
  form: UseFormReturn<ChartFormValues>;
  table: SampleTable;
  onColumnSelect: (columnType: string, columnName: string) => void;
}) {
  // Common props for chart configurators
  const commonProps = {
    form,
    table,
    onColumnSelect,
  };

  // Handle chart type selection to return the appropriate configurator
  switch (chartType) {
    case "line":
      return <LineChartConfigurator {...commonProps} />;
    case "scatter":
      return <ScatterChartConfigurator {...commonProps} />;
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
            {/* Basic chart types */}
            <div className="space-y-3">
              <h3 className="text-muted-foreground text-sm font-medium">
                {t("chartFamilies.basic")}
              </h3>

              <RadioGroup
                value={selectedChartType ?? ""}
                onValueChange={(value: string) => onChartTypeSelect(value as "line" | "scatter")}
                className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
              >
                {CHART_TYPES.map((chartType) => (
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
                      className={`group relative flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 bg-white p-6 shadow-sm transition-all duration-200 hover:border-gray-300 hover:shadow-md ${
                        selectedChartType === chartType.type
                          ? "border-primary bg-primary/5 shadow-md"
                          : "border-gray-200"
                      }`}
                    >
                      <div
                        className={`mb-3 transition-colors duration-200 group-hover:text-gray-700 ${
                          selectedChartType === chartType.type ? "text-gray-700" : "text-gray-600"
                        }`}
                      >
                        {chartType.icon}
                      </div>
                      <span
                        className={`text-center text-sm font-medium transition-colors duration-200 ${
                          selectedChartType === chartType.type
                            ? "text-gray-900"
                            : "text-gray-700 group-hover:text-gray-900"
                        }`}
                      >
                        {t(chartType.labelKey)}
                      </span>
                    </FormLabel>
                  </FormItem>
                ))}
              </RadioGroup>
            </div>
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
