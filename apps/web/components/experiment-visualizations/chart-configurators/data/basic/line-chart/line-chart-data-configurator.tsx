"use client";

import type { UseFormReturn } from "react-hook-form";
import { useFieldArray } from "react-hook-form";
import type { SampleTable } from "~/hooks/experiment/useExperimentData/useExperimentData";

import type { ChartFormValues } from "../../../chart-configurator-util";
import XAxisConfiguration from "../../shared/x-axis-configuration";
import YAxisConfiguration from "../../shared/y-axis-configuration";

interface LineChartDataConfiguratorProps {
  form: UseFormReturn<ChartFormValues>;
  table: SampleTable;
}

export default function LineChartDataConfigurator({ form, table }: LineChartDataConfiguratorProps) {
  const {
    fields: dataSourceFields,
    append: appendDataSource,
    remove: removeDataSource,
  } = useFieldArray({
    control: form.control,
    name: "dataConfig.dataSources",
  });

  // Get data sources by role
  const yAxisDataSources = dataSourceFields
    .map((field, index) => ({ field, index }))
    .filter(({ field }) => field.role === "y");
  const colorAxisDataSources = dataSourceFields
    .map((field, index) => ({ field, index }))
    .filter(({ field }) => field.role === "color");

  // Function to add a new Y-axis series
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
      <XAxisConfiguration form={form} table={table} />

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
    </div>
  );
}
