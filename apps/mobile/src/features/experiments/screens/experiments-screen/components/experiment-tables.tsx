import React from "react";
import { View, Text, ScrollView } from "react-native";
import { ParsedTableData } from "~/features/experiments/utils/parse-experiment-data";
import { useTranslation } from "~/shared/i18n";

import { DataTable } from "./data-table";

interface ExperimentTablesProps {
  tables: ParsedTableData[];
  isLoading: boolean;
}

export function ExperimentTables({ tables, isLoading }: ExperimentTablesProps) {
  const { t } = useTranslation(["common", "experiments"]);

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center">
        <Text className="text-inactive text-base">{t("experiments:tables.loading")}</Text>
      </View>
    );
  }

  if (tables.length === 0) {
    return (
      <View className="flex-1 items-center justify-center">
        <Text className="text-inactive text-center text-base">{t("experiments:tables.empty")}</Text>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
      <Text className="text-on-surface mb-4 text-xl font-bold">
        {t("experiments:tables.heading", { count: tables.length })}
      </Text>

      {tables.map((table) => (
        <DataTable key={table.name} table={table} />
      ))}
    </ScrollView>
  );
}
