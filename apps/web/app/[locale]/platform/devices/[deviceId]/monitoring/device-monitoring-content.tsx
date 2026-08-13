"use client";

import { BatteryPanel } from "@/components/iot-devices/monitoring/battery-panel";
import { DataByExperiment } from "@/components/iot-devices/monitoring/data-by-experiment";
import { EventLog } from "@/components/iot-devices/monitoring/event-log";
import type { MonitoringRangePreset } from "@/components/iot-devices/monitoring/monitoring-range";
import { MonitoringTiles } from "@/components/iot-devices/monitoring/monitoring-tiles";
import { PanelCard } from "@/components/iot-devices/monitoring/panel-card";
import { PayloadProfile } from "@/components/iot-devices/monitoring/payload-profile";
import { SessionStrip } from "@/components/iot-devices/monitoring/session-strip";
import { ThroughputPanel } from "@/components/iot-devices/monitoring/throughput-panel";
import { useDeviceExperiments } from "@/hooks/iot/useDeviceExperiments/useDeviceExperiments";
import { useDeviceMonitoring } from "@/hooks/iot/useDeviceMonitoring/useDeviceMonitoring";
import { useIotDevice } from "@/hooks/iot/useIotDevice/useIotDevice";
import { useIotDeviceActivity } from "@/hooks/iot/useIotDeviceActivity/useIotDeviceActivity";
import { useParams } from "next/navigation";
import { useState } from "react";

import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import { Card, CardContent } from "@repo/ui/components/card";
import { Skeleton } from "@repo/ui/components/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@repo/ui/components/toggle-group";

const CONNECTIVITY_POLL_MS = 15_000;
const RANGE_PRESETS: MonitoringRangePreset[] = ["24h", "7d", "30d"];

/**
 * The monitoring dashboard: live state on top, then stability, data flow,
 * payload content, device health, and the raw event record. Live tiles ignore
 * the range; everything else is pipeline-fed and labeled so.
 */
export default function DeviceMonitoringPage() {
  const { t } = useTranslation("iot");
  const params = useParams<{ deviceId: string }>();
  const deviceId = params.deviceId;
  const [preset, setPreset] = useState<MonitoringRangePreset>("24h");

  const { data: device } = useIotDevice(deviceId, { refetchInterval: CONNECTIVITY_POLL_MS });
  const { data: activity } = useIotDeviceActivity(deviceId);
  const { data: boundExperiments } = useDeviceExperiments(deviceId);
  const {
    data: monitoring,
    isLoading,
    isError,
    refetch,
    range,
  } = useDeviceMonitoring(deviceId, preset);

  const handlePresetChange = (value: string) => {
    if (value === "24h" || value === "7d" || value === "30d") {
      setPreset(value);
    }
  };

  const uptimeLabel =
    monitoring?.uptimePercent == null
      ? t("iot.devices.monitoring.uptimeUnknown")
      : t("iot.devices.monitoring.uptime", {
          percent: monitoring.uptimePercent.toFixed(1),
        });

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-medium">{t("iot.devices.monitoring.title")}</h2>
          <p className="text-muted-foreground text-sm">{t("iot.devices.monitoring.description")}</p>
        </div>
        <ToggleGroup
          type="single"
          size="sm"
          value={preset}
          onValueChange={handlePresetChange}
          className="bg-muted rounded-md p-0.5"
        >
          {RANGE_PRESETS.map((option) => (
            <ToggleGroupItem key={option} value={option} className="px-3">
              {t(`iot.devices.monitoring.range.${option}`)}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      <MonitoringTiles device={device} activity={activity} monitoring={monitoring} />

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
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
      ) : (
        <>
          <PanelCard title={uptimeLabel} description={t("iot.devices.monitoring.sessionsHint")}>
            {monitoring.events.length === 0 ? (
              <p className="text-muted-foreground rounded-lg border border-dashed p-4 text-sm">
                {t("iot.devices.monitoring.noEvents")}
              </p>
            ) : (
              <SessionStrip monitoring={monitoring} from={range.from} to={range.to} />
            )}
          </PanelCard>

          <PanelCard
            title={t("iot.devices.monitoring.throughputTitle")}
            description={t("iot.devices.monitoring.pipelineNote")}
          >
            <ThroughputPanel
              monitoring={monitoring}
              boundExperiments={boundExperiments ?? []}
              from={range.from}
              to={range.to}
            />
          </PanelCard>

          <PanelCard
            title={t("iot.devices.monitoring.dataByExperimentTitle")}
            description={t("iot.devices.monitoring.dataByExperimentHint")}
          >
            <DataByExperiment monitoring={monitoring} boundExperiments={boundExperiments ?? []} />
          </PanelCard>

          <PanelCard title={t("iot.devices.monitoring.payloadTitle")}>
            <PayloadProfile payload={monitoring.payload} />
          </PanelCard>

          <BatteryPanel monitoring={monitoring} />

          <PanelCard title={t("iot.devices.monitoring.eventLogTitle")}>
            <EventLog events={monitoring.events} />
          </PanelCard>
        </>
      )}
    </div>
  );
}
