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
  labelByDeviceId: Map<string, string>;
  locale: string;
  now: number;
}

/** Per-member live state; each row deep-links to that device's own dashboard. */
export function GroupRosterPanel({
  monitoring,
  labelByDeviceId,
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

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("iot.groups.deviceColumn")}</TableHead>
            <TableHead>{t("iot.groups.monitoring.stateColumn")}</TableHead>
            <TableHead>{t("iot.groups.monitoring.lastSeenColumn")}</TableHead>
            <TableHead>{t("iot.groups.monitoring.lastDataColumn")}</TableHead>
            <TableHead className="w-40" />
          </TableRow>
        </TableHeader>
        <TableBody>{monitoring.members.map(renderMemberRow)}</TableBody>
      </Table>
    </div>
  );
}
