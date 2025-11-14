import React from "react";
import { Modal, ScrollView, Text, View, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Chart } from "~/components/measurement-result/components/chart";
import { KeyValue } from "~/components/measurement-result/components/key-value";
import { MeasurementHeader } from "~/components/measurement-result/components/measurement-header";
import { useTheme } from "~/hooks/use-theme";
import { ParsedTableData } from "~/utils/parse-experiment-data";

interface TableDetailModalProps {
  visible: boolean;
  table: ParsedTableData | null;
  onClose: () => void;
}

export function TableDetailModal({ visible, table, onClose }: TableDetailModalProps) {
  const theme = useTheme();
  const { colors } = theme;
  const insets = useSafeAreaInsets();

  if (!table) return null;

  function renderDataItem(key: string, value: any, rowIndex: number) {
    // Try to parse JSON values first
    let parsedValue = value;
    try {
      if (typeof value === "string" && (value.startsWith("[") || value.startsWith("{"))) {
        parsedValue = JSON.parse(value);
      }
    } catch {
      // Keep original value if parsing fails
    }

    // Handle arrays
    if (Array.isArray(parsedValue)) {
      if (parsedValue.length > 0 && typeof parsedValue[0] === "number") {
        return <Chart key={`${rowIndex}-${key}`} name={key} values={parsedValue} />;
      } else {
        // For non-number arrays, show as key-value with summary
        const summary = getArraySummary(parsedValue);
        return <KeyValue key={`${rowIndex}-${key}`} value={summary} name={key} />;
      }
    }

    // Handle objects
    if (typeof parsedValue === "object" && parsedValue !== null) {
      const summary = `{${Object.keys(parsedValue).length} keys}`;
      return <KeyValue key={`${rowIndex}-${key}`} value={summary} name={key} />;
    }

    // Handle primitives
    if (typeof parsedValue === "string" || typeof parsedValue === "number") {
      return <KeyValue key={`${rowIndex}-${key}`} value={parsedValue} name={key} />;
    }

    return null;
  }

  function getArraySummary(array: any[]): string {
    if (array.length === 0) {
      return "Empty array";
    }

    const length = array.length;
    let type = "mixed";
    if (array.every((item) => typeof item === "string")) {
      type = "string";
    } else if (array.every((item) => typeof item === "number")) {
      type = "number";
    } else if (array.every((item) => typeof item === "boolean")) {
      type = "boolean";
    } else if (array.every((item) => typeof item === "object")) {
      type = "object";
    }

    return `[${length} ${type} items]`;
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <View
        style={[
          styles.container,
          {
            backgroundColor: theme.isDark ? colors.dark.background : colors.light.background,
            paddingTop: insets.top,
            paddingBottom: insets.bottom,
          },
        ]}
      >
        <MeasurementHeader
          timestamp={new Date().toISOString()}
          experimentName={table.displayName}
          onClose={onClose}
        />

        <ScrollView
          style={styles.scrollContainer}
          showsVerticalScrollIndicator={true}
          contentContainerStyle={{ paddingBottom: 20 }}
        >
          <View style={styles.content}>
            <Text
              style={[
                styles.tableInfo,
                {
                  color: theme.isDark ? colors.dark.onSurface : colors.light.onSurface,
                },
              ]}
            >
              {table.totalRows} rows, {table.columns.length} columns
            </Text>

            {table.rows.map((row, rowIndex) => (
              <View key={rowIndex} style={styles.rowContainer}>
                <Text
                  style={[
                    styles.rowTitle,
                    {
                      color: theme.isDark ? colors.dark.onSurface : colors.light.onSurface,
                    },
                  ]}
                >
                  Row {rowIndex + 1}
                </Text>
                <View style={styles.rowContent}>
                  {Object.keys(row).map((key) => renderDataItem(key, row[key], rowIndex))}
                </View>
              </View>
            ))}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContainer: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  tableInfo: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 16,
    textAlign: "center",
  },
  rowContainer: {
    marginBottom: 24,
  },
  rowTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 12,
  },
  rowContent: {
    gap: 8,
  },
});
