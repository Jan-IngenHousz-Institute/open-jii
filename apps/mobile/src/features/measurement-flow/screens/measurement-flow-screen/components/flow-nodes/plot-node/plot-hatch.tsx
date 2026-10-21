import React from "react";
import { StyleSheet } from "react-native";
import Svg, { Line } from "react-native-svg";

const SPACING = 7;
const SIDE = 48;
const OFFSETS = Array.from(
  { length: Math.ceil((SIDE * 2) / SPACING) },
  (_, index) => index * SPACING,
);

/** Diagonal lines over a cell, the phone's mark for a plot in another measurer's share. */
export function PlotHatch() {
  const renderLine = (offset: number) => (
    <Line
      key={offset}
      x1={offset}
      y1={0}
      x2={offset - SIDE}
      y2={SIDE}
      stroke="#9CA3AF"
      strokeWidth={1.5}
    />
  );

  return (
    <Svg style={StyleSheet.absoluteFill} viewBox={`0 0 ${SIDE} ${SIDE}`} preserveAspectRatio="none">
      {OFFSETS.map(renderLine)}
    </Svg>
  );
}
