"use client";

import { formatRelativeTime } from "@/util/date";
import { AlertTriangle } from "lucide-react";

import type { DeviceGroupFirmware } from "@repo/api/domains/device-group/device-group.schema";
import { useTranslation } from "@repo/i18n";
import { Badge } from "@repo/ui/components/badge";

interface GroupFirmwarePanelProps {
  firmware: DeviceGroupFirmware[];
  labelByDeviceId: Map<string, string>;
  locale: string;
}

interface VersionRow {
  version: string;
  memberLabels: string[];
  lastSeen: string | null;
}

/**
 * Which firmware the fleet is actually running, from the data it sent. More
 * than one version in the field is the state an operator wants flagged, not
 * inferred from row-by-row reading.
 */
export function GroupFirmwarePanel({ firmware, labelByDeviceId, locale }: GroupFirmwarePanelProps) {
  const { t } = useTranslation("iot");

  const byVersion = new Map<string, VersionRow>();
  for (const entry of firmware) {
    if (entry.version === null || entry.deviceId === null) continue;
    const row = byVersion.get(entry.version) ?? {
      version: entry.version,
      memberLabels: [],
      lastSeen: null,
    };
    const label = labelByDeviceId.get(entry.deviceId);
    if (label !== undefined) {
      row.memberLabels.push(label);
    }
    if (entry.lastSeen !== null && (row.lastSeen === null || entry.lastSeen > row.lastSeen)) {
      row.lastSeen = entry.lastSeen;
    }
    byVersion.set(entry.version, row);
  }

  const rows = [...byVersion.values()].sort(
    (a, b) => b.memberLabels.length - a.memberLabels.length,
  );

  if (rows.length === 0) {
    return (
      <p className="text-muted-foreground rounded-lg border border-dashed p-4 text-sm">
        {t("iot.groups.monitoring.noFirmware")}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {rows.length > 1 && (
        <p className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-500">
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
          {t("iot.groups.monitoring.mixedFirmware", { count: rows.length })}
        </p>
      )}

      <ul className="divide-y rounded-lg border">
        {rows.map((row) => (
          <li key={row.version} className="flex items-start gap-3 px-3 py-2.5 text-sm">
            <Badge variant="outline" className="shrink-0 font-mono font-normal">
              {row.version}
            </Badge>
            <p className="text-muted-foreground min-w-0 flex-1 break-words">
              {row.memberLabels.join(", ")}
            </p>
            <span className="text-muted-foreground shrink-0 text-xs">
              {row.lastSeen !== null && formatRelativeTime(row.lastSeen, locale)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
