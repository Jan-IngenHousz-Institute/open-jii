"use client";

import { AlertTriangle, Check } from "lucide-react";

import type { BulkRegisterIotDevicesResult } from "@repo/api/domains/iot/iot.schema";
import { useTranslation } from "@repo/i18n";

interface BulkRegisterResultsProps {
  result: BulkRegisterIotDevicesResult;
}

/** Per-serial outcome list shown when a batch partially fails or group linking does. */
export function BulkRegisterResults({ result }: BulkRegisterResultsProps) {
  const { t } = useTranslation("iot");

  return (
    <div className="space-y-3">
      <ul className="max-h-72 space-y-1 overflow-y-auto">
        {result.devices.map((row) => (
          <li key={row.serialNumber} className="flex items-start gap-2 text-sm">
            {row.error === null ? (
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-600" aria-hidden />
            ) : (
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden />
            )}
            <span className="font-mono">{row.serialNumber}</span>
            {row.error !== null && <span className="text-muted-foreground">{row.error}</span>}
          </li>
        ))}
      </ul>

      {result.groupError !== null && (
        <p className="flex items-center gap-2 text-sm text-amber-600">
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
          {t("iot.devices.bulkDialog.groupError", { error: result.groupError })}
        </p>
      )}
    </div>
  );
}
