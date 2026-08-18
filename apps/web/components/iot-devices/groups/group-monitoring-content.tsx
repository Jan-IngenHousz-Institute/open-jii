"use client";

import { EventLog } from "@/components/iot-devices/monitoring/event-log";
import type {
  MonitoringPresetId,
  MonitoringRange,
} from "@/components/iot-devices/monitoring/monitoring-range";
import { resolveMonitoringPreset } from "@/components/iot-devices/monitoring/monitoring-range";
import { MonitoringRangeControl } from "@/components/iot-devices/monitoring/monitoring-range-control";
import { PanelCard } from "@/components/iot-devices/monitoring/panel-card";
import { useIotDeviceGroupMonitoring } from "@/hooks/iot/useIotDeviceGroupMonitoring/useIotDeviceGroupMonitoring";
import { useLocale } from "@/hooks/useLocale";
import { presentDevice, resolveDevicePrimaryLabel } from "@/util/device-presentation";
import { AlertTriangle } from "lucide-react";
import { useParams } from "next/navigation";
import { useState } from "react";

import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import { Card, CardContent } from "@repo/ui/components/card";
import { Skeleton } from "@repo/ui/components/skeleton";

import { buildGroupActivity, memberLabels } from "./group-activity";
import { GroupMonitoringTiles } from "./group-monitoring-tiles";
import { GroupRosterPanel } from "./group-roster-panel";
import { GroupThroughputPanel } from "./group-throughput-panel";

const DEFAULT_PRESET: MonitoringPresetId = "last24h";

interface RangeSelection {
  range: MonitoringRange;
  preset: MonitoringPresetId | null;
}

/**
 * The group dashboard, ordered the way an operator reads it: is the fleet
 * healthy right now, how is each member doing, did data flow and from whom,
 * and finally the broker's event record. Every time-series panel shares the
 * one selected range, mirroring the device dashboard it aggregates.
 */
export function GroupMonitoringContent() {
  const { t } = useTranslation("iot");
  const locale = useLocale();
  const params = useParams<{ groupId: string }>();

  const [selection, setSelection] = useState<RangeSelection>(() => ({
    range: resolveMonitoringPreset(DEFAULT_PRESET),
    preset: DEFAULT_PRESET,
  }));

  const {
    data: monitoring,
    isLoading,
    isFetching,
    isError,
    refetch,
  } = useIotDeviceGroupMonitoring(params.groupId, selection.range);

  const handleRangeChange = (range: MonitoringRange, preset: MonitoringPresetId | null) => {
    setSelection({ range, preset });
  };

  const now = Date.now();
  const labels =
    monitoring === undefined
      ? new Map<string, string>()
      : memberLabels(monitoring.members, (member) =>
          resolveDevicePrimaryLabel(
            presentDevice({
              name: member.name,
              family: member.deviceType,
              id: member.serialNumber,
            }),
            t,
          ),
        );

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-medium">{t("iot.devices.monitoring.title")}</h2>
          <p className="text-muted-foreground text-sm">{t("iot.groups.monitoring.description")}</p>
        </div>
        <MonitoringRangeControl
          range={selection.range}
          activePreset={selection.preset}
          onRangeChange={handleRangeChange}
          isUpdating={isFetching && !isLoading}
        />
      </div>

      <GroupMonitoringTiles
        monitoring={monitoring}
        range={selection.range}
        locale={locale}
        now={now}
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
      ) : monitoring.members.length === 0 ? (
        <Card className="shadow-none">
          <CardContent className="text-muted-foreground py-10 text-center text-sm">
            {t("iot.groups.noMembers")}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {monitoring.pipelineUnavailable && (
            <p className="text-muted-foreground flex items-center gap-2 text-sm">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" aria-hidden />
              {t("iot.groups.monitoring.pipelineUnavailable")}
            </p>
          )}

          <PanelCard
            title={t("iot.groups.monitoring.rosterTitle")}
            description={t("iot.groups.monitoring.rosterHint")}
          >
            <GroupRosterPanel
              monitoring={monitoring}
              labelByDeviceId={labels}
              locale={locale}
              now={now}
            />
          </PanelCard>

          <PanelCard
            title={t("iot.devices.monitoring.throughputTitle")}
            description={t("iot.devices.monitoring.pipelineNote")}
          >
            <GroupThroughputPanel
              monitoring={monitoring}
              labelByDeviceId={labels}
              range={selection.range}
              locale={locale}
            />
          </PanelCard>

          <PanelCard title={t("iot.devices.monitoring.eventLogTitle")}>
            <EventLog
              entries={buildGroupActivity(
                monitoring.events,
                labels,
                t("iot.groups.monitoring.unknownMember"),
              )}
            />
          </PanelCard>
        </div>
      )}
    </div>
  );
}
