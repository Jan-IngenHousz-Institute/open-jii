"use client";

import { useExperimentData } from "@/hooks/experiment/useExperimentData/useExperimentData";
import type { ExperimentTableMetadata } from "@/hooks/experiment/useExperimentTables/useExperimentTables";
import { useState } from "react";
import type { UseFormReturn } from "react-hook-form";

import { zCreateExperimentVisualizationBody, isValidAxisSource } from "@repo/api";
import type { DataColumn } from "@repo/api";
import { useTranslation } from "@repo/i18n";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  WizardStepButtons,
} from "@repo/ui/components";
import type { WizardStepProps } from "@repo/ui/components";

import type { ChartFormValues } from "../chart-configurators/chart-configurator-util";
import {
  LineChartDataConfigurator,
  ScatterChartDataConfigurator,
} from "../chart-configurators/data";
import { ChartPreviewModal } from "../chart-preview/chart-preview-modal";

// Step 3: Data Source Selection and Configuration
export const dataSourceSchema = zCreateExperimentVisualizationBody.pick({
  dataConfig: true,
  config: true,
});

// Component to render the appropriate chart configurator based on chart type
function ChartTypeConfigurator({
  chartType,
  form,
  columns,
}: {
  chartType: "line" | "scatter";
  form: UseFormReturn<ChartFormValues>;
  columns: DataColumn[];
}) {
  const commonProps = {
    form,
    columns,
  };

  switch (chartType) {
    case "line":
      return <LineChartDataConfigurator {...commonProps} />;
    case "scatter":
      return <ScatterChartDataConfigurator {...commonProps} />;
    default:
      return null;
  }
}

interface DataSourceStepProps extends WizardStepProps<ChartFormValues> {
  tables: ExperimentTableMetadata[];
  experimentId: string;
  isPreviewOpen: boolean;
  onPreviewClose: () => void;
}

export function DataSourceStep({
  form,
  tables,
  experimentId,
  onNext,
  onPrevious,
  stepIndex,
  totalSteps,
  isSubmitting,
  isPreviewOpen,
  onPreviewClose,
}: DataSourceStepProps) {
  const { t } = useTranslation("experimentVisualizations");
  const { t: tCommon } = useTranslation("common");

  const selectedChartType = form.getValues("chartType") as "line" | "scatter";
  const defaultTableName = form.getValues("dataConfig.tableName");

  const [selectedTableName, setSelectedTableName] = useState<string>(defaultTableName);

  // Fetch data for the selected table to get column information
  const { tableMetadata, isLoading } = useExperimentData({
    experimentId,
    page: 1,
    pageSize: 1, // Just fetch 1 row to get column metadata
    tableName: selectedTableName,
    enabled: !!selectedTableName,
  });

  // Extract columns from the fetched table metadata and filter to only valid axis sources
  const columns = (tableMetadata?.rawColumns ?? []).filter((col) =>
    isValidAxisSource(col.type_text),
  );

  // Handle table change
  const handleTableChange = (tableName: string) => {
    setSelectedTableName(tableName);
    form.setValue("dataConfig.tableName", tableName);

    // Reset all data sources when table changes - clear column selections
    // but keep the structure (roles) intact
    const currentDataSources = form.getValues("dataConfig.dataSources");
    const resetDataSources = currentDataSources.map(
      (ds: { tableName: string; columnName: string; role: string; alias?: string }) => ({
        tableName,
        columnName: "",
        role: ds.role,
        alias: "",
      }),
    );

    form.setValue("dataConfig.dataSources", resetDataSources);
    form.setValue("config.xAxisTitle", "");
    form.setValue("config.yAxisTitle", "");
  };

  return (
    <div className="space-y-8">
      {/* Data Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>{t("wizard.steps.dataSource.title")}</CardTitle>
          <CardDescription>{t("wizard.steps.dataSource.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Table Selection */}
            <div className="max-w-sm">
              <FormField
                control={form.control}
                name="dataConfig.tableName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("form.dataSource.title")}</FormLabel>
                    <Select
                      value={selectedTableName}
                      onValueChange={(value: string) => {
                        handleTableChange(value);
                        field.onChange(value);
                      }}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t("form.dataSource.selectTable")} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {tables.length === 0 ? (
                          <div className="text-muted-foreground px-2 py-1.5 text-sm">
                            {t("form.dataSource.noTablesAvailable")}
                          </div>
                        ) : (
                          tables.map((table) => (
                            <SelectItem key={table.name} value={table.name}>
                              {t("form.dataSource.tableInfo", {
                                name: table.displayName,
                              })}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    <FormDescription>{t("form.dataSource.help")}</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Loading indicator while fetching columns */}
            {selectedTableName && isLoading && (
              <div className="flex items-center justify-center py-8">
                <div className="text-muted-foreground text-sm">
                  {t("form.dataSource.loadingColumns")}
                </div>
              </div>
            )}

            {/* Chart-specific configuration */}
            {selectedTableName && !isLoading && columns.length > 0 && (
              <ChartTypeConfigurator chartType={selectedChartType} form={form} columns={columns} />
            )}
          </div>
        </CardContent>
      </Card>

      {/* Chart Preview */}
      {selectedTableName && !isLoading && columns.length > 0 && (
        <div className="flex justify-center">
          <ChartPreviewModal
            form={form}
            experimentId={experimentId}
            isOpen={isPreviewOpen}
            onOpenChange={(open) => !open && onPreviewClose()}
          />
        </div>
      )}

      <WizardStepButtons
        onNext={onNext}
        onPrevious={onPrevious}
        stepIndex={stepIndex}
        totalSteps={totalSteps}
        isSubmitting={isSubmitting}
        nextLabel={tCommon("experiments.next")}
        previousLabel={tCommon("experiments.back")}
        submitLabel={tCommon("common.create")}
      />
    </div>
  );
}
