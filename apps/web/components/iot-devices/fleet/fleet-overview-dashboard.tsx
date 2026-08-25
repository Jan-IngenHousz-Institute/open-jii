"use client";

import { EventLog } from "@/components/iot-devices/monitoring/event-log";
import type {
  MonitoringPresetId,
  MonitoringRange,
} from "@/components/iot-devices/monitoring/monitoring-range";
import { resolveMonitoringPreset } from "@/components/iot-devices/monitoring/monitoring-range";
import { MonitoringRangeControl } from "@/components/iot-devices/monitoring/monitoring-range-control";
import { PanelCard } from "@/components/iot-devices/monitoring/panel-card";
import { Tile } from "@/components/iot-devices/monitoring/tile";
import { useIotDevices } from "@/hooks/iot/useIotDevices/useIotDevices";
import { useIotFleetMonitoring } from "@/hooks/iot/useIotFleetMonitoring/useIotFleetMonitoring";
import { useLocale } from "@/hooks/useLocale";
import { formatRelativeTime } from "@/util/date";
import { resolveDeviceLabel } from "@/util/device-presentation";
import { AlertTriangle } from "lucide-react";
import { useState } from "react";

import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import { EmptyState } from "@repo/ui/components/empty-state";
import { Skeleton } from "@repo/ui/components/skeleton";

import { buildGroupActivity } from "../groups/group-activity";
import { summarizeGroupHealth } from "../groups/group-health";
import { GroupThroughputPanel } from "../groups/group-throughput-panel";
import { bucketAxis } from "../monitoring/monitoring-buckets";
import { FleetAttentionList } from "./fleet-attention-list";
import { fleetAttention, foldSparkValues, toFleetHealth } from "./fleet-health";
import { FleetSparkline } from "./fleet-sparkline";

const DEFAULT_PRESET: MonitoringPresetId = "last24h";

interface RangeSelection {
  range: MonitoringRange;
  preset: MonitoringPresetId | null;
}

/**
 * The overview's frame: pulse tiles up top, the registry (as children) in
 * the middle, and the warehouse panels below, all driven by one range. Is the
 * fleet online, is data flowing,
 * and which devices are stuck. Live facts come from the device list the page
 * already holds; the warehouse facts ride one fleet-scoped read. The hero
 * sits directly on the workspace band, its tiles floating as cards.
 */
export function FleetOverviewDashboard({ children }: { children?: React.ReactNode }) {
  const { t } = useTranslation("iot");
  const locale = useLocale();

  const [selection, setSelection] = useState<RangeSelection>(() => ({
    range: resolveMonitoringPreset(DEFAULT_PRESET),
    preset: DEFAULT_PRESET,
  }));

  const { data: devicesData } = useIotDevices();
  const devices = devicesData ?? [];

  const {
    data: monitoring,
    isFetching,
    isError,
    refetch,
  } = useIotFleetMonitoring(selection.range, { enabled: devices.length > 0 });

  // An empty registry is the table's full-page empty state; a pulse over
  // nothing would just restate it.
  if (devicesData !== undefined && devices.length === 0) {
    return <>{children}</>;
  }

  const now = Date.now();
  const activity = monitoring?.devices ?? [];
  // Warehouse facts unknown count as unavailable: silence is never claimed
  // from missing data.
  const pipelineUnavailable = monitoring?.pipelineUnavailable ?? true;

  const health = toFleetHealth(devices, activity);
  const summary =
    devicesData === undefined ? undefined : summarizeGroupHealth(health, pipelineUnavailable, now);
  const attention =
    devicesData === undefined
      ? undefined
      : fleetAttention(devices, activity, pipelineUnavailable, now);

  const freshest = health.reduce<string | null>(
    (latest, member) =>
      member.lastDataAt !== null && (latest === null || member.lastDataAt > latest)
        ? member.lastDataAt
        : latest,
    null,
  );

  const total =
    monitoring === undefined
      ? undefined
      : monitoring.throughput.reduce((sum, bucket) => sum + bucket.count, 0);
  // Fractional hours: truncating would misstate the rate on sub-day windows.
  const windowMs =
    new Date(selection.range.to).getTime() - new Date(selection.range.from).getTime();
  const windowHours = Math.max(1, windowMs / 3_600_000);
  const perHour = total === undefined ? undefined : total / windowHours;

  const sparkValues =
    monitoring === undefined
      ? []
      : foldSparkValues(
          monitoring.throughput,
          bucketAxis(selection.range.from, selection.range.to, selection.range.bucket),
        );

  const labels = new Map(devices.map((device) => [device.id, resolveDeviceLabel(device, t)]));

  const handleRangeChange = (range: MonitoringRange, preset: MonitoringPresetId | null) => {
    setSelection({ range, preset });
  };

  function lastDataLine(unavailable: boolean): string {
    if (unavailable) {
      return t("iot.devices.monitoring.lastDataUnavailable");
    }
    if (freshest === null) {
      return t("iot.groups.monitoring.noData");
    }
    return formatRelativeTime(freshest, locale);
  }

  function renderTiles() {
    return (
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label={t("iot.devices.fleet.onlineLabel")} className="bg-card">
          {summary === undefined ? (
            <Skeleton className="h-4 w-24" />
          ) : (
            <div className="space-y-1">
              <p className="text-lg font-semibold">
                {t("iot.groups.monitoring.onlineValue", {
                  online: summary.online,
                  total: summary.total,
                })}
              </p>
              {summary.silent > 0 && (
                <p className="flex items-center gap-1 text-xs font-normal text-amber-600 dark:text-amber-500">
                  <AlertTriangle className="h-3 w-3" />
                  {t("iot.groups.monitoring.silentCount", { count: summary.silent })}
                </p>
              )}
            </div>
          )}
        </Tile>

        <Tile label={t("iot.devices.monitoring.lastData")} className="bg-card">
          {monitoring === undefined ? (
            <Skeleton className="h-4 w-24" />
          ) : (
            <p className="text-lg font-semibold">{lastDataLine(monitoring.pipelineUnavailable)}</p>
          )}
        </Tile>

        <Tile label={t("iot.devices.monitoring.measurements")} className="bg-card">
          {total === undefined || perHour === undefined ? (
            <Skeleton className="h-4 w-16" />
          ) : (
            <div className="space-y-1">
              <p className="text-lg font-semibold tabular-nums">{total.toLocaleString(locale)}</p>
              <p className="text-muted-foreground text-xs font-normal tabular-nums">
                {t("iot.devices.monitoring.perHour", {
                  rate: perHour.toLocaleString(locale, {
                    minimumFractionDigits: 1,
                    maximumFractionDigits: 1,
                  }),
                })}
              </p>
              <FleetSparkline values={sparkValues} />
            </div>
          )}
        </Tile>

        <Tile label={t("iot.devices.fleet.attentionLabel")} className="bg-card">
          {attention === undefined ? (
            <Skeleton className="h-4 w-16" />
          ) : (
            <p className="text-lg font-semibold tabular-nums">{attention.length}</p>
          )}
        </Tile>
      </div>
    );
  }

  function renderWarehousePanels() {
    if (isError) {
      return (
        <EmptyState
          variant="error"
          description={t("iot.devices.fleet.loadError")}
          action={
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                void refetch();
              }}
            >
              {t("iot.onboarding.retry")}
            </Button>
          }
        />
      );
    }
    if (monitoring === undefined) {
      return <Skeleton className="h-64 w-full rounded-xl" />;
    }
    return (
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="flex min-w-0 lg:col-span-2">
          <PanelCard
            title={t("iot.devices.fleet.throughputTitle")}
            className="flex w-full flex-col"
            contentClassName="flex flex-1 flex-col"
          >
            <GroupThroughputPanel
              throughput={monitoring.throughput}
              labelByDeviceId={labels}
              range={selection.range}
              locale={locale}
            />
          </PanelCard>
        </div>
        <div className="min-w-0 space-y-4">
          <PanelCard
            title={t("iot.devices.fleet.attentionTitle")}
            description={t("iot.devices.fleet.attentionHint")}
          >
            <FleetAttentionList entries={attention ?? []} />
          </PanelCard>
          <PanelCard title={t("iot.devices.fleet.eventsTitle")}>
            <EventLog
              entries={buildGroupActivity(
                monitoring.events,
                labels,
                t("iot.groups.monitoring.unknownMember"),
              )}
            />
          </PanelCard>
        </div>
      </div>
    );
  }

  return (
    <section className="space-y-10">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-medium">{t("iot.devices.fleet.title")}</h2>
            <p className="text-muted-foreground text-sm">{t("iot.devices.fleet.description")}</p>
          </div>
          <MonitoringRangeControl
            range={selection.range}
            activePreset={selection.preset}
            onRangeChange={handleRangeChange}
            isUpdating={isFetching}
          />
        </div>
        {renderTiles()}
      </div>

      {children}

      {renderWarehousePanels()}
    </section>
  );
}
