"use client";

import { ConnectivityDot, useFormatLastSeen } from "@/components/iot-devices/device-connectivity";
import { formatRelativeTime } from "@/util/date";
import { AlertTriangle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import type {
  IotDeviceGroupMemberHealth,
  IotDeviceGroupMonitoring,
} from "@repo/api/domains/iot/device-group/iot-device-group.schema";
import { useTranslation } from "@repo/i18n";
import { EmptyState } from "@repo/ui/components/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components/table";

import { isMemberSilent } from "./group-health";

interface GroupDevicesTableProps {
  monitoring: IotDeviceGroupMonitoring;
  /** The filtered subset to render; facts still come from `monitoring`. */
  members: IotDeviceGroupMemberHealth[];
  labelByDeviceId: Map<string, string>;
  versionByDeviceId: Map<string, string>;
  locale: string;
  now: number;
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
}: GroupDevicesTableProps) {
  const { t } = useTranslation("iot");
  const router = useRouter();
  const formatLastSeen = useFormatLastSeen();

  // No version in the window for anyone: drop the column instead of an empty one.
  const showVersions = versionByDeviceId.size > 0;

  if (members.length === 0) {
    return <EmptyState size="inline" description={t("iot.groups.monitoring.filter.noMatches")} />;
  }

  function renderDeviceRow(member: IotDeviceGroupMemberHealth) {
    const silent = isMemberSilent(member, monitoring.pipelineUnavailable, now);
    const monitoringHref = `/${locale}/platform/devices/${member.deviceId}/monitoring`;

    return (
      <TableRow
        key={member.deviceId}
        className="bg-background hover:bg-muted/50 border-border group cursor-pointer"
        onClick={() => router.push(monitoringHref)}
      >
        <TableCell className="px-6 py-3">
          <Link
            href={monitoringHref}
            onClick={(e) => e.stopPropagation()}
            className="focus-visible:ring-primary/40 focus-visible:outline-hidden text-foreground text-[13px] font-semibold hover:underline focus-visible:ring-2"
          >
            {labelByDeviceId.get(member.deviceId) ?? member.serialNumber}
          </Link>
        </TableCell>
        <TableCell className="px-6 py-3">
          <div className="flex flex-col gap-0.5">
            <ConnectivityDot connectivity={member.connectivity} />
            {silent && (
              <span className="text-status-stale-foreground flex items-center gap-1 text-[11px]">
                <AlertTriangle className="h-3 w-3" aria-hidden />
                {t("iot.devices.monitoring.connectedButSilent")}
              </span>
            )}
          </div>
        </TableCell>
        <TableCell className="text-muted-foreground px-6 py-3 text-[13px]">
          {formatLastSeen(member.connectivity)}
        </TableCell>
        <TableCell className="text-muted-foreground px-6 py-3 text-[13px]">
          {monitoring.pipelineUnavailable
            ? t("iot.devices.monitoring.lastDataUnavailable")
            : member.lastDataAt === null
              ? t("iot.groups.monitoring.noData")
              : formatRelativeTime(member.lastDataAt, locale)}
        </TableCell>
        {showVersions && (
          <TableCell className="text-muted-foreground px-6 py-3 font-mono text-xs">
            {versionByDeviceId.get(member.deviceId)}
          </TableCell>
        )}
      </TableRow>
    );
  }

  return (
    <div className="border-border overflow-hidden rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow className="bg-surface-light border-border hover:bg-transparent">
            <ColumnHead>{t("iot.groups.deviceColumn")}</ColumnHead>
            <ColumnHead>{t("iot.groups.monitoring.stateColumn")}</ColumnHead>
            <ColumnHead>{t("iot.groups.monitoring.lastSeenColumn")}</ColumnHead>
            <ColumnHead>{t("iot.groups.monitoring.lastDataColumn")}</ColumnHead>
            {showVersions && <ColumnHead>{t("iot.groups.monitoring.versionColumn")}</ColumnHead>}
          </TableRow>
        </TableHeader>
        <TableBody>{members.map(renderDeviceRow)}</TableBody>
      </Table>
    </div>
  );
}

function ColumnHead({ children }: { children: React.ReactNode }) {
  return (
    <TableHead className="text-muted-foreground h-10 px-6 align-middle text-[11px] font-semibold uppercase tracking-[0.02em]">
      {children}
    </TableHead>
  );
}
