"use client";

import { Fragment, useMemo } from "react";
import { calcGridItemPosition } from "react-grid-layout";

import type { DashboardFormValues } from "../../dashboard-form-shell";

export interface CanvasBounds {
  canvasLeft: number;
  canvasTop: number;
  canvasWidth: number;
  gradientWidth: number;
  gradientHeight: number;
}

export interface GridBackdropProps {
  bounds: CanvasBounds;
  layout: DashboardFormValues["layout"];
}

const BACKDROP_LINE_COLOR = "rgb(15 23 42 / 0.05)";

interface VerticalLinePair {
  col: number;
  startX: number;
  endX: number;
}

interface HorizontalLinePair {
  row: number;
  startY: number;
  endY: number;
}

export function GridBackdrop({ bounds, layout }: GridBackdropProps) {
  const lines = useMemo(() => computeGridLines(bounds, layout), [bounds, layout]);

  if (!lines) {
    return null;
  }

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {lines.vertical.map(({ col, startX, endX }) => (
        <Fragment key={`v${col}`}>
          <BackdropLine orientation="vertical" offset={startX} />
          <BackdropLine orientation="vertical" offset={endX} />
        </Fragment>
      ))}
      {lines.horizontal.map(({ row, startY, endY }) => (
        <Fragment key={`h${row}`}>
          <BackdropLine orientation="horizontal" offset={startY} />
          <BackdropLine orientation="horizontal" offset={endY} />
        </Fragment>
      ))}
    </div>
  );
}

function BackdropLine({
  orientation,
  offset,
}: {
  orientation: "vertical" | "horizontal";
  offset: number;
}) {
  const isVertical = orientation === "vertical";
  const className = isVertical ? "absolute bottom-0 top-0 w-px" : "absolute left-0 right-0 h-px";
  const positionStyle = isVertical ? { left: `${offset}px` } : { top: `${offset}px` };
  return (
    <div className={className} style={{ ...positionStyle, backgroundColor: BACKDROP_LINE_COLOR }} />
  );
}

function computeGridLines(
  bounds: CanvasBounds,
  layout: DashboardFormValues["layout"],
): { vertical: VerticalLinePair[]; horizontal: HorizontalLinePair[] } | null {
  if (bounds.canvasWidth <= 0) {
    return null;
  }

  const margin: [number, number] = [layout.gap, layout.gap];
  const containerPadding: [number, number] = [0, 0];
  const positionParams = {
    margin,
    containerPadding,
    containerWidth: bounds.canvasWidth,
    cols: layout.columns,
    rowHeight: layout.rowHeight,
    maxRows: Infinity,
  };

  return {
    vertical: computeVerticalLines(bounds, positionParams, layout.columns, layout.gap),
    horizontal: computeHorizontalLines(bounds, positionParams, layout.gap, layout.rowHeight),
  };
}

function computeVerticalLines(
  bounds: CanvasBounds,
  positionParams: Parameters<typeof calcGridItemPosition>[0],
  columns: number,
  gap: number,
): VerticalLinePair[] {
  // Add 1 column of bleed each side so the rightmost line draws fully before overflow clips.
  const colPitch = (bounds.canvasWidth + gap) / columns;
  const halfBleedWidth = (bounds.gradientWidth - bounds.canvasWidth) / 2;
  const extraCols = Math.ceil(halfBleedWidth / colPitch) + 1;
  const totalCols = columns + extraCols * 2;

  const lines: VerticalLinePair[] = [];
  for (let idx = 0; idx < totalCols; idx++) {
    const col = idx - extraCols;
    const { left, width } = calcGridItemPosition(positionParams, col, 0, 1, 1);
    const startX = bounds.canvasLeft + left;
    lines.push({ col, startX, endX: startX + width - 1 });
  }
  return lines;
}

function computeHorizontalLines(
  bounds: CanvasBounds,
  positionParams: Parameters<typeof calcGridItemPosition>[0],
  gap: number,
  rowHeight: number,
): HorizontalLinePair[] {
  const rowPitch = rowHeight + gap;
  const remainingHeight = Math.max(0, bounds.gradientHeight - bounds.canvasTop);
  if (remainingHeight === 0) {
    return [];
  }

  // +2 rows of bleed past the gradient bottom so the bottom line paints fully.
  const totalRows = Math.ceil(remainingHeight / rowPitch) + 2;

  const lines: HorizontalLinePair[] = [];
  for (let row = 0; row < totalRows; row++) {
    const { top, height } = calcGridItemPosition(positionParams, 0, row, 1, 1);
    const startY = bounds.canvasTop + top;
    lines.push({ row, startY, endY: startY + height - 1 });
  }
  return lines;
}
