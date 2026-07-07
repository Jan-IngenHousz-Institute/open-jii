"use client";

import { extractMeasurement } from "@/lib/multispeq/detect";
import type { InputRecord, OutputRecord, ProtocolJson } from "@/lib/multispeq/pipeline";
import { LED_COLORS, LED_NAMES, measurementToTimeseries } from "@/lib/multispeq/pipeline";
import { useMemo } from "react";

import { useTranslation } from "@repo/i18n";
import { PlotlyChart } from "@repo/ui/components/charts/plotly-chart";
// Plotly's own types are a workspace dep of @repo/ui, not of apps/web —
// re-export them through the UI charts module so we don't pull plotly.js
// into web's package.json just to type a layout object.
import type { Layout, PlotData, Shape } from "@repo/ui/components/charts/types";

interface OutputCellTimeseriesProps {
  data: unknown;
  protocolCode: unknown;
  loading?: boolean;
  emptyLabel: string;
  errorLabel: string;
}

/**
 * Picks a usable ProtocolJson out of the protocol.code field. Protocols are
 * stored as an array of dicts; the first dict is what carries _protocol_set_
 * and v_arrays. Falls back to the object itself for the bundled-JSON shape.
 */
function pickProtocolJson(code: unknown): ProtocolJson | null {
  if (code == null) return null;
  if (Array.isArray(code)) {
    const items = code as unknown[];
    const first: unknown = items[0];
    return first && typeof first === "object" ? first : null;
  }
  if (typeof code === "object") {
    const obj = code as Record<string, unknown>;
    if (obj._protocol_set_) return obj;
    if (obj.protocol_json && typeof obj.protocol_json === "object") {
      return obj.protocol_json;
    }
  }
  return null;
}

interface SeriesGroup {
  subProtocol: string | undefined;
  light: number;
  records: OutputRecord[];
}

function groupOutputs(outputs: OutputRecord[]): SeriesGroup[] {
  const groups = new Map<string, SeriesGroup>();
  for (const r of outputs) {
    const key = `${r.sub_protocol ?? ""}::${r.light}`;
    let group = groups.get(key);
    if (!group) {
      group = { subProtocol: r.sub_protocol, light: r.light, records: [] };
      groups.set(key, group);
    }
    group.records.push(r);
  }
  return Array.from(groups.values());
}

function buildDetectorTraces(groups: SeriesGroup[]): Partial<PlotData>[] {
  const traces: Partial<PlotData>[] = [];
  for (const g of groups) {
    let min = Infinity;
    let max = -Infinity;
    for (const r of g.records) {
      if (r.value < min) min = r.value;
      if (r.value > max) max = r.value;
    }
    const range = max - min || 1;
    const x: number[] = [];
    const y: number[] = [];
    for (const r of g.records) {
      x.push(r.timestamp_us / 1e6);
      y.push((r.value - min) / range);
    }
    const ledLabel = LED_NAMES[g.light] ?? `LED ${g.light}`;
    const rangeText = `[${Math.round(min)}-${Math.round(max)}]`;
    const name = g.subProtocol
      ? `${g.subProtocol} · ${ledLabel} ${rangeText}`
      : `${ledLabel} ${rangeText}`;
    const color = LED_COLORS[g.light] ?? "#005E5E";
    const trace = {
      type: "scatter",
      mode: "markers",
      x,
      y,
      name,
      yaxis: "y",
      marker: { size: 3, color, opacity: 0.7 },
      legendgroup: "detectors",
      legendgrouptitle: { text: "Detectors" },
      hovertemplate: `<b>%{fullData.name}</b><br>t=%{x:.3f}s<br>norm=%{y:.3f}<extra></extra>`,
    } as unknown as Partial<PlotData>;
    traces.push(trace);
  }
  return traces;
}

/**
 * Plotly's background `shapes` don't appear in the legend on their own. Add
 * lightweight ghost traces — one per unique (LED, brightness) combo — that
 * carry the colour swatch and the brightness value as a legend label, with
 * `[NaN]` data so nothing actually plots.
 */
function buildLightLegendTraces(inputs: InputRecord[]): Partial<PlotData>[] {
  // Collapse to one legend entry per (LED, light_type), reporting the min-max
  // brightness range across all phases for that LED.
  const groups = new Map<string, { led: number; lightType: string; min: number; max: number }>();
  for (const r of inputs) {
    if (r.light_type !== "actinic" && r.light_type !== "pre_illumination") continue;
    if (r.led == null || r.brightness == null) continue;
    const key = `${r.light_type}-${r.led}`;
    const existing = groups.get(key);
    if (!existing) {
      groups.set(key, {
        led: r.led,
        lightType: r.light_type,
        min: r.brightness,
        max: r.brightness,
      });
    } else {
      if (r.brightness < existing.min) existing.min = r.brightness;
      if (r.brightness > existing.max) existing.max = r.brightness;
    }
  }
  const traces: Partial<PlotData>[] = [];
  for (const { led, lightType, min, max } of groups.values()) {
    const ledLabel = LED_NAMES[led] ?? `LED ${led}`;
    const tag = lightType === "pre_illumination" ? "pre-illum" : "actinic";
    const rangeText = min === max ? `${min}` : `${min}-${max}`;
    const name = `${ledLabel} (${tag}) [${rangeText} µmol]`;
    const color = LED_COLORS[led] ?? "#1976d2";
    const trace = {
      type: "scatter",
      mode: "markers",
      x: [NaN],
      y: [NaN],
      name,
      marker: { size: 10, color, symbol: "square", opacity: 0.6 },
      legendgroup: "lights",
      legendgrouptitle: { text: "Lights" },
      hoverinfo: "skip",
      showlegend: true,
    } as unknown as Partial<PlotData>;
    traces.push(trace);
  }
  return traces;
}

function buildShapes(inputs: InputRecord[], totalDurationS: number): Partial<Shape>[] {
  const shapes: Partial<Shape>[] = [];
  for (const r of inputs) {
    if (r.light_type !== "actinic" && r.light_type !== "pre_illumination") continue;
    if (r.led == null) continue;
    const color = LED_COLORS[r.led] ?? "#1976d2";
    // Right axis (yaxis2) carries the actinic light scale in µmol m⁻² s⁻¹.
    // Phases without a resolved brightness fall back to 500, matching the
    // matplotlib notebook's `r.brightness if r.brightness is not None else 500`.
    const brightness = r.brightness ?? 500;
    shapes.push({
      type: "rect",
      xref: "x",
      yref: "y2",
      x0: r.t_start_us / 1e6,
      x1: r.t_end_us / 1e6,
      y0: 0,
      y1: brightness,
      fillcolor: color,
      opacity: 0.15,
      line: { color, width: 0 },
      layer: "below",
    });
  }
  // Sub-protocol boundary lines on the (left) normalised axis.
  const boundaries = new Set<number>();
  for (const r of inputs) {
    if (r.light_type === "actinic" || r.light_type === "measuring") {
      boundaries.add(r.t_start_us / 1e6);
    }
  }
  const sorted = Array.from(boundaries).sort((a, b) => a - b);
  for (let i = 1; i < sorted.length; i++) {
    shapes.push({
      type: "line",
      xref: "x",
      yref: "y",
      x0: sorted[i],
      x1: sorted[i],
      y0: 0,
      y1: 1,
      line: { color: "#CDD5DB", width: 0.5, dash: "dot" },
      layer: "below",
    });
  }
  if (totalDurationS > 0) {
    // Sentinel so the x-axis range covers the full timeline even when traces
    // end short of it.
    shapes.push({
      type: "line",
      xref: "x",
      yref: "y",
      x0: totalDurationS,
      x1: totalDurationS,
      y0: 0,
      y1: 0,
      line: { color: "transparent", width: 0 },
    });
  }
  return shapes;
}

function buildAnnotations(inputs: InputRecord[], totalDurationS: number) {
  const byLabel = new Map<string, { start: number; end: number }>();
  for (const r of inputs) {
    if (!r.sub_protocol) continue;
    const span = byLabel.get(r.sub_protocol);
    const start = r.t_start_us / 1e6;
    const end = r.t_end_us / 1e6;
    if (!span) {
      byLabel.set(r.sub_protocol, { start, end });
    } else {
      span.start = Math.min(span.start, start);
      span.end = Math.max(span.end, end);
    }
  }
  const minSeparation = totalDurationS * 0.04;
  const lanes: number[] = [];
  const entries = Array.from(byLabel.entries()).sort((a, b) => a[1].start - b[1].start);
  return entries.map(([label, span]) => {
    const x = (span.start + span.end) / 2;
    let lane = 0;
    while (lane < lanes.length && x - (lanes[lane] ?? -Infinity) < minSeparation) lane++;
    lanes[lane] = x;
    return {
      x,
      y: 1.04 + lane * 0.05,
      xref: "x" as const,
      yref: "y" as const,
      text: label,
      showarrow: false,
      font: { size: 10, color: "#68737B" },
      bgcolor: "rgba(255,255,255,0.85)",
    };
  });
}

function maxBrightness(inputs: InputRecord[]): number {
  let max = 0;
  for (const r of inputs) {
    if (r.light_type !== "actinic" && r.light_type !== "pre_illumination") continue;
    const b = r.brightness ?? 500;
    if (b > max) max = b;
  }
  return max;
}

export function OutputCellTimeseries({
  data,
  protocolCode,
  loading,
  emptyLabel,
  errorLabel,
}: OutputCellTimeseriesProps) {
  const { t } = useTranslation("workbook");

  const decoded = useMemo(() => {
    const measurement = extractMeasurement(data);
    const protocolJson = pickProtocolJson(protocolCode);
    if (!measurement || !protocolJson) return null;
    try {
      return measurementToTimeseries(measurement, protocolJson);
    } catch {
      return null;
    }
  }, [data, protocolCode]);

  if (loading) {
    return (
      <div className="flex h-[960px] items-center justify-center rounded-lg border border-[#EDF2F6] bg-[#F7F8FA] text-xs text-[#68737B]">
        {t("output.loadingProtocol")}
      </div>
    );
  }

  if (!decoded) {
    return (
      <div className="flex h-[120px] items-center justify-center rounded-lg border border-[#EDF2F6] bg-[#F7F8FA] text-xs text-[#68737B]">
        {errorLabel}
      </div>
    );
  }

  const groups = groupOutputs(decoded.outputs);
  if (groups.length === 0) {
    return (
      <div className="flex h-[120px] items-center justify-center rounded-lg border border-[#EDF2F6] bg-[#F7F8FA] text-xs text-[#68737B]">
        {emptyLabel}
      </div>
    );
  }

  const inputEndS = decoded.inputs.reduce((m, r) => Math.max(m, r.t_end_us / 1e6), 0);
  const totalDurationS = Math.max(inputEndS, decoded.totalDurationUs / 1e6);
  const detectorTraces = buildDetectorTraces(groups);
  const lightLegendTraces = buildLightLegendTraces(decoded.inputs);
  const traces: Partial<PlotData>[] = detectorTraces.concat(lightLegendTraces);
  const shapes = buildShapes(decoded.inputs, totalDurationS);
  const annotations = buildAnnotations(decoded.inputs, totalDurationS);
  const yaxis2Max = Math.max(maxBrightness(decoded.inputs) * 1.2, 1000);

  const layout: Partial<Layout> = {
    // PlotlyChart's wrapper only honours autosize when the layout opts in;
    // without this, it falls back to a fixed default width (~700 px) and the
    // chart leaves blank space on the right of its container.
    autosize: true,
    // Big bottom margin reserves the band the multi-column legend occupies.
    // Plot area = container_height - top - bottom, so this directly trades
    // legend height vs y-axis height.
    margin: { l: 60, r: 70, t: 30, b: 220 },
    xaxis: {
      title: { text: t("output.timeseriesXAxis"), font: { size: 12 } },
      gridcolor: "#EDF2F6",
      zeroline: false,
      automargin: false,
    },
    yaxis: {
      title: { text: t("output.timeseriesYAxis"), font: { size: 12 } },
      gridcolor: "#EDF2F6",
      zeroline: false,
      range: [-0.05, 1.1],
      automargin: false,
    },
    yaxis2: {
      title: { text: t("output.timeseriesActinic"), font: { size: 12, color: "#68737B" } },
      overlaying: "y",
      side: "right",
      range: [0, yaxis2Max],
      showgrid: false,
      zeroline: false,
      tickfont: { color: "#68737B" },
      automargin: false,
    },
    shapes,
    annotations,
    hovermode: "closest",
    showlegend: true,
    // `entrywidth` + `orientation: "h"` packs items into rows of fixed pixel
    // width; without it, Plotly's horizontal mode stacks one item per row when
    // label text is long. The two `entrywidth*` keys exist in Plotly.js runtime
    // but are missing from @types/plotly.js, so cast through to bypass the type.
    legend: {
      orientation: "h",
      xanchor: "left",
      x: 0,
      yanchor: "top",
      y: -0.12,
      font: { size: 10 },
      tracegroupgap: 16,
      entrywidth: 240,
      entrywidthmode: "pixels",
    } as Partial<Layout["legend"]>,
    plot_bgcolor: "#FFFFFF",
    paper_bgcolor: "#FFFFFF",
  };

  return (
    <div className="h-[820px] w-full overflow-hidden rounded-lg border border-[#EDF2F6] bg-white">
      <PlotlyChart
        data={traces}
        layout={layout}
        config={{
          displayModeBar: true,
          responsive: true,
          displaylogo: false,
          toImageButtonOptions: { format: "png", filename: "multispeq-timeseries" },
        }}
      />
    </div>
  );
}
