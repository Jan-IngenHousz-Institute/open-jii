"use client";

import { AvailabilityPanel } from "@/components/iot-devices/monitoring/availability-panel";
import { BatteryPanel } from "@/components/iot-devices/monitoring/battery-panel";
import { DataByExperiment } from "@/components/iot-devices/monitoring/data-by-experiment";
import { buildDeviceActivity } from "@/components/iot-devices/monitoring/device-activity";
import { EventLog } from "@/components/iot-devices/monitoring/event-log";
import { MeasurementValuesTable } from "@/components/iot-devices/monitoring/measurement-values-table";
import type {
  MonitoringPresetId,
  MonitoringRange,
} from "@/components/iot-devices/monitoring/monitoring-range";
import { resolveMonitoringPreset } from "@/components/iot-devices/monitoring/monitoring-range";
import { MonitoringRangeControl } from "@/components/iot-devices/monitoring/monitoring-range-control";
import { MonitoringTiles } from "@/components/iot-devices/monitoring/monitoring-tiles";
import { PanelCard } from "@/components/iot-devices/monitoring/panel-card";
import { PayloadProfile } from "@/components/iot-devices/monitoring/payload-profile";
import { ThroughputPanel } from "@/components/iot-devices/monitoring/throughput-panel";
import { useDeviceExperiments } from "@/hooks/iot/useDeviceExperiments/useDeviceExperiments";
import { useDeviceMonitoring } from "@/hooks/iot/useDeviceMonitoring/useDeviceMonitoring";
import { useIotDevice } from "@/hooks/iot/useIotDevice/useIotDevice";
import { useIotDeviceActivity } from "@/hooks/iot/useIotDeviceActivity/useIotDeviceActivity";
import { useLocale } from "@/hooks/useLocale";
import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { useState } from "react";

import type { DeviceMonitoring } from "@repo/api/domains/iot/iot.schema";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import { Card, CardContent } from "@repo/ui/components/card";
import { Skeleton } from "@repo/ui/components/skeleton";
import { cn } from "@repo/ui/lib/utils";

const CONNECTIVITY_POLL_MS = 15_000;
const DEFAULT_PRESET: MonitoringPresetId = "last24h";

function hasBatteryReadings(monitoring: DeviceMonitoring): boolean {
  return monitoring.battery.some((point) => point.averageBattery !== null);
}

interface RangeSelection {
  range: MonitoringRange;
  preset: MonitoringPresetId | null;
}

/**
 * The device monitoring dashboard, ordered the way an operator reads it: is it
 * healthy right now, was it available over the window, did data flow, where
 * did it land, what did it carry, and finally the raw record. Every
 * time-series panel shares the one selected range, so a gap in one panel lines
 * up with the gap above it.
 */
export default function DeviceMonitoringPage() {
  const { t } = useTranslation("iot");
  const locale = useLocale();
  const params = useParams<{ deviceId: string }>();
  const deviceId = params.deviceId;

  const [selection, setSelection] = useState<RangeSelection>(() => ({
    range: resolveMonitoringPreset(DEFAULT_PRESET),
    preset: DEFAULT_PRESET,
  }));

  const { data: device } = useIotDevice(deviceId, { refetchInterval: CONNECTIVITY_POLL_MS });
  const { data: activity } = useIotDeviceActivity(deviceId);
  const { data: boundExperiments } = useDeviceExperiments(deviceId);
  // Names for experiments the viewer is a member of; ids outside this list stay
  // unnamed, since a device publishing to an experiment says nothing about the
  // viewer's access to it.
  const { data: visibleExperiments } = useQuery(
    orpc.experiments.listExperiments.queryOptions({ input: { filter: "member" } }),
  );
  const { data: visibleProtocols } = useQuery(
    orpc.protocols.listProtocols.queryOptions({ input: {} }),
  );
  const { data: visibleWorkbooks } = useQuery(
    orpc.workbooks.listWorkbooks.queryOptions({ input: {} }),
  );
  const {
    data: monitoring,
    isLoading,
    isFetching,
    isError,
    refetch,
  } = useDeviceMonitoring(deviceId, selection.range);

  const handleRangeChange = (range: MonitoringRange, preset: MonitoringPresetId | null) => {
    setSelection({ range, preset });
  };

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-medium">{t("iot.devices.monitoring.title")}</h2>
          <p className="text-muted-foreground text-sm">{t("iot.devices.monitoring.description")}</p>
        </div>
        <MonitoringRangeControl
          range={selection.range}
          activePreset={selection.preset}
          onRangeChange={handleRangeChange}
          isUpdating={isFetching && !isLoading}
        />
      </div>

      <MonitoringTiles
        device={device}
        activity={activity}
        monitoring={monitoring}
        range={selection.range}
      />

      {isError ? (
        <Card className="shadow-none">
          <CardContent className="flex flex-col items-center gap-3 py-10">
            <p className="text-muted-foreground text-sm">{t("iot.devices.monitoring.loadError")}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                void refetch();
              }}
            >
              {t("iot.devices.monitoring.retry")}
            </Button>
          </CardContent>
        </Card>
      ) : isLoading || monitoring === undefined ? (
        <div className="space-y-6">
          <Skeleton className="h-48 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
      ) : (
        <div className="space-y-6">
          <PanelCard
            title={t("iot.devices.monitoring.availabilityTitle")}
            description={t("iot.devices.monitoring.availabilityHint")}
          >
            <AvailabilityPanel
              monitoring={monitoring}
              from={selection.range.from}
              to={selection.range.to}
            />
          </PanelCard>

          <PanelCard
            title={t("iot.devices.monitoring.throughputTitle")}
            description={t("iot.devices.monitoring.pipelineNote")}
          >
            <ThroughputPanel
              monitoring={monitoring}
              boundExperiments={boundExperiments ?? []}
              visibleExperiments={visibleExperiments ?? []}
              visibleProtocols={visibleProtocols ?? []}
              locale={locale}
              from={selection.range.from}
              to={selection.range.to}
            />
          </PanelCard>

          <PanelCard
            title={t("iot.devices.monitoring.dataByExperimentTitle")}
            description={t("iot.devices.monitoring.dataByExperimentHint")}
          >
            <DataByExperiment
              monitoring={monitoring}
              boundExperiments={boundExperiments ?? []}
              visibleExperiments={visibleExperiments ?? []}
              locale={locale}
            />
          </PanelCard>

          <PanelCard title={t("iot.devices.monitoring.payloadTitle")}>
            <PayloadProfile
              payload={monitoring.payload}
              visibleProtocols={visibleProtocols ?? []}
              visibleWorkbooks={visibleWorkbooks ?? []}
              locale={locale}
            />
          </PanelCard>

          <PanelCard
            title={t("iot.devices.monitoring.measurementsTitle")}
            description={t("iot.devices.monitoring.measurementsHint")}
          >
            <MeasurementValuesTable measurements={monitoring.recentMeasurements} />
          </PanelCard>

          {/* Families that never report battery get the log at full width
              rather than an empty half. */}
          <div
            className={cn(
              "grid gap-6",
              hasBatteryReadings(monitoring) ? "lg:grid-cols-2" : "grid-cols-1",
            )}
          >
            {hasBatteryReadings(monitoring) && (
              <PanelCard title={t("iot.devices.monitoring.batteryTitle")}>
                <BatteryPanel monitoring={monitoring} />
              </PanelCard>
            )}

            <PanelCard title={t("iot.devices.monitoring.eventLogTitle")}>
              <EventLog
                entries={buildDeviceActivity({
                  monitoring,
                  registeredAt: device?.createdAt,
                  from: selection.range.from,
                  to: selection.range.to,
                })}
              />
            </PanelCard>
          </div>
        </div>
      )}
    </div>
  );
}
