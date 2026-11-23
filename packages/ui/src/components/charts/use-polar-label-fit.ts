"use client";

import type { Layout } from "plotly.js";
import { useCallback, useState } from "react";
import type { PlotParams } from "react-plotly.js";

import { MIN_OUTER_PLOT_HEIGHT } from "./outer-labels";

type Bounds = Pick<DOMRectReadOnly, "left" | "right" | "top" | "bottom">;
const TOLERANCE = 1.5;

function intersects(a: Bounds, b: Bounds) {
  return (
    Math.min(a.right, b.right) - Math.max(a.left, b.left) > TOLERANCE &&
    Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > TOLERANCE
  );
}

function inkBounds(label: SVGTextElement, context: CanvasRenderingContext2D): Bounds[] {
  const lines = [...label.querySelectorAll<SVGTSpanElement>("tspan.line")];
  return (lines.length ? lines : [label]).flatMap((line) => {
    const matrix = line.getScreenCTM();
    if (!matrix) return [];
    const { fontStyle, fontWeight, fontSize, fontFamily } = getComputedStyle(line);
    context.font = `${fontStyle} ${fontWeight} ${fontSize} ${fontFamily}`;
    const characters = Array.from(line.textContent ?? "").slice(0, line.getNumberOfChars());
    return characters.flatMap((character, index) => {
      if (!character.trim()) return [];
      const metrics = context.measureText(character);
      const point = line.getStartPositionOfChar(index);
      const rotation = line.getRotationOfChar(index);
      const transform = matrix.translate(point.x, point.y).rotate(rotation);
      const corners = [
        [-metrics.actualBoundingBoxLeft, -metrics.actualBoundingBoxAscent],
        [metrics.actualBoundingBoxRight, -metrics.actualBoundingBoxAscent],
        [metrics.actualBoundingBoxRight, metrics.actualBoundingBoxDescent],
        [-metrics.actualBoundingBoxLeft, metrics.actualBoundingBoxDescent],
      ].map(([x, y]) => new DOMPoint(x, y).matrixTransform(transform));
      return [
        {
          left: Math.min(...corners.map((corner) => corner.x)),
          right: Math.max(...corners.map((corner) => corner.x)),
          top: Math.min(...corners.map((corner) => corner.y)),
          bottom: Math.max(...corners.map((corner) => corner.y)),
        },
      ];
    });
  });
}

function hasPolarLabelCollision(graph: HTMLElement, checkAngularPairs: boolean) {
  const frame = graph.getBoundingClientRect();
  const legend = graph.querySelector(".infolayer .legend > .bg")?.getBoundingClientRect();
  const labels = [
    ...graph.querySelectorAll<SVGTextElement>(
      ".polarlayer .angularaxistick text, .polarlayer .xtick text, .gtitle, .annotation-text",
    ),
  ].flatMap((label) => {
    const bounds = label.getBoundingClientRect();
    if (!bounds.width || !bounds.height || !label.textContent?.trim()) return [];
    return [
      {
        label,
        bounds,
        angular: label.closest(".angularaxistick") !== null,
        axis: label.closest(".polarlayer") !== null,
        ink: undefined as Bounds[] | undefined,
      },
    ];
  });
  let context: CanvasRenderingContext2D | null | undefined;
  return labels.some((a, index) => {
    if (
      a.axis &&
      (a.bounds.left < frame.left - TOLERANCE ||
        a.bounds.right > frame.right + TOLERANCE ||
        a.bounds.top < frame.top - TOLERANCE ||
        a.bounds.bottom > frame.bottom + TOLERANCE ||
        (legend && intersects(a.bounds, legend)))
    )
      return true;
    return labels.slice(index + 1).some((b) => {
      if (
        (!a.axis && !b.axis) ||
        (!checkAngularPairs && a.angular && b.angular) ||
        !intersects(a.bounds, b.bounds)
      )
        return false;
      // A rotated or wrapped SVG text box includes space outside the drawn letters.
      context ??= document.createElement("canvas").getContext("2d");
      if (!context) return true;
      a.ink ??= inkBounds(a.label, context);
      b.ink ??= inkBounds(b.label, context);
      return a.ink.some((glyph) => b.ink?.some((other) => intersects(glyph, other)));
    });
  });
}

export function usePolarLabelFit(
  normalLayout: Partial<Layout>,
  height: number,
  checkAngularPairs = true,
) {
  const [failure, setFailure] = useState<{ layout: Partial<Layout>; diameter: number }>();
  const normalHeight = height - (normalLayout.margin?.t ?? 0) - (normalLayout.margin?.b ?? 0);
  const tooShort = height > 0 && normalHeight < MIN_OUTER_PLOT_HEIGHT;
  const measuredFailure = failure?.layout === normalLayout ? failure : undefined;
  const compact = tooShort || measuredFailure !== undefined;
  const onNormalDraw = useCallback<NonNullable<PlotParams["onUpdate"]>>(
    (_figure, graph) => {
      const circle = graph.querySelector(".polarlayer .plotbg path")?.getBoundingClientRect();
      if (!circle?.width || !circle.height) return;
      const diameter = Math.min(circle.width, circle.height);
      if (diameter >= MIN_OUTER_PLOT_HEIGHT && !hasPolarLabelCollision(graph, checkAngularPairs))
        return;
      setFailure((previous) =>
        previous?.layout === normalLayout ? previous : { layout: normalLayout, diameter },
      );
    },
    [checkAngularPairs, normalLayout],
  );
  return {
    compact,
    maxPlotHeight: Math.max(
      MIN_OUTER_PLOT_HEIGHT,
      Math.floor(measuredFailure?.diameter ?? normalHeight),
    ),
    onNormalDraw: compact ? undefined : onNormalDraw,
  };
}
