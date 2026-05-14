import React from "react";
import { View, Text, ScrollView } from "react-native";
import { ParsedTableData } from "~/shared/utils/parse-experiment-data";

import { DataTable } from "./data-table";

interface ExperimentTablesProps {
  tables: ParsedTableData[];
  isLoading: boolean;
}

export function ExperimentTables({ tables, isLoading }: ExperimentTablesProps) {
  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center">
        <Text className="text-inactive text-base">Loading experiment data...</Text>
      </View>
    );
  }

  if (tables.length === 0) {
    return (
      <View className="flex-1 items-center justify-center">
        <Text className="text-inactive text-center text-base">
          No data available for this experiment
        </Text>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
      <Text className="text-on-surface mb-4 text-xl font-bold">
        Experiment Data ({tables.length} tables)
      </Text>

      {tables.map((table) => (
        <DataTable key={table.name} table={table} />
      ))}
    </ScrollView>
  );
}
