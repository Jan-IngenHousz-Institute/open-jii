import React from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { useTheme } from "~/hooks/use-theme";
import { ParsedTableData, formatCellValue, getTableSummary } from "~/utils/parse-experiment-data";

interface DataTableProps {
  table: ParsedTableData;
}

export function DataTable({ table }: DataTableProps) {
  const theme = useTheme();
  const { colors } = theme;

  function renderCell(value: any, column: ParsedTableData["columns"][0]) {
    const formattedValue = formatCellValue(value, column.isArray, column.isObject);

    return (
      <Text
        style={[
          styles.cell,
          { color: theme.isDark ? colors.dark.onSurface : colors.light.onSurface },
        ]}
        numberOfLines={1}
        ellipsizeMode="tail"
      >
        {formattedValue}
      </Text>
    );
  }

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.isDark ? colors.dark.surface : colors.light.surface },
      ]}
    >
      <View style={styles.header}>
        <Text
          style={[
            styles.tableTitle,
            { color: theme.isDark ? colors.dark.onSurface : colors.light.onSurface },
          ]}
        >
          {table.displayName}
        </Text>
        <Text
          style={[
            styles.tableSummary,
            { color: theme.isDark ? colors.dark.inactive : colors.light.inactive },
          ]}
        >
          {getTableSummary(table)}
        </Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.table}>
          {/* Header Row */}
          <View
            style={[
              styles.headerRow,
              { borderBottomColor: theme.isDark ? colors.dark.border : colors.light.border },
            ]}
          >
            {table.columns.map((column) => (
              <View key={column.name} style={styles.headerCell}>
                <Text
                  style={[
                    styles.headerText,
                    { color: theme.isDark ? colors.dark.onSurface : colors.light.onSurface },
                  ]}
                >
                  {column.displayName}
                </Text>
                {column.isArray && (
                  <Text style={[styles.typeIndicator, { color: colors.primary.dark }]}>
                    [Array]
                  </Text>
                )}
                {column.isObject && (
                  <Text style={[styles.typeIndicator, { color: colors.primary.dark }]}>
                    [Object]
                  </Text>
                )}
              </View>
            ))}
          </View>

          {/* Data Rows */}
          {table.rows.map((row, rowIndex) => (
            <View
              key={rowIndex}
              style={[
                styles.dataRow,
                { borderBottomColor: theme.isDark ? colors.dark.border : colors.light.border },
              ]}
            >
              {table.columns.map((column) => (
                <View key={column.name} style={styles.cellContainer}>
                  {renderCell(row[column.name], column)}
                </View>
              ))}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
    borderRadius: 8,
    padding: 16,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  header: {
    marginBottom: 12,
  },
  tableTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 4,
  },
  tableSummary: {
    fontSize: 14,
  },
  table: {
    minWidth: "100%",
  },
  headerRow: {
    flexDirection: "row",
    paddingVertical: 6,
    borderBottomWidth: 1,
  },
  dataRow: {
    flexDirection: "row",
    paddingVertical: 4,
    borderBottomWidth: 0.5,
  },
  headerCell: {
    flex: 1,
    minWidth: 100,
    maxWidth: 200,
    paddingHorizontal: 6,
  },
  cellContainer: {
    flex: 1,
    minWidth: 100,
    maxWidth: 200,
    paddingHorizontal: 6,
  },
  headerText: {
    fontSize: 12,
    fontWeight: "bold",
  },
  cell: {
    fontSize: 11,
  },
  typeIndicator: {
    fontSize: 8,
    fontWeight: "bold",
    marginTop: 1,
  },
});
