"use client";

import { ConnectivityDot, useFormatLastSeen } from "@/components/iot-devices/device-connectivity";
import { formatRelativeTime } from "@/util/date";
import { AlertTriangle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import type {
  DeviceGroupMemberHealth,
  DeviceGroupMonitoring,
} from "@repo/api/domains/device-group/device-group.schema";
import { useTranslation } from "@repo/i18n";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components/table";
import { cn } from "@repo/ui/lib/utils";

import {
  LIST_HEADER_BG,
  LIST_TABLE_BORDER,
  LIST_TEXT_MUTED,
  LIST_TEXT_STRONG,
} from "../iot-devices-list-tokens";
import { isMemberSilent } from "./group-health";

interface GroupDevicesTableProps {
  monitoring: DeviceGroupMonitoring;
  /** The filtered subset to render; facts still come from `monitoring`. */
  members: DeviceGroupMemberHealth[];
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
    return (
      <p className="text-muted-foreground rounded-lg border border-dashed p-4 text-sm">
        {t("iot.groups.monitoring.filter.noMatches")}
      </p>
    );
  }

  function renderDeviceRow(member: DeviceGroupMemberHealth) {
    const silent = isMemberSilent(member, monitoring.pipelineUnavailable, now);
    const monitoringHref = `/${locale}/platform/devices/${member.deviceId}/monitoring`;

    return (
      <TableRow
        key={member.deviceId}
        className={cn("group cursor-pointer bg-white hover:bg-[#F6F8FA]", LIST_TABLE_BORDER)}
        onClick={() => router.push(monitoringHref)}
      >
        <TableCell className="px-6 py-3">
          <Link
            href={monitoringHref}
            onClick={(e) => e.stopPropagation()}
            className={cn(
              "focus-visible:ring-primary/40 focus-visible:outline-hidden text-[13px] font-semibold hover:underline focus-visible:ring-2",
              LIST_TEXT_STRONG,
            )}
          >
            {labelByDeviceId.get(member.deviceId) ?? member.serialNumber}
          </Link>
        </TableCell>
        <TableCell className="px-6 py-3">
          <div className="flex flex-col gap-0.5">
            <ConnectivityDot connectivity={member.connectivity} />
            {silent && (
              <span className="flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-500">
                <AlertTriangle className="h-3 w-3" aria-hidden />
                {t("iot.devices.monitoring.connectedButSilent")}
              </span>
            )}
          </div>
        </TableCell>
        <TableCell className={cn("px-6 py-3 text-[13px]", LIST_TEXT_MUTED)}>
          {formatLastSeen(member.connectivity)}
        </TableCell>
        <TableCell className={cn("px-6 py-3 text-[13px]", LIST_TEXT_MUTED)}>
          {member.lastDataAt === null
            ? t("iot.groups.monitoring.noData")
            : formatRelativeTime(member.lastDataAt, locale)}
        </TableCell>
        {showVersions && (
          <TableCell className={cn("px-6 py-3 font-mono text-xs", LIST_TEXT_MUTED)}>
            {versionByDeviceId.get(member.deviceId)}
          </TableCell>
        )}
      </TableRow>
    );
  }

  return (
    <div className={cn("overflow-hidden rounded-lg border", LIST_TABLE_BORDER)}>
      <Table>
        <TableHeader>
          <TableRow className={cn("hover:bg-transparent", LIST_HEADER_BG, LIST_TABLE_BORDER)}>
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
    <TableHead
      className={cn(
        "h-10 px-6 align-middle text-[11px] font-semibold uppercase tracking-[0.02em]",
        LIST_TEXT_MUTED,
      )}
    >
      {children}
    </TableHead>
  );
}
