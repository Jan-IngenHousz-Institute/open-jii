"use client";

import { PlotlyChart } from "@/components/charts/plotly-chart";
import { InsetPanel } from "@/components/shared/inset-panel";
import { useIsDarkTheme } from "@/hooks/useIsDarkTheme";
import { decodeAmbitTraces } from "@/lib/ambit/timeseries";
import type { AmbitSeries } from "@/lib/ambit/timeseries";
import { useMemo } from "react";

import { useTranslation } from "@repo/i18n";
import { Card } from "@repo/ui/components/card";
import type { PlotData } from "@repo/ui/components/charts/types";
import { readThemeColor } from "@repo/ui/components/charts/utils";

function groupByUnit(series: AmbitSeries[]) {
  const groups = new Map<string, AmbitSeries[]>();
  for (const item of series) {
    const group = groups.get(item.unit) ?? [];
    group.push(item);
    groups.set(item.unit, group);
  }
  return groups;
}

export function OutputCellAmbitTimeseries({ data }: { data: unknown }) {
  const { t } = useTranslation("workbook");
  useIsDarkTheme();
  const traces = useMemo(() => decodeAmbitTraces(data), [data]);
  return (
    <div className="space-y-4">
      {traces.map((trace, index) => (
        <section
          key={index}
          className="space-y-2"
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
          {Array.from(groupByUnit(trace.series), ([unit, series]) => {
            const chartData: Partial<PlotData>[] = series.map((item) => ({
              type: "scattergl",
              mode: "lines+markers",
              name: item.estimatedTime ? `${item.name} (${t("output.estimatedTime")})` : item.name,
              x: item.time,
              y: item.values,
              connectgaps: false,
              marker: { size: 3 },
              line: { width: 1 },
            }));
            return (
              <Card key={unit} padding="none" className="h-[400px] w-full overflow-hidden">
                <PlotlyChart
                  data={chartData}
                  layout={{
                    autosize: true,
                    margin: { l: 70, r: 25, t: 25, b: 95 },
                    xaxis: { title: { text: t("output.timeseriesXAxis") }, autorange: true },
                    yaxis: { title: { text: unit === "Cel" ? "°C" : unit }, autorange: true },
                    showlegend: true,
                    legend: { orientation: "h", y: -0.2 },
                    hovermode: "closest",
                    plot_bgcolor: readThemeColor("--card") ?? "transparent",
                    paper_bgcolor: readThemeColor("--card") ?? "transparent",
                    font: { color: readThemeColor("--foreground") ?? undefined },
                  }}
                  config={{
                    responsive: true,
                    displaylogo: false,
                    toImageButtonOptions: { format: "png", filename: `ambit-trace-${index + 1}` },
                  }}
                />
              </Card>
            );
          })}
        </section>
      ))}
    </div>
  );
}
