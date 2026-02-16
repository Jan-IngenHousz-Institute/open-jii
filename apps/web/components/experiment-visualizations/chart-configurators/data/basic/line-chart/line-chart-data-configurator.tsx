"use client";

import type { UseFormReturn } from "react-hook-form";
import { useFieldArray } from "react-hook-form";

import type { DataColumn } from "@repo/api";

import type { ChartFormValues } from "../../../chart-configurator-util";
import XAxisConfiguration from "../../shared/x-axis-configuration";
import YAxisConfiguration from "../../shared/y-axis-configuration";

interface LineChartDataConfiguratorProps {
  form: UseFormReturn<ChartFormValues>;
  columns: DataColumn[];
}

export default function LineChartDataConfigurator({
  form,
  columns,
}: LineChartDataConfiguratorProps) {
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
      <XAxisConfiguration form={form} columns={columns} />

      {/* Y-Axes Series Configuration */}
      <YAxisConfiguration
        form={form}
        columns={columns}
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
