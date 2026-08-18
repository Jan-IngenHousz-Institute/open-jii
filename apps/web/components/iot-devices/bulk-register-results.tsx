"use client";

import { useLocale } from "@/hooks/useLocale";
import { AlertTriangle, Check, ExternalLink } from "lucide-react";
import Link from "next/link";

import type { BulkRegisterIotDevicesResult } from "@repo/api/domains/iot/iot.schema";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";

interface BulkRegisterResultsProps {
  result: BulkRegisterIotDevicesResult;
}

/**
 * What actually happened, row by row, with the way onward: created devices
 * link to their pages, failures carry their reason, and a grouped batch links
 * to the group it landed in.
 */
export function BulkRegisterResults({ result }: BulkRegisterResultsProps) {
  const { t } = useTranslation("iot");
  const locale = useLocale();

  const created = result.devices.filter((row) => row.error === null).length;
  const failed = result.devices.length - created;

  function renderRow(row: BulkRegisterIotDevicesResult["devices"][number]) {
    return (
      <li key={row.serialNumber} className="flex items-center gap-2 px-3 py-1.5 text-sm">
        {row.error === null ? (
          <Check className="h-4 w-4 shrink-0 text-green-600" aria-hidden />
        ) : (
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" aria-hidden />
        )}
        {row.device === null ? (
          <span className="font-mono text-xs">{row.serialNumber}</span>
        ) : (
          <Link
            href={`/${locale}/platform/devices/${row.device.id}`}
            className="font-mono text-xs hover:underline"
          >
            {row.serialNumber}
          </Link>
        )}
        <span className="text-muted-foreground min-w-0 flex-1 truncate text-xs">
          {row.error ?? row.device?.name ?? ""}
        </span>
        {row.device !== null && (
          <ExternalLink className="text-muted-foreground h-3.5 w-3.5 shrink-0" aria-hidden />
        )}
      </li>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-muted-foreground text-sm tabular-nums">
        {t("iot.devices.bulkDialog.resultSummary", { created, failed })}
      </p>

      <ul className="max-h-72 divide-y overflow-y-auto rounded-lg border">
        {result.devices.map(renderRow)}
      </ul>

      {result.groupError !== null && (
        <p className="flex items-center gap-2 text-sm text-amber-600">
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
          {t("iot.devices.bulkDialog.groupError", { error: result.groupError })}
        </p>
      )}

      {result.groupId !== null && (
        <Button asChild variant="outline" size="sm">
          <Link href={`/${locale}/platform/devices/groups/${result.groupId}`}>
            {t("iot.devices.bulkDialog.viewGroup")}
          </Link>
        </Button>
      )}
    </div>
  );
}
