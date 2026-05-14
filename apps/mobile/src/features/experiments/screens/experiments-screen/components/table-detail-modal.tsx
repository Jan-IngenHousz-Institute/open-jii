import React from "react";
import { Modal, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Chart } from "~/features/measurement-flow/components/measurement-result/components/chart";
import { KeyValue } from "~/features/measurement-flow/components/measurement-result/components/key-value";
import { MeasurementHeader } from "~/features/measurement-flow/components/measurement-result/components/measurement-header";
import { ParsedTableData } from "~/shared/utils/parse-experiment-data";

interface TableDetailModalProps {
  visible: boolean;
  table: ParsedTableData | null;
  onClose: () => void;
}

export function TableDetailModal({ visible, table, onClose }: TableDetailModalProps) {
  const insets = useSafeAreaInsets();

  if (!table) return null;

  function renderDataItem(key: string, value: any, rowIndex: number) {
    let parsedValue = value;
    try {
      if (typeof value === "string" && (value.startsWith("[") || value.startsWith("{"))) {
        parsedValue = JSON.parse(value);
      }
    } catch {
      // Keep original value if parsing fails
    }

    if (Array.isArray(parsedValue)) {
      if (parsedValue.length > 0 && typeof parsedValue[0] === "number") {
        return <Chart key={`${rowIndex}-${key}`} name={key} values={parsedValue} />;
      } else {
        const summary = getArraySummary(parsedValue);
        return <KeyValue key={`${rowIndex}-${key}`} value={summary} name={key} />;
      }
    }

    if (typeof parsedValue === "object" && parsedValue !== null) {
      const summary = `{${Object.keys(parsedValue).length} keys}`;
      return <KeyValue key={`${rowIndex}-${key}`} value={summary} name={key} />;
    }

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
        className="bg-background flex-1"
        style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
      >
        <MeasurementHeader
          timestamp={new Date().toISOString()}
          experimentName={table.displayName}
          onClose={onClose}
        />

        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={true}
          contentContainerStyle={{ paddingBottom: 20 }}
        >
          <View className="p-4">
            <Text className="text-on-surface mb-4 text-center text-base font-semibold">
              {table.totalRows} rows, {table.columns.length} columns
            </Text>

            {table.rows.map((row, rowIndex) => (
              <View key={rowIndex} className="mb-6">
                <Text className="text-on-surface mb-3 text-lg font-bold">Row {rowIndex + 1}</Text>
                <View className="gap-2">
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
