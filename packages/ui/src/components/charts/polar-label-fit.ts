import type { Layout, PlotData } from "plotly.js";

import { MIN_OUTER_PLOT_HEIGHT } from "./outer-labels";
import { loadPlotlyRuntime, pendingTraceTypes } from "./plotly-loader";

export interface PolarFigure {
  data: PlotData[];
  layout: Partial<Layout>;
}

export interface PolarFit {
  compact(maxPlotHeight: number): PolarFigure;
  wind?: { ticks: number[]; labels: string[] };
}

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

type Axis = "angular" | "radial" | "other";
type TickLabel = { axis: Axis; value?: number; text: string };
type PlotlyTick = SVGTextElement & { __data__?: { x?: number } };

function readLabels(graph: HTMLElement, checkAngularPairs: boolean) {
  const frame = graph.getBoundingClientRect();
  const legend = graph.querySelector(".infolayer .legend > .bg")?.getBoundingClientRect();
  const labels = [
    ...graph.querySelectorAll<PlotlyTick>(
      ".polarlayer .angularaxistick text, .polarlayer .xtick text, .gtitle, .annotation-text",
    ),
  ].flatMap((label) => {
    const bounds = label.getBoundingClientRect();
    const text = label.textContent ?? "";
    if (!bounds.width || !bounds.height || !text.trim()) return [];
    const axis: Axis = label.closest(".angularaxistick")
      ? "angular"
      : label.closest(".polarlayer")
        ? "radial"
        : "other";
    return [
      {
        axis,
        value: label.__data__?.x,
        text,
        label,
        bounds,
        ink: undefined as Bounds[] | undefined,
      },
    ];
  });
  const conflicts: [TickLabel, TickLabel][] = [];
  const clipped = new Set<TickLabel>();
  let context: CanvasRenderingContext2D | null | undefined;
  labels.forEach((a, index) => {
    if (
      a.axis !== "other" &&
      (a.bounds.left < frame.left - TOLERANCE ||
        a.bounds.right > frame.right + TOLERANCE ||
        a.bounds.top < frame.top - TOLERANCE ||
        a.bounds.bottom > frame.bottom + TOLERANCE ||
        (legend && intersects(a.bounds, legend)))
    )
      clipped.add(a);
    for (const b of labels.slice(index + 1)) {
      if (
        (a.axis === "other" && b.axis === "other") ||
        (!checkAngularPairs && a.axis === "angular" && b.axis === "angular") ||
        !intersects(a.bounds, b.bounds)
      )
        continue;
      context ??= document.createElement("canvas").getContext("2d");
      if (context) {
        a.ink ??= inkBounds(a.label, context);
        b.ink ??= inkBounds(b.label, context);
        if (!a.ink.some((glyph) => b.ink?.some((other) => intersects(glyph, other)))) continue;
      }
      conflicts.push([a, b]);
    }
  });
  return { labels, clipped, conflicts };
}

function radialSubsets(ticks: TickLabel[]) {
  const subsets = [ticks];
  // Keep the origin and prefer the longest evenly spaced span at each density.
  for (let count = ticks.length - 1; count >= 2; count--) {
    for (let step = Math.floor((ticks.length - 1) / (count - 1)); step > 0; step--) {
      subsets.push(ticks.filter((_, index) => index % step === 0 && index <= (count - 1) * step));
    }
  }
  return subsets;
}

export function chooseWindTicks(
  angular: TickLabel[],
  radial: TickLabel[],
  fits: (keep: Set<TickLabel>) => boolean,
) {
  const radialChoices = radialSubsets(radial);
  for (let step = 1; step <= Math.max(1, Math.floor(angular.length / 2)); step++) {
    const angularChoice = angular.filter((_, index) => index % step === 0);
    for (const radialChoice of radialChoices) {
      if (fits(new Set([...angularChoice, ...radialChoice]))) {
        return { angular: angularChoice, radial: radialChoice };
      }
    }
  }
  return undefined;
}

function windTicks(
  figure: PolarFigure,
  measured: ReturnType<typeof readLabels>,
  wind: NonNullable<PolarFit["wind"]>,
) {
  const angular = measured.labels.filter((tick) => tick.axis === "angular");
  const radial = measured.labels.filter((tick) => tick.axis === "radial");
  const keep = chooseWindTicks(angular, radial, (labels) => {
    const visible = (tick: TickLabel) => tick.axis === "other" || labels.has(tick);
    return (
      ![...measured.clipped].some(visible) &&
      !measured.conflicts.some(([a, b]) => visible(a) && visible(b))
    );
  });
  if (!keep) return undefined;
  const values = new Set(keep.angular.map((tick) => tick.value));
  const polar = figure.layout.polar;
  return {
    ...figure,
    layout: {
      ...figure.layout,
      polar: {
        ...polar,
        angularaxis:
          keep.angular.length === angular.length
            ? polar?.angularaxis
            : {
                ...polar?.angularaxis,
                ticktext: wind.labels.map((label, index) =>
                  values.has(wind.ticks[index]) ? label : "",
                ),
              },
        radialaxis:
          keep.radial.length === radial.length
            ? polar?.radialaxis
            : {
                ...polar?.radialaxis,
                tickmode: "array",
                tickvals: keep.radial.map((tick) => tick.value),
                ticktext: keep.radial.map((tick) => tick.text),
              },
      } as Partial<Layout>["polar"],
    },
  };
}

export async function preparePolarFigure(
  container: HTMLElement,
  normal: PolarFigure,
  fit: PolarFit,
  width: number,
  height: number,
  cancelled: () => boolean,
): Promise<PolarFigure | undefined> {
  const { Plotly } = await loadPlotlyRuntime();
  await pendingTraceTypes(normal.data.map((trace) => trace.type ?? "scatter"));
  if (cancelled()) return undefined;

  const host = document.createElement("div");
  host.setAttribute("aria-hidden", "true");
  host.style.cssText = "position:fixed;left:0;top:0;visibility:hidden;pointer-events:none";
  const shadow = host.attachShadow({ mode: "closed" });
  const style = document.createElement("style");
  // The shadow root keeps candidate charts out of the live plot tree.
  style.textContent = `
    .main-svg { position: absolute; top: 0; left: 0; }
    .js-plotly-plot text { font-family: var(--font-sans) !important; }
  `;
  const graph = document.createElement("div");
  graph.style.cssText = `width:${width}px;height:${height}px`;
  shadow.append(style, graph);
  container.append(host);

  const fixed = (figure: PolarFigure): PolarFigure => ({
    data: figure.data,
    layout: { ...figure.layout, width, height, autosize: false },
  });
  const inspect = async (figure: PolarFigure, checkAngularPairs = true) => {
    // Plotly mutates its input. The visible chart gets the untouched figure.
    await Plotly.react(graph, structuredClone(figure.data), structuredClone(figure.layout), {
      responsive: false,
      displayModeBar: false,
    });
    const circle = graph.querySelector(".polarlayer .plotbg path")?.getBoundingClientRect();
    const diameter = circle ? Math.min(circle.width, circle.height) : 0;
    return { diameter, labels: readLabels(graph, checkAngularPairs) };
  };

  try {
    const normalHeight = height - (normal.layout.margin?.t ?? 0) - (normal.layout.margin?.b ?? 0);
    let maxPlotHeight = MIN_OUTER_PLOT_HEIGHT;
    if (normalHeight >= MIN_OUTER_PLOT_HEIGHT) {
      const regular = fixed(normal);
      // The mode with all 32 labels has a different catalogue minimum.
      const density = fit.wind?.labels.filter(Boolean).length ?? 0;
      const { diameter, labels } = await inspect(regular, density <= 16);
      if (cancelled()) return undefined;
      if (diameter >= MIN_OUTER_PLOT_HEIGHT) {
        if (!labels.clipped.size && !labels.conflicts.length) return regular;
        if (fit.wind) {
          const fitted = windTicks(regular, labels, fit.wind);
          if (fitted) return fitted;
        }
        maxPlotHeight = Math.floor(diameter);
      }
    }
    const compact = fixed(fit.compact(maxPlotHeight));
    if (!fit.wind) return compact;
    const { labels } = await inspect(compact);
    return cancelled() ? undefined : (windTicks(compact, labels, fit.wind) ?? compact);
  } finally {
    Plotly.purge(graph);
    host.remove();
  }
}
