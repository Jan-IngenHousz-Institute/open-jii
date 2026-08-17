"use client";

import { useLocale } from "@/hooks/useLocale";
import { formatDateTime, formatRelativeTime } from "@/util/date";

import type { DeviceMonitoring } from "@repo/api/domains/iot/iot.schema";
import { useTranslation } from "@repo/i18n";
import { BarChart } from "@repo/ui/components/charts/bar-chart";

import type { BucketAvailability } from "./availability-strip";
import { buildAvailabilitySlices, deriveOutages } from "./availability-strip";
import { formatDurationShort } from "./format-duration";
import { bucketAxis } from "./monitoring-buckets";

const MAX_LISTED_OUTAGES = 5;

// Availability is device state, so it wears the status palette, never the
// categorical series colors.
const STATE_COLOR: Record<BucketAvailability, string> = {
  up: "#10b981",
  partial: "#f59e0b",
  down: "#f43f5e",
  unknown: "#d4d4d8",
};

interface AvailabilityPanelProps {
  monitoring: DeviceMonitoring;
  from: string;
  to: string;
}

/**
 * Availability as discrete slices on the same time axis as the data-flow
 * chart below, so a measurement gap reads against connectivity.
 */
export function AvailabilityPanel({ monitoring, from, to }: AvailabilityPanelProps) {
  const { t } = useTranslation("iot");
  const locale = useLocale();

  const axis = bucketAxis(from, to, monitoring.bucket);
  const slices = buildAvailabilitySlices(monitoring, axis, to);
  const outages = deriveOutages(monitoring, from, to);
  const listedOutages = outages.slice(0, MAX_LISTED_OUTAGES);

  const uptimeLabel =
    monitoring.uptimePercent === null
      ? t("iot.devices.monitoring.uptimeUnknown")
      : `${monitoring.uptimePercent.toFixed(monitoring.uptimePercent >= 99.95 ? 2 : 1)}%`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-3xl font-semibold tabular-nums">{uptimeLabel}</p>
          <p className="text-muted-foreground text-xs">
            {t("iot.devices.monitoring.uptimeWindow", {
              from: formatDateTime(from, locale),
              to: formatDateTime(to, locale),
            })}
          </p>
        </div>
        <div className="flex gap-6 text-sm">
          <Stat label={t("iot.devices.monitoring.outages")} value={outages.length} />
          <Stat label={t("iot.devices.monitoring.sessions")} value={monitoring.sessions.length} />
        </div>
      </div>

      {/* Tall enough for the date axis: the chart layer reserves the tick band
          via automargin, and a squat container swallows it. */}
      <div className="h-52 w-full">
        <BarChart
          bargap={0.05}
          data={[
            {
              name: t("iot.devices.monitoring.availability"),
              x: slices.map((slice) => slice.start),
              // Bar height is the share of the bucket spent online.
              y: slices.map((slice) => Math.round(slice.onlineRatio * 100)),
              marker: { color: slices.map((slice) => STATE_COLOR[slice.state]) },
              text: slices.map((slice) =>
                t(`iot.devices.monitoring.legend${stateSuffix(slice.state)}`),
              ),
              hovertemplate: "%{x}<br>%{text} · %{y}%<extra></extra>",
            },
          ]}
          config={{
            showLegend: false,
            showModeBar: true,
            modeBarStyle: "transparent",
            xAxisType: "date",
            yAxisType: "linear",
            yAxisTitle: t("iot.devices.monitoring.onlineShare"),
          }}
        />
      </div>

      <div className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {(["up", "partial", "down", "unknown"] as const).map((state) => (
          <span key={state} className="flex items-center gap-1.5">
            <span
              className="h-2 w-2 rounded-sm"
              style={{ backgroundColor: STATE_COLOR[state] }}
              aria-hidden
            />
            {t(`iot.devices.monitoring.legend${stateSuffix(state)}`)}
          </span>
        ))}
      </div>

      {listedOutages.length > 0 && (
        <div className="rounded-lg border">
          <p className="border-b px-3 py-2 text-xs font-medium">
            {t("iot.devices.monitoring.outageList")}
          </p>
          <ul className="divide-y">
            {listedOutages.map((outage) => (
              <li
                key={outage.start}
                className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-xs"
              >
                <span className="tabular-nums">{formatRelativeTime(outage.start, locale)}</span>
                <span className="font-mono">{outage.reason ?? "-"}</span>
                <span className="tabular-nums">{formatDurationShort(outage.durationSeconds)}</span>
              </li>
            ))}
          </ul>
          {outages.length > listedOutages.length && (
            <p className="text-muted-foreground border-t px-3 py-2 text-xs">
              {t("iot.devices.monitoring.moreOutages", {
                count: outages.length - listedOutages.length,
              })}
            </p>
          )}
        </div>
      )}

      {monitoring.truncated && (
        <p className="text-muted-foreground text-xs">{t("iot.devices.monitoring.truncated")}</p>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-right">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="font-medium tabular-nums">{value}</p>
    </div>
  );
}

function stateSuffix(state: BucketAvailability): string {
  return state.charAt(0).toUpperCase() + state.slice(1);
}
