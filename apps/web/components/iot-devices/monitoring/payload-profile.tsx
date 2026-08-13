"use client";

import type { DevicePayloadStats } from "@repo/api/domains/iot/iot.schema";
import { useTranslation } from "@repo/i18n";

interface PayloadProfileProps {
  payload: DevicePayloadStats;
}

function coveragePercent(part: number, total: number): string {
  if (total === 0) {
    return "0%";
  }
  return `${String(Math.round((part / total) * 100))}%`;
}

/**
 * What the device's payloads carry: metadata-channel coverage, firmware mix,
 * workbook runs, and (legacy rows only) protocol mix.
 */
export function PayloadProfile({ payload }: PayloadProfileProps) {
  const { t } = useTranslation("iot");

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div>
          <p className="text-muted-foreground text-xs">{t("iot.devices.monitoring.gpsCoverage")}</p>
          <p className="text-sm font-medium tabular-nums">
            {coveragePercent(payload.withGps, payload.totalMeasurements)}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground text-xs">
            {t("iot.devices.monitoring.batteryCoverage")}
          </p>
          <p className="text-sm font-medium tabular-nums">
            {coveragePercent(payload.withBattery, payload.totalMeasurements)}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground text-xs">
            {t("iot.devices.monitoring.workbookRuns")}
          </p>
          <p className="text-sm font-medium tabular-nums">{payload.workbookRuns}</p>
        </div>
        <div>
          <p className="text-muted-foreground text-xs">
            {t("iot.devices.monitoring.measurements")}
          </p>
          <p className="text-sm font-medium tabular-nums">{payload.totalMeasurements}</p>
        </div>
      </div>

      {payload.firmwareMix.length > 0 && (
        <div className="text-xs">
          <span className="text-muted-foreground font-medium">
            {t("iot.devices.monitoring.firmware")}:
          </span>{" "}
          {payload.firmwareMix.map((entry) => (
            <span key={entry.version ?? "unknown"} className="mr-3 font-mono">
              {entry.version ?? t("iot.devices.monitoring.unknownVersion")} ×{entry.count}
            </span>
          ))}
        </div>
      )}

      {payload.protocolMix.length > 0 && (
        <div className="text-xs">
          <span className="text-muted-foreground font-medium">
            {t("iot.devices.monitoring.protocols")}:
          </span>{" "}
          {payload.protocolMix.map((entry) => (
            <span key={entry.protocolId ?? "unknown"} className="mr-3 font-mono">
              {entry.protocolId} ×{entry.count}
            </span>
          ))}
          <span className="text-muted-foreground ml-1">
            {t("iot.devices.monitoring.protocolLegacyNote")}
          </span>
        </div>
      )}
    </div>
  );
}
