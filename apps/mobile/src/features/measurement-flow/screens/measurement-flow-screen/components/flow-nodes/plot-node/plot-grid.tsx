import React, { useRef } from "react";
import { ScrollView, Text, View } from "react-native";
import type { LayoutChangeEvent } from "react-native";

import type { ExampleField, NextPlot } from "./next-plot";
import { PLOT_CELL_SIZE } from "./plot-state-cell";

const GAP = 4;
const HEADER_HEIGHT = 18;

interface PlotGridProps {
  field: ExampleField;
  renderCell: (plot: NextPlot) => React.ReactNode;
  /** The column the grid opens scrolled to, such as the named plot's or the far edge of a share. */
  focusColumn?: number;
}

/**
 * The layout as rows by letter and columns by number, as the Layout tab draws it. Cells keep a 48 dp
 * floor, so the columns scroll sideways under row labels that stay put. A gap is a dotted outline.
 */
export function PlotGrid({ field, renderCell, focusColumn = 1 }: PlotGridProps) {
  const scrollRef = useRef<ScrollView>(null);
  const plotsByPosition = new Map(field.plots.map((plot) => [`${plot.row}:${plot.column}`, plot]));
  const rowNumbers = Array.from({ length: field.rows }, (_, index) => index + 1);
  const columnNumbers = Array.from({ length: field.columns }, (_, index) => index + 1);
  const cellStyle = { width: PLOT_CELL_SIZE, height: PLOT_CELL_SIZE };

  const renderRowLabel = (row: number) => (
    <View key={row} className="justify-center" style={{ height: PLOT_CELL_SIZE }}>
      <Text className="text-muted-foreground text-xs font-medium">
        {String.fromCharCode(64 + row)}
      </Text>
    </View>
  );

  const renderColumnHeader = (column: number) => (
    <Text
      key={column}
      className="text-muted-foreground text-center text-xs"
      style={{ width: PLOT_CELL_SIZE }}
    >
      {column}
    </Text>
  );

  const renderPosition = (row: number, column: number) => {
    const plot = plotsByPosition.get(`${row}:${column}`);

    if (!plot) {
      return (
        <View
          key={column}
          className="border-muted-foreground/40 rounded-md"
          style={{ ...cellStyle, borderWidth: 1.5, borderStyle: "dotted" }}
        />
      );
    }

    return (
      <View key={column} style={cellStyle}>
        {renderCell(plot)}
      </View>
    );
  };

  const scrollToFocus = (event: LayoutChangeEvent) => {
    const columnEnd = focusColumn * (PLOT_CELL_SIZE + GAP);
    const offset = Math.max(0, columnEnd - event.nativeEvent.layout.width);
    scrollRef.current?.scrollTo({ x: offset, animated: false });
  };

  const renderRow = (row: number) => (
    <View key={row} className="flex-row" style={{ gap: GAP }}>
      {columnNumbers.map((column) => renderPosition(row, column))}
    </View>
  );

  return (
    <View className="flex-row" style={{ gap: 6 }}>
      <View style={{ paddingTop: HEADER_HEIGHT + GAP, gap: GAP }}>
        {rowNumbers.map(renderRowLabel)}
      </View>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        onLayout={scrollToFocus}
      >
        <View style={{ gap: GAP }}>
          <View className="flex-row" style={{ gap: GAP, height: HEADER_HEIGHT }}>
            {columnNumbers.map(renderColumnHeader)}
          </View>
          {rowNumbers.map(renderRow)}
        </View>
      </ScrollView>
    </View>
  );
}
