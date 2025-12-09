"use client";

import type { ExperimentTableWithColumns } from "@/hooks/experiment/useExperimentTables/useExperimentTables";
import { useFieldArray } from "react-hook-form";
import type { UseFormReturn } from "react-hook-form";

import type { ChartFormValues } from "../../../chart-configurator-util";
import ColorDimensionConfiguration from "../../shared/color-dimension-configuration";
import XAxisConfiguration from "../../shared/x-axis-configuration";
import YAxisConfiguration from "../../shared/y-axis-configuration";

interface ScatterChartDataConfiguratorProps {
  form: UseFormReturn<ChartFormValues>;
  table: ExperimentTableWithColumns;
}

export default function ScatterChartDataConfigurator({
  form,
  table,
}: ScatterChartDataConfiguratorProps) {
  const {
    fields: dataSourceFields,
    append: appendDataSource,
    remove: removeDataSource,
  } = useFieldArray({
    control: form.control,
    name: "dataConfig.dataSources",
  });

  // Get data sources by role
  const xAxisDataSources = dataSourceFields
    .map((field, index) => ({ field, index }))
    .filter(({ field }) => field.role === "x");
  const yAxisDataSources = dataSourceFields
    .map((field, index) => ({ field, index }))
    .filter(({ field }) => field.role === "y");
  const colorAxisDataSources = dataSourceFields
    .map((field, index) => ({ field, index }))
    .filter(({ field }) => field.role === "color");

  const addYAxisSeries = () => {
    const tableName = form.watch("dataConfig.tableName");
    appendDataSource({
      tableName: tableName,
      columnName: "",
      role: "y",
      alias: "",
    });
  };

  return (
    <div className="space-y-6">
      {/* X-Axis Configuration */}
      <XAxisConfiguration form={form} table={table} xAxisDataSources={xAxisDataSources} />

      {/* Y-Axes Series Configuration */}
      <YAxisConfiguration
        form={form}
        table={table}
        yAxisDataSources={yAxisDataSources}
        addYAxisSeries={addYAxisSeries}
        removeDataSource={removeDataSource}
        isColorColumnSelected={
          colorAxisDataSources.length > 0 && !!colorAxisDataSources[0]?.field.columnName
        }
      />

      {/* Color Dimension Configuration */}
      <ColorDimensionConfiguration
        form={form}
        table={table}
        colorAxisDataSources={colorAxisDataSources}
        appendDataSource={appendDataSource}
        removeDataSource={removeDataSource}
      />
    </div>
  );
}
