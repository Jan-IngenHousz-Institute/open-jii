import type { Layout } from "plotly.js";
import { useSyncExternalStore } from "react";

const GAP = 1.5;
const LINE_SPACING = 1.3;
const MID_SHIFT = 0.35;

type Box = { left: number; right: number; top: number; bottom: number };
type Ink = { width: number; boxes: Box[]; bounds?: Box };
export type MeasureLabel = (text: string, size: number) => Ink;

let context: CanvasRenderingContext2D | null | undefined;
let family = "sans-serif";
const metrics = new Map<string, Ink>();
const METRIC_LIMIT = 2048;

let fontRevision = 0;
const fontListeners = new Set<() => void>();

export function polarFontFamily() {
  const styles = getComputedStyle(document.body);
  return styles.getPropertyValue("--font-sans").trim() || styles.fontFamily || "sans-serif";
}

function refreshFontMetrics() {
  metrics.clear();
  family = polarFontFamily();
  fontRevision++;
  fontListeners.forEach((listener) => listener());
}

function subscribeToFonts(listener: () => void) {
  const fonts = document.fonts;
  if (!fonts) return () => undefined;
  if (!fontListeners.size) fonts.addEventListener("loadingdone", refreshFontMetrics);
  fontListeners.add(listener);
  return () => {
    fontListeners.delete(listener);
    if (!fontListeners.size) {
      fonts.removeEventListener("loadingdone", refreshFontMetrics);
      metrics.clear();
    }
  };
}

export function usePolarFontRevision() {
  return useSyncExternalStore(
    subscribeToFonts,
    () => fontRevision,
    () => 0,
  );
}

export const measurePolarLabel: MeasureLabel = (text, size) => {
  if (context === undefined && typeof CanvasRenderingContext2D !== "undefined") {
    context = document.createElement("canvas").getContext("2d");
    family = polarFontFamily();
  }
  const font = `${size}px ${family}`;
  const key = `${font}\n${text}`;
  const cached = metrics.get(key);
  if (cached) return cached;

  if (!context) {
    const width = text.length * size * 0.65;
    return { width, boxes: [{ left: 0, right: width, top: -size * 0.7, bottom: 0 }] };
  }
  context.font = font;
  const line = context.measureText(text);
  const width = line.width;
  const bounds = {
    left: -line.actualBoundingBoxLeft,
    right: line.actualBoundingBoxRight,
    top: -line.actualBoundingBoxAscent,
    bottom: line.actualBoundingBoxDescent,
  };
  let prefix = "";
  const boxes = Array.from(text).flatMap((glyph) => {
    const advance = context?.measureText(prefix).width ?? 0;
    prefix += glyph;
    if (!glyph.trim() || !context) return [];
    const ink = context.measureText(glyph);
    return [
      {
        left: advance - ink.actualBoundingBoxLeft,
        right: advance + ink.actualBoundingBoxRight,
        top: -ink.actualBoundingBoxAscent,
        bottom: ink.actualBoundingBoxDescent,
      },
    ];
  });
  const result = { width, boxes, bounds };
  if (metrics.size === METRIC_LIMIT) metrics.clear();
  metrics.set(key, result);
  return result;
};

export function polarDiameter(layout: Partial<Layout>, width: number, height: number) {
  const { l = 0, r = 0, t = 0, b = 0 } = layout.margin ?? {};
  return Math.min(width - l - r, height - t - b);
}

function overlaps(a: Box, b: Box) {
  return (
    Math.min(a.right, b.right) - Math.max(a.left, b.left) > GAP &&
    Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > GAP
  );
}

function project(ink: Ink, x: number, y: number, anchor: number, quarterTurn = false, pivotY = 0) {
  const leftOffset = x - anchor * ink.width;
  if (!quarterTurn) {
    return ink.boxes.map(({ left, right, top, bottom }) => ({
      left: left + leftOffset,
      right: right + leftOffset,
      top: top + y,
      bottom: bottom + y,
    }));
  }
  return ink.boxes.map(({ left, right, top, bottom }) => ({
    left: x + pivotY - bottom,
    right: x + pivotY - top,
    top: y + pivotY + left - anchor * ink.width,
    bottom: y + pivotY + right - anchor * ink.width,
  }));
}

interface AngularTick {
  angle: number;
  text: string;
}

function angularInk(
  labels: AngularTick[],
  size: number,
  radius: number,
  measure: MeasureLabel,
  wholeLine = false,
) {
  // Plotly positions labels outside the circumference and aligns them away from the centre.
  const standoff = 5.5 + size * 0.2;
  return labels.map(({ angle, text }) => {
    const direction = (angle * Math.PI) / 180;
    const x = Math.sin(direction);
    const y = Math.cos(direction);
    const lines = text.split("<br>");
    const anchor = Math.abs(x) < 0.1 ? 0.5 : x > 0 ? 0 : 1;
    const baseline =
      -y * (radius + standoff + size * (y > 0 ? 0.2 : 1)) +
      Math.abs(x) * size * MID_SHIFT -
      ((1 + y) * (lines.length - 1) * LINE_SPACING * size) / 2;
    return lines.flatMap((line, index) => {
      const ink = measure(line, size);
      return project(
        wholeLine && ink.bounds ? { ...ink, boxes: [ink.bounds] } : ink,
        x * (radius + standoff),
        baseline + index * size * LINE_SPACING,
        anchor,
      );
    });
  });
}

function collide(a: Box[], b: Box[]) {
  return a.some((glyph) => b.some((other) => overlaps(glyph, other)));
}

function pairsCollide(labels: Box[][]) {
  return labels.some((label, index) =>
    labels.some((other, nextIndex) => nextIndex > index && collide(label, other)),
  );
}

/** Linear auto ticks use the next 2/5/10 multiple of the rough interval. */
export function linearTicks(min: number, max: number, count: number) {
  const rough = (max - min) / count;
  if (!Number.isFinite(rough) || rough <= 0) return [0, 1];
  const base = 10 ** Math.floor(Math.log10(rough));
  const step = (rough <= 2 * base ? 2 : rough <= 5 * base ? 5 : 10) * base;
  const first = Math.ceil(min / step - 1e-8) * step;
  const length = Math.max(0, Math.min(20, Math.floor((max - first) / step + 1e-8) + 1));
  return Array.from({ length }, (_, index) => Number((first + index * step).toPrecision(12)));
}

function radialInk(
  ticks: number[],
  size: number,
  radius: number,
  range: readonly [number, number],
  measure: MeasureLabel,
  rotate = false,
) {
  return ticks.map((value) => {
    const x = (radius * (value - range[0])) / (range[1] - range[0]);
    return project(
      measure(String(value), size),
      x,
      5.5 + size * 1.2,
      rotate ? 0 : 0.5,
      rotate,
      -size / 2,
    );
  });
}

function radialChoices(ticks: number[]) {
  const choices = [ticks];
  for (let count = ticks.length - 1; count >= 2; count--) {
    for (let step = Math.floor((ticks.length - 1) / (count - 1)); step >= 1; step--) {
      choices.push(ticks.filter((_, index) => index % step === 0 && index <= (count - 1) * step));
    }
  }
  return choices;
}

export function fitWindTicks({
  diameter,
  peak,
  labels,
  size,
  measure,
  compact,
}: {
  diameter: number;
  peak: number;
  labels: AngularTick[];
  size: number;
  measure: MeasureLabel;
  compact: boolean;
}) {
  // Stacked barpolar pins the minimum at zero and pads the upper extent by 5% of the radius.
  const range = [0, Math.max(1, peak / 0.95)] as const;
  const natural = linearTicks(...range, 5);
  const radius = diameter / 2;
  const angleBoxes = angularInk(labels, size, radius, measure);
  const radial = radialInk(natural, size, radius, range, measure);
  const radialMap = new Map(natural.map((value, index) => [value, radial[index] ?? []]));
  for (let step = 1; step <= Math.max(1, Math.floor(labels.length / 2)); step++) {
    const kept = angleBoxes.filter((_, index) => index % step === 0);
    if ((compact || labels.length <= 16) && pairsCollide(kept)) continue;
    for (const choice of radialChoices(natural)) {
      const selected = choice.map((value) => radialMap.get(value) ?? []);
      if (
        pairsCollide(selected) ||
        selected.some((tick) => kept.some((label) => collide(tick, label)))
      )
        continue;
      return { step, ticks: choice === natural && !compact ? undefined : choice };
    }
  }
  return { step: Math.max(1, Math.ceil(labels.length / 8)), ticks: linearTicks(...range, 2) };
}

export function radarLabelsCollide({
  diameter,
  size,
  labels,
  range,
  ticks,
  measure,
}: {
  diameter: number;
  size: number;
  labels: AngularTick[];
  range: readonly [number, number];
  ticks: number[];
  measure: MeasureLabel;
}) {
  const radius = diameter / 2;
  const headings = angularInk(labels, size, radius, measure);
  let numbers = radialInk(ticks, size, radius, range, measure);
  if (pairsCollide(numbers)) numbers = radialInk(ticks, size, radius, range, measure, true);
  return (
    pairsCollide(headings) ||
    pairsCollide(numbers) ||
    numbers.some((tick) => headings.some((heading) => collide(tick, heading)))
  );
}

const COMPACT_RADAR_SPOKES = [-90, 90, 0, 180];

export function fitCompactRadarTicks({
  diameter,
  headingSize,
  tickSize,
  labels,
  range,
  ticks,
  measure,
}: {
  diameter: number;
  headingSize: number;
  tickSize: number;
  labels: AngularTick[];
  range: readonly [number, number];
  ticks: number[];
  measure: MeasureLabel;
}) {
  const radius = diameter / 2;
  // Whole runs include the ligatures and right-to-left shaping used by SVG text.
  const headings = angularInk(labels, headingSize, radius, measure, true);
  const candidates = COMPACT_RADAR_SPOKES.map((angle) => {
    // The local tick rotation cancels the radial axis rotation, so text stays upright.
    const sin = Math.sin((angle * Math.PI) / 180);
    const cos = Math.cos((angle * Math.PI) / 180);
    const vertical = Math.abs(angle) === 90;
    const anchor = vertical ? (angle > 0 ? 0 : 1) : 0.5;
    const xOffset = vertical ? (Math.sign(angle) * MID_SHIFT * tickSize) / 2 : 0;
    const y = 5.5 + tickSize * (angle === -90 ? 0.4 : vertical ? 0.2 : 0.7);
    const boxes = ticks.map((tick) => {
      const x = (radius * (tick - range[0])) / (range[1] - range[0]) + xOffset;
      return project(
        measure(String(tick), tickSize),
        x * cos + y * sin,
        -x * sin + y * cos + tickSize / 2,
        anchor,
      );
    });
    return { angle, boxes };
  });
  for (let count = ticks.length; count > 0; count--) {
    for (const { angle, boxes } of candidates) {
      const kept = boxes.slice(0, count);
      if (
        !pairsCollide(kept) &&
        !kept.some((tick) => headings.some((label) => collide(tick, label)))
      ) {
        return { angle, ticks: ticks.slice(0, count) };
      }
    }
  }
  return { angle: -90, ticks: [] };
}
