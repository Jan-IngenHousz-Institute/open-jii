import React from "react";
import { Text, View } from "react-native";

import type { ExampleField, NextPlot } from "./next-plot";

interface PlotGridProps {
  field: ExampleField;
  renderCell: (plot: NextPlot) => React.ReactNode;
}

/** The layout as rows by letter and columns by number, as the Layout tab draws it. Gaps stay empty. */
export function PlotGrid({ field, renderCell }: PlotGridProps) {
  const plotsByPosition = new Map(field.plots.map((plot) => [`${plot.row}:${plot.column}`, plot]));
  const rowNumbers = Array.from({ length: field.rows }, (_, index) => index + 1);
  const columnNumbers = Array.from({ length: field.columns }, (_, index) => index + 1);

  const renderColumnHeader = (column: number) => (
    <Text key={column} className="text-muted-foreground flex-1 text-center text-xs">
      {column}
    </Text>
  );

  const renderPosition = (row: number, column: number) => {
    const plot = plotsByPosition.get(`${row}:${column}`);

    return (
      <View key={column} className="flex-1" style={{ aspectRatio: 1 }}>
        {plot ? renderCell(plot) : null}
      </View>
    );
  };

  const renderRow = (row: number) => (
    <View key={row} className="flex-row items-center gap-1">
      <Text className="text-muted-foreground w-5 text-xs font-medium">
        {String.fromCharCode(64 + row)}
      </Text>
      {columnNumbers.map((column) => renderPosition(row, column))}
    </View>
  );

  return (
    <View className="gap-1">
      <View className="flex-row gap-1">
        <View className="w-5" />
        {columnNumbers.map(renderColumnHeader)}
      </View>
      {rowNumbers.map(renderRow)}
    </View>
  );
}
