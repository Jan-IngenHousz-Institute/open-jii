"use client";

import type {
  ExperimentTableMetadata,
  ExperimentTableWithColumns,
} from "@/hooks/experiment/useExperimentTables/useExperimentTables";
import { useState } from "react";
import type { UseFormReturn } from "react-hook-form";

import { zCreateExperimentVisualizationBody } from "@repo/api";
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
  table,
}: {
  chartType: "line" | "scatter";
  form: UseFormReturn<ChartFormValues>;
  table: ExperimentTableWithColumns;
}) {
  const commonProps = {
    form,
    table,
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

  // Get the chart type from the form (set in previous step)
  const chartType = form.getValues("chartType") as "line" | "scatter";
  const [selectedTableName, setSelectedTableName] = useState<string | undefined>(
    form.getValues("dataConfig.tableName") || (tables.length > 0 ? tables[0].name : undefined),
  );

  // Find the selected table metadata
  const selectedTableMetadata = tables.find((table) => table.name === selectedTableName);

  // Use the table with columns directly from the tables prop
  const selectedTable: ExperimentTableWithColumns | undefined = selectedTableMetadata?.columns
    ? (selectedTableMetadata as ExperimentTableWithColumns)
    : undefined;

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
                        {tables.map((table) => (
                          <SelectItem key={table.name} value={table.name}>
                            {t("form.dataSource.tableInfo", {
                              name: table.displayName,
                            })}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>{t("form.dataSource.help")}</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Chart-specific configuration */}
            {selectedTable && (
              <ChartTypeConfigurator chartType={chartType} form={form} table={selectedTable} />
            )}
          </div>
        </CardContent>
      </Card>

      {/* Chart Preview */}
      {selectedTable && (
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
