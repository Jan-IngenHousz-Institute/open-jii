"use client";

import { ConnectivityDot, useFormatLastSeen } from "@/components/iot-devices/device-connectivity";
import { formatRelativeTime } from "@/util/date";
import { AlertTriangle } from "lucide-react";
import Link from "next/link";

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

import { isMemberSilent } from "./group-health";

interface GroupRosterPanelProps {
  monitoring: DeviceGroupMonitoring;
  /** The filtered subset to render; facts still come from `monitoring`. */
  members: DeviceGroupMemberHealth[];
  labelByDeviceId: Map<string, string>;
  versionByDeviceId: Map<string, string>;
  locale: string;
  now: number;
}

/** Per-member live state; each row deep-links to that device's own dashboard. */
export function GroupRosterPanel({
  monitoring,
  members,
  labelByDeviceId,
  versionByDeviceId,
  locale,
  now,
}: GroupRosterPanelProps) {
  const { t } = useTranslation("iot");
  const formatLastSeen = useFormatLastSeen();

  function renderMemberRow(member: DeviceGroupMemberHealth) {
    const silent = isMemberSilent(member, monitoring.pipelineUnavailable, now);

    return (
      <TableRow key={member.deviceId}>
        <TableCell>
          <Link
            href={`/${locale}/platform/devices/${member.deviceId}/monitoring`}
            className="hover:underline"
          >
            {labelByDeviceId.get(member.deviceId) ?? member.serialNumber}
          </Link>
        </TableCell>
        <TableCell>
          <ConnectivityDot connectivity={member.connectivity} />
        </TableCell>
        <TableCell className="text-muted-foreground text-sm">
          {formatLastSeen(member.connectivity)}
        </TableCell>
        <TableCell className="text-muted-foreground text-sm">
          {member.lastDataAt === null
            ? t("iot.groups.monitoring.noData")
            : formatRelativeTime(member.lastDataAt, locale)}
        </TableCell>
        <TableCell className="text-muted-foreground font-mono text-xs">
          {versionByDeviceId.get(member.deviceId)}
        </TableCell>
        <TableCell>
          {silent && (
            <span className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-500">
              <AlertTriangle className="h-3 w-3" aria-hidden />
              {t("iot.devices.monitoring.connectedButSilent")}
            </span>
          )}
        </TableCell>
      </TableRow>
    );
  }

  if (members.length === 0) {
    return (
      <p className="text-muted-foreground rounded-lg border border-dashed p-4 text-sm">
        {t("iot.groups.monitoring.filter.noMatches")}
      </p>
    );
  }

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("iot.groups.deviceColumn")}</TableHead>
            <TableHead>{t("iot.groups.monitoring.stateColumn")}</TableHead>
            <TableHead>{t("iot.groups.monitoring.lastSeenColumn")}</TableHead>
            <TableHead>{t("iot.groups.monitoring.lastDataColumn")}</TableHead>
            <TableHead>{t("iot.groups.monitoring.versionColumn")}</TableHead>
            <TableHead className="w-40" />
          </TableRow>
        </TableHeader>
        <TableBody>{members.map(renderMemberRow)}</TableBody>
      </Table>
    </div>
  );
}
