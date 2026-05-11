import React, { useState } from "react";
import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import { ParsedTableData, formatCellValue, getTableSummary } from "~/utils/parse-experiment-data";

import { TableDetailModal } from "./table-detail-modal";

interface DataTableProps {
  table: ParsedTableData;
}

export function DataTable({ table }: DataTableProps) {
  const [modalVisible, setModalVisible] = useState(false);

  function renderCell(value: any, column: ParsedTableData["columns"][0]) {
    const formattedValue = formatCellValue(value, column.isArray, column.isObject);

    return (
      <Text className="text-on-surface text-[11px]" numberOfLines={1} ellipsizeMode="tail">
        {formattedValue}
      </Text>
    );
  }

  return (
    <>
      <TouchableOpacity
        className="bg-surface mb-4 rounded-lg p-4 shadow-sm shadow-black/10"
        onPress={() => setModalVisible(true)}
        activeOpacity={0.7}
      >
        <View className="mb-3">
          <Text className="text-on-surface mb-1 text-lg font-bold">{table.displayName}</Text>
          <Text className="text-inactive text-sm">{getTableSummary(table)}</Text>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View className="min-w-full">
            <View className="border-border flex-row border-b py-1.5">
              {table.columns.map((column) => (
                <View
                  key={column.name}
                  className="flex-1 px-1.5"
                  style={{ minWidth: 100, maxWidth: 200 }}
                >
                  <Text className="text-on-surface text-xs font-bold">{column.displayName}</Text>
                  {column.isArray && (
                    <Text className="text-jii-primary mt-px text-[8px] font-bold">[Array]</Text>
                  )}
                  {column.isObject && (
                    <Text className="text-jii-primary mt-px text-[8px] font-bold">[Object]</Text>
                  )}
                </View>
              ))}
            </View>

            {table.rows.map((row, rowIndex) => (
              <View
                key={rowIndex}
                className="border-border flex-row border-b py-1"
                style={{ borderBottomWidth: 0.5 }}
              >
                {table.columns.map((column) => (
                  <View
                    key={column.name}
                    className="flex-1 px-1.5"
                    style={{ minWidth: 100, maxWidth: 200 }}
                  >
                    {renderCell(row[column.name], column)}
                  </View>
                ))}
              </View>
            ))}
          </View>
        </ScrollView>
      </TouchableOpacity>

      <TableDetailModal
        visible={modalVisible}
        table={table}
        onClose={() => setModalVisible(false)}
      />
    </>
  );
}
