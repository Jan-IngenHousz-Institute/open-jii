"use client";

import { PlotlyChart } from "@/components/charts/plotly-chart";
import { InsetPanel } from "@/components/shared/inset-panel";
import { useIsDarkTheme } from "@/hooks/useIsDarkTheme";
import { deriveFluorescence } from "@/lib/ambit/fluorescence";
import { decodeAmbitTraces } from "@/lib/ambit/timeseries";
import type { AmbitSeries } from "@/lib/ambit/timeseries";
import { useMemo, useState } from "react";

import { useTranslation } from "@repo/i18n";
import { Card } from "@repo/ui/components/card";
import { readThemeColor } from "@repo/ui/components/charts/utils";

const CHANNEL_KEYS = {
  fluorescence: "output.ambitChannels.fluorescence",
  fluo_630_signal: "output.ambitChannels.fluo_630_signal",
  fluo_630_ref: "output.ambitChannels.fluo_630_ref",
  refl_730_signal: "output.ambitChannels.refl_730_signal",
  refl_730_ref: "output.ambitChannels.refl_730_ref",
  ambient_sun_vis: "output.ambitChannels.ambient_sun_vis",
  ambient_leaf_ir: "output.ambitChannels.ambient_leaf_ir",
  leaf_temp: "output.ambitChannels.leaf_temp",
} as const;

function AmbitSeriesChart({ series }: { series: AmbitSeries }) {
  const { t } = useTranslation("workbook");
  const key = Object.hasOwn(CHANNEL_KEYS, series.name)
    ? CHANNEL_KEYS[series.name as keyof typeof CHANNEL_KEYS]
    : undefined;
  const title = key ? t(key) : series.name;
  const unit =
    series.unit === "Cel" ? "°C" : series.unit === "count" ? t("output.ambitCounts") : series.unit;
  const axis = series.unit === "ratio" ? t("output.ambitRatioAxis") : `${title} (${unit})`;
  const name = series.estimatedTime ? `${title} (${t("output.estimatedTime")})` : title;
  if (series.values.length === 1) {
    return (
      <InsetPanel className="text-sm">
        <span className="font-medium">
          {name}: {series.values[0]} {unit}
        </span>
        <span className="text-muted-foreground ml-2">
          {t("output.ambitSingleReading", { time: series.time[0] })}
        </span>
      </InsetPanel>
    );
  }
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h5 className="text-sm font-medium">{name}</h5>
        <span className="text-muted-foreground text-xs">
          {t("output.ambitReadings", { count: series.values.length })}
        </span>
      </div>
      <Card padding="none" className="h-[320px] w-full overflow-hidden">
        <PlotlyChart
          data={[
            {
              type: "scattergl",
              mode: "lines+markers",
              name,
              x: series.time,
              y: series.values,
              connectgaps: false,
              marker: { size: 3 },
              line: { width: 1.5 },
            },
          ]}
          layout={{
            autosize: true,
            margin: { l: 85, r: 25, t: 25, b: 65 },
            xaxis: {
              title: { text: t("output.timeseriesXAxis") },
              autorange: true,
              zeroline: false,
            },
            yaxis: { title: { text: axis }, autorange: true, zeroline: false },
            showlegend: false,
            hovermode: "closest",
            plot_bgcolor: readThemeColor("--card") ?? "transparent",
            paper_bgcolor: readThemeColor("--card") ?? "transparent",
            font: { color: readThemeColor("--foreground") ?? undefined },
          }}
          config={{
            responsive: true,
            displaylogo: false,
            toImageButtonOptions: { format: "png", filename: `ambit-${series.name}` },
          }}
        />
      </Card>
    </div>
  );
}

function RawChannels({ series, initiallyOpen }: { series: AmbitSeries[]; initiallyOpen: boolean }) {
  const { t } = useTranslation("workbook");
  const [open, setOpen] = useState(initiallyOpen);
  return (
    <details
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
      className="space-y-4"
    >
      <summary className="cursor-pointer text-sm font-medium">
        {t("output.ambitRawChannels")}
      </summary>
      {open && (
        <div className="space-y-4">
          {series.map((item) => (
            <AmbitSeriesChart key={item.name} series={item} />
          ))}
        </div>
      )}
    </details>
  );
}

export function OutputCellAmbitTimeseries({ data }: { data: unknown }) {
  const { t } = useTranslation("workbook");
  useIsDarkTheme();
  const traces = useMemo(() => decodeAmbitTraces(data), [data]);
  return (
    <div className="space-y-6">
      {traces.map((trace, index) => {
        const fluorescence = deriveFluorescence(trace.series);
        const optical = trace.series.filter((series) => series.unit === "count");
        const environmental = trace.series.filter((series) => series.unit !== "count");
        return (
          <section
            key={index}
            className="space-y-4"
            aria-label={`${t("output.ambitTrace")} ${trace.label}`}
          >
            <h4 className="text-sm font-medium">
              {t("output.ambitTrace")} {trace.label}
            </h4>
            {trace.problems.map((problem, i) => (
              <InsetPanel key={i} className="text-muted-foreground text-xs">
                {problem.series && <span className="font-medium">{problem.series}: </span>}
                {t(`output.ambitProblems.${problem.reason}`)}
              </InsetPanel>
            ))}
            {fluorescence.status === "available" ? (
              <>
                <AmbitSeriesChart series={fluorescence.series} />
                <p className="text-muted-foreground text-xs">{t("output.ambitRatioExplanation")}</p>
                {fluorescence.filledReferences > 0 && (
                  <InsetPanel className="text-muted-foreground text-xs">
                    {t("output.ambitReferenceFilled", { count: fluorescence.filledReferences })}
                  </InsetPanel>
                )}
              </>
            ) : optical.length > 0 ? (
              <InsetPanel className="text-muted-foreground text-xs">
                {t(`output.ambitRatioUnavailable.${fluorescence.status}`)}
              </InsetPanel>
            ) : null}
            {environmental.map((series) => (
              <AmbitSeriesChart key={series.name} series={series} />
            ))}
            {optical.length > 0 && (
              <RawChannels
                key={fluorescence.status}
                series={optical}
                initiallyOpen={fluorescence.status !== "available"}
              />
            )}
          </section>
        );
      })}
    </div>
  );
}
