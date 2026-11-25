"use client";

import { ConnectivityDot, useFormatLastSeen } from "@/components/iot-devices/device-connectivity";
import { ListPagination } from "@/components/list-pagination";
import { IntentLink } from "@/components/navigation/intent-link/intent-link";
import { OverviewTable } from "@/components/overview-table/overview-table";
import type { OverviewTableColumn } from "@/components/overview-table/overview-table";
import { formatRelativeTime } from "@/util/date";
import { getSensorFamilyLabel } from "@/util/sensor-family";
import { AlertTriangle } from "lucide-react";

import { isMemberSilent } from "@repo/api/domains/iot/device-group/group-health";
import type {
  IotDeviceGroupMemberHealth,
  IotDeviceGroupMonitoring,
} from "@repo/api/domains/iot/device-group/iot-device-group.schema";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";

import type { GroupDevicesList } from "./use-group-devices-list";

interface GroupDevicesTableProps {
  monitoring: IotDeviceGroupMonitoring;
  /** The filtered subset to render; facts still come from `monitoring`. */
  members: IotDeviceGroupMemberHealth[];
  labelByDeviceId: Map<string, string>;
  versionByDeviceId: Map<string, string>;
  locale: string;
  now: number;
  list: GroupDevicesList;
}

/**
 * The group's devices in the platform's tabular-list language, one live-state
 * row per device; every row opens that device's own monitoring dashboard.
 */
export function GroupDevicesTable({
  monitoring,
  members,
  labelByDeviceId,
  versionByDeviceId,
  locale,
  now,
  list,
}: GroupDevicesTableProps) {
  const { t } = useTranslation("iot");
  const { t: tCommon } = useTranslation("common");
  const formatLastSeen = useFormatLastSeen();

  // No version in the window for anyone: drop the column instead of an empty one.
  const showVersions = versionByDeviceId.size > 0;

  const columns: OverviewTableColumn<IotDeviceGroupMemberHealth, "name" | "health" | "family">[] = [
    {
      header: t("iot.groups.deviceColumn"),
      sortId: "name",
      cell: (member, href) => (
        <IntentLink
          href={href}
          onClick={(e) => e.stopPropagation()}
          className="focus-visible:ring-primary/40 focus-visible:outline-hidden text-foreground block truncate text-[13px] font-semibold hover:underline focus-visible:ring-2"
        >
          {labelByDeviceId.get(member.deviceId) ?? member.serialNumber}
        </IntentLink>
      ),
    },
    {
      header: t("iot.groups.monitoring.stateColumn"),
      sortId: "health",
      cell: (member) => (
        <div className="flex flex-col gap-0.5">
          <ConnectivityDot connectivity={member.connectivity} deviceType={member.deviceType} />
          {isMemberSilent(member, monitoring.pipelineUnavailable, now) && (
            <span className="text-status-stale-foreground flex items-center gap-1 text-[11px]">
              <AlertTriangle className="h-3 w-3" aria-hidden />
              {t("iot.devices.monitoring.connectedButSilent")}
            </span>
          )}
        </div>
      ),
    },
    {
      header: t("iot.devices.columns.family"),
      sortId: "family",
      className: "hidden md:table-cell",
      cell: (member) => (
        <span className="text-[13px]">{getSensorFamilyLabel(member.deviceType)}</span>
      ),
    },
    {
      header: t("iot.groups.monitoring.lastSeenColumn"),
      className: "hidden lg:table-cell",
      cell: (member) => (
        <span className="text-muted-foreground text-[13px]">
          {formatLastSeen(member.connectivity)}
        </span>
      ),
    },
    {
      header: t("iot.groups.monitoring.lastDataColumn"),
      className: "hidden md:table-cell",
      cell: (member) => (
        <span className="text-muted-foreground text-[13px]">
          {monitoring.pipelineUnavailable
            ? t("iot.devices.monitoring.lastDataUnavailable")
            : member.lastDataAt === null
              ? t("iot.groups.monitoring.noData")
              : formatRelativeTime(member.lastDataAt, locale)}
        </span>
      ),
    },
    ...(showVersions
      ? [
          {
            header: t("iot.groups.monitoring.versionColumn"),
            className: "hidden xl:table-cell",
            cell: (member: IotDeviceGroupMemberHealth) => (
              <span className="text-muted-foreground font-mono text-xs">
                {versionByDeviceId.get(member.deviceId)}
              </span>
            ),
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-4">
      <OverviewTable
        columns={columns}
        items={members}
        getRowKey={(member) => member.deviceId}
        getRowHref={(member) => `/${locale}/platform/devices/${member.deviceId}/monitoring`}
        emptyMessage={t("iot.groups.monitoring.filter.noMatches")}
        sorting={{ sort: list.sort, onToggle: list.toggleSort }}
        emptyAction={
          (list.hasActiveFilters || list.search.trim() !== "") && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                list.clearFilters();
                list.setSearch("");
              }}
            >
              {tCommon("common.clearFilters")}
            </Button>
          )
        }
      />
      {list.data && members.length > 0 && (
        <ListPagination
          page={list.data.page}
          totalPages={list.data.totalPages}
          onPageChange={list.setPage}
        />
      )}
    </div>
  );
}
