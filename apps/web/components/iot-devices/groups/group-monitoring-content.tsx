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
import { orpc } from "@/lib/orpc";
import { resolveDeviceLabel } from "@/util/device-presentation";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { useParams } from "next/navigation";
import { useState } from "react";

import type { IotDeviceGroupMemberHealth } from "@repo/api/domains/iot/device-group/iot-device-group.schema";
import { listItems } from "@repo/api/shared/listing";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import { Card, CardContent } from "@repo/ui/components/card";
import { Skeleton } from "@repo/ui/components/skeleton";

import { buildGroupActivity, memberLabels } from "./group-activity";
import { GroupDataByExperimentPanel } from "./group-data-by-experiment-panel";
import { GroupDevicesTable } from "./group-devices-table";
import { GroupFirmwarePanel } from "./group-firmware-panel";
import type { MemberFilter } from "./group-health";
import { filterGroupMembers, summarizeGroupHealth } from "./group-health";
import { GroupMonitoringFilter } from "./group-monitoring-filter";
import { GroupMonitoringTiles } from "./group-monitoring-tiles";
import { GroupThroughputPanel } from "./group-throughput-panel";

const DEFAULT_PRESET: MonitoringPresetId = "last24h";

interface RangeSelection {
  range: MonitoringRange;
  preset: MonitoringPresetId | null;
}

/**
 * The group dashboard, ordered the way an operator reads it: is the fleet
 * healthy right now, how is each member doing, did data flow and from whom,
 * where did it land, what is the fleet running, and finally the broker's
 * event record. One selected range and one member filter drive every panel.
 */
export function GroupMonitoringContent() {
  const { t } = useTranslation("iot");
  const locale = useLocale();
  const params = useParams<{ groupId: string }>();

  const [selection, setSelection] = useState<RangeSelection>(() => ({
    range: resolveMonitoringPreset(DEFAULT_PRESET),
    preset: DEFAULT_PRESET,
  }));
  const [filter, setFilter] = useState<MemberFilter>({ search: "", status: "all" });

  const {
    data: monitoring,
    isLoading,
    isFetching,
    isError,
    refetch,
  } = useIotDeviceGroupMonitoring(params.groupId, selection.range);
  // Names for experiments the viewer is a member of; ids outside this list stay
  // unnamed, since the group publishing to an experiment says nothing about the
  // viewer's access to it.
  const { data: visibleExperiments } = useQuery(
    orpc.experiments.listExperiments.queryOptions({ input: { filter: "member" } }),
  );

  const handleRangeChange = (range: MonitoringRange, preset: MonitoringPresetId | null) => {
    setSelection({ range, preset });
  };

  const now = Date.now();

  function labelFor(member: IotDeviceGroupMemberHealth): string {
    return resolveDeviceLabel(member, t);
  }

  const labels =
    monitoring === undefined
      ? new Map<string, string>()
      : memberLabels(monitoring.members, labelFor);

  const filteredMembers =
    monitoring === undefined
      ? []
      : filterGroupMembers(
          monitoring.members,
          filter,
          monitoring.pipelineUnavailable,
          now,
          labelFor,
        );
  const filteredIds = new Set(filteredMembers.map((member) => member.deviceId));
  const isFiltered =
    monitoring !== undefined && filteredMembers.length !== monitoring.members.length;

  // Member-attributed facts follow the filter; unattributed rows only surface
  // in the unfiltered view, so a filtered chart never shows orphan volume.
  const filteredThroughput =
    monitoring === undefined
      ? []
      : monitoring.throughput.filter((row) =>
          row.deviceId === null ? !isFiltered : filteredIds.has(row.deviceId),
        );
  const filteredEvents =
    monitoring === undefined
      ? []
      : monitoring.events.filter((row) =>
          row.deviceId === null ? !isFiltered : filteredIds.has(row.deviceId),
        );
  const filteredFirmware =
    monitoring === undefined
      ? []
      : monitoring.firmware.filter((row) => row.deviceId !== null && filteredIds.has(row.deviceId));
  const versionByDeviceId = new Map(
    filteredFirmware.flatMap((row) =>
      row.deviceId !== null && row.version !== null ? [[row.deviceId, row.version] as const] : [],
    ),
  );

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-medium">{t("iot.devices.monitoring.title")}</h2>
            <p className="text-muted-foreground text-sm">
              {t("iot.groups.monitoring.description")}
            </p>
          </div>
          <MonitoringRangeControl
            range={selection.range}
            activePreset={selection.preset}
            onRangeChange={handleRangeChange}
            isUpdating={isFetching && !isLoading}
          />
        </div>

        {monitoring !== undefined && monitoring.members.length > 0 && (
          <GroupMonitoringFilter
            filter={filter}
            onFilterChange={setFilter}
            summary={summarizeGroupHealth(monitoring.members, monitoring.pipelineUnavailable, now)}
          />
        )}

        <GroupMonitoringTiles
          monitoring={monitoring}
          members={filteredMembers}
          throughput={filteredThroughput}
          range={selection.range}
          locale={locale}
          now={now}
          tileClassName="bg-card"
        />
      </div>

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

          <GroupDevicesTable
            monitoring={monitoring}
            members={filteredMembers}
            labelByDeviceId={labels}
            versionByDeviceId={versionByDeviceId}
            locale={locale}
            now={now}
          />

          <PanelCard
            title={t("iot.devices.monitoring.throughputTitle")}
            description={t("iot.devices.monitoring.pipelineNote")}
          >
            <GroupThroughputPanel
              throughput={filteredThroughput}
              labelByDeviceId={labels}
              range={selection.range}
              locale={locale}
            />
          </PanelCard>

          <PanelCard
            title={t("iot.devices.monitoring.dataByExperimentTitle")}
            description={
              isFiltered
                ? t("iot.groups.monitoring.experimentsGroupWide")
                : t("iot.groups.monitoring.experimentsHint")
            }
          >
            <GroupDataByExperimentPanel
              dataByExperiment={monitoring.dataByExperiment}
              visibleExperiments={listItems(visibleExperiments)}
              locale={locale}
            />
          </PanelCard>

          <PanelCard
            title={t("iot.groups.monitoring.firmwareTitle")}
            description={t("iot.groups.monitoring.firmwareHint")}
          >
            <GroupFirmwarePanel
              firmware={filteredFirmware}
              labelByDeviceId={labels}
              locale={locale}
            />
          </PanelCard>

          <PanelCard title={t("iot.devices.monitoring.eventLogTitle")}>
            <EventLog
              entries={buildGroupActivity(
                filteredEvents,
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
