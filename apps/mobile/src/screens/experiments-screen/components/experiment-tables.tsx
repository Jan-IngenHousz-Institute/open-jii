import React from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { useTheme } from "~/hooks/use-theme";
import { ParsedTableData } from "~/utils/parse-experiment-data";

import { DataTable } from "./data-table";

interface ExperimentTablesProps {
  tables: ParsedTableData[];
  isLoading: boolean;
}

export function ExperimentTables({ tables, isLoading }: ExperimentTablesProps) {
  const theme = useTheme();
  const { colors } = theme;

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Text
          style={[
            styles.loadingText,
            { color: theme.isDark ? colors.dark.inactive : colors.light.inactive },
          ]}
        >
          Loading experiment data...
        </Text>
      </View>
    );
  }

  if (tables.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text
          style={[
            styles.emptyText,
            { color: theme.isDark ? colors.dark.inactive : colors.light.inactive },
          ]}
        >
          No data available for this experiment
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <Text
        style={[
          styles.sectionTitle,
          { color: theme.isDark ? colors.dark.onSurface : colors.light.onSurface },
        ]}
      >
        Experiment Data ({tables.length} tables)
      </Text>

      {tables.map((table) => (
        <DataTable key={table.name} table={table} />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    fontSize: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyText: {
    fontSize: 16,
    textAlign: "center",
  },
});
