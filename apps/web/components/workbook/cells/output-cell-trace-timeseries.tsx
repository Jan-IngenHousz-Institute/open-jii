"use client";

import type { NormalizedTracePayload, NormalizedTraceRun } from "@/lib/trace-v3";
import { useMemo } from "react";

import { useTranslation } from "@repo/i18n";
import { PlotlyChart } from "@repo/ui/components/charts/plotly-chart";
import type { Layout, PlotData } from "@repo/ui/components/charts/types";

const SERIES_COLORS = ["#005E5E", "#1976D2", "#D97706", "#7C3AED", "#D14343", "#0F766E"];
const RANGE_PADDING_FRACTION = 0.01;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function startUtcOf(trace: Record<string, unknown>): number | undefined {
  if (!isRecord(trace.time)) return undefined;
  return typeof trace.time.start_utc === "number" && Number.isFinite(trace.time.start_utc)
    ? trace.time.start_utc
    : undefined;
}

function durationSecondsOf(trace: Record<string, unknown>): number | undefined {
  if (!isRecord(trace.time)) return undefined;
  const durationMs = trace.time.duration_ms;
  return typeof durationMs === "number" && Number.isFinite(durationMs) && durationMs >= 0
    ? durationMs / 1000
    : undefined;
}

function relativeTimeRange(traces: NormalizedTraceRun[]): [number, number] {
  let minimum = 0;
  let maximum = 0;

  for (const trace of traces) {
    const duration = durationSecondsOf(trace.trace);
    if (duration != null) {
      if (duration < minimum) minimum = duration;
      if (duration > maximum) maximum = duration;
    }
    for (const series of trace.series) {
      for (const point of series.relativeTimeSeconds) {
        if (point < minimum) minimum = point;
        if (point > maximum) maximum = point;
      }
    }
  }

  // Keep the accepted deterministic one-second fallback, then pad every
  // extent so boundary markers are fully inside Plotly's drawing area.
  if (minimum === maximum) maximum = minimum + 1;
  const padding = (maximum - minimum) * RANGE_PADDING_FRACTION;
  return [minimum - padding, maximum + padding];
}

function safeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-|-$/g, "") || "trace";
}

export function OutputCellTraceTimeseries({
  normalized,
  emptyLabel,
}: {
  normalized: NormalizedTracePayload;
  emptyLabel: string;
}) {
  const { t } = useTranslation("workbook");
  const sharedRange = useMemo(() => relativeTimeRange(normalized.traces), [normalized.traces]);
  const validSeriesCount = normalized.traces.reduce(
    (count, trace) => count + trace.series.length,
    0,
  );
  const invalidSeriesCount = normalized.traces.reduce(
    (count, trace) => count + trace.invalidSeriesCount,
    0,
  );

  if (validSeriesCount === 0) {
    return (
      <div
        className="flex min-h-[120px] flex-col items-center justify-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-4 text-center text-xs text-amber-800"
        role="alert"
      >
        <span>{emptyLabel}</span>
        {invalidSeriesCount > 0 && (
          <span>{t("output.timeseriesTraceInvalidSeries", { count: invalidSeriesCount })}</span>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="trace-timeseries">
      {normalized.traces.map((traceRun, runIndex) => {
        const startUtc = startUtcOf(traceRun.trace);
        const omittedPointCount = traceRun.series.reduce(
          (count, series) => count + series.omittedPointCount,
          0,
        );
        const runLabel = t("output.timeseriesTraceRun", { index: runIndex + 1 });

        return (
          <section
            key={traceRun.setIndex ?? runIndex}
            className="space-y-2"
            data-testid={`trace-run-${runIndex + 1}`}
          >
            {normalized.traces.length > 1 && (
              <h4 className="text-xs font-semibold text-[#011111]">{runLabel}</h4>
            )}
            {(omittedPointCount > 0 || traceRun.invalidSeriesCount > 0) && (
              <div
                className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800"
                role="alert"
              >
                {omittedPointCount > 0 && (
                  <span>
                    {t("output.timeseriesTraceOmittedPoints", { count: omittedPointCount })}
                  </span>
                )}
                {omittedPointCount > 0 && traceRun.invalidSeriesCount > 0 && <span> </span>}
                {traceRun.invalidSeriesCount > 0 && (
                  <span>
                    {t("output.timeseriesTraceInvalidSeries", {
                      count: traceRun.invalidSeriesCount,
                    })}
                  </span>
                )}
              </div>
            )}
            <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
              {traceRun.series.map((series, seriesIndex) => {
                const color = SERIES_COLORS[(runIndex * 3 + seriesIndex) % SERIES_COLORS.length];
                const absoluteUtc =
                  startUtc == null
                    ? undefined
                    : series.relativeTimeSeconds.map((seconds) =>
                        new Date(startUtc + seconds * 1000).toISOString(),
                      );
                const hoverUtc = absoluteUtc ? "<br>UTC=%{customdata}" : "";
                const onePoint = series.values.length === 1;
                const mode = onePoint
                  ? "markers"
                  : series.estimatedTime
                    ? "lines+markers"
                    : "lines";
                const plotData = {
                  type: "scatter",
                  mode,
                  x: series.relativeTimeSeconds,
                  y: series.values,
                  customdata: absoluteUtc,
                  name: normalized.traces.length > 1 ? `${runLabel} · ${series.name}` : series.name,
                  line: { color, width: 2, dash: series.estimatedTime ? "dash" : "solid" },
                  marker:
                    series.estimatedTime || onePoint
                      ? {
                          color,
                          size: onePoint ? 8 : 6,
                          symbol: series.estimatedTime ? "diamond-open" : "circle",
                          line: { color, width: 1 },
                        }
                      : undefined,
                  hovertemplate: `<b>${series.name}</b><br>t=%{x:.4f}s<br>value=%{y} ${series.unit}${hoverUtc}<extra></extra>`,
                } as unknown as Partial<PlotData>;
                const layout: Partial<Layout> = {
                  autosize: true,
                  margin: { l: 64, r: 20, t: series.estimatedTime ? 38 : 20, b: 54 },
                  xaxis: {
                    title: { text: t("output.timeseriesXAxis"), font: { size: 12 } },
                    gridcolor: "#EDF2F6",
                    zeroline: false,
                    automargin: true,
                    range: sharedRange,
                  },
                  yaxis: {
                    title: { text: series.unit, font: { size: 12 } },
                    gridcolor: "#EDF2F6",
                    zeroline: false,
                    automargin: true,
                  },
                  annotations: series.estimatedTime
                    ? [
                        {
                          text: t("output.timeseriesEstimatedTime"),
                          x: 1,
                          xref: "paper",
                          xanchor: "right",
                          y: 1.12,
                          yref: "paper",
                          showarrow: false,
                          font: { size: 10, color: "#D97706" },
                        },
                      ]
                    : undefined,
                  hovermode: "closest",
                  showlegend: false,
                  plot_bgcolor: "#FFFFFF",
                  paper_bgcolor: "#FFFFFF",
                };

                return (
                  <section
                    key={series.name}
                    className="overflow-hidden rounded-lg border border-[#EDF2F6] bg-white"
                    data-testid={`trace-run-${runIndex + 1}-series-${series.name}`}
                    data-estimated-time={series.estimatedTime ? "true" : "false"}
                  >
                    <div className="flex items-center gap-2 border-b border-[#EDF2F6] px-3 py-2">
                      <span className="min-w-0 truncate text-xs font-semibold text-[#011111]">
                        {series.name}
                      </span>
                      <span className="rounded bg-[#F7F8FA] px-1.5 py-0.5 text-[10px] text-[#68737B]">
                        {series.unit}
                      </span>
                      {series.estimatedTime && (
                        <span className="ml-auto rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                          {t("output.timeseriesEstimatedTime")}
                        </span>
                      )}
                    </div>
                    <div className="h-[300px] w-full">
                      <PlotlyChart
                        data={[plotData]}
                        layout={layout}
                        config={{
                          displayModeBar: true,
                          responsive: true,
                          displaylogo: false,
                          toImageButtonOptions: {
                            format: "png",
                            filename: `${safeFilename(
                              normalized.traces.length > 1
                                ? `${runLabel}-${series.name}`
                                : series.name,
                            )}-timeseries`,
                          },
                        }}
                      />
                    </div>
                  </section>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
