"use client";

import type { DevicePayloadStats } from "@repo/api/domains/iot/iot.schema";
import { useTranslation } from "@repo/i18n";
import { Progress } from "@repo/ui/components/progress";

import { ShareBar } from "./share-bar";
import type { ShareSegment } from "./share-bar";

interface PayloadProfileProps {
  payload: DevicePayloadStats;
}

interface CoverageRow {
  key: string;
  label: string;
  covered: number;
}

/**
 * What the device's payloads actually carry. Coverage reads as proportions of
 * the measurements sent (an optional channel is either populated or it isn't),
 * and the version/protocol mixes read as composition, so "one firmware" and
 * "a split fleet" look different at a glance.
 */
export function PayloadProfile({ payload }: PayloadProfileProps) {
  const { t } = useTranslation("iot");
  const total = payload.totalMeasurements;

  if (total === 0) {
    return (
      <p className="text-muted-foreground rounded-lg border border-dashed p-4 text-sm">
        {t("iot.devices.monitoring.noMeasurements")}
      </p>
    );
  }

  const coverage: CoverageRow[] = [
    { key: "gps", label: t("iot.devices.monitoring.gpsCoverage"), covered: payload.withGps },
    {
      key: "battery",
      label: t("iot.devices.monitoring.batteryCoverage"),
      covered: payload.withBattery,
    },
  ];

  const firmwareSegments: ShareSegment[] = payload.firmwareMix.map((entry) => ({
    key: entry.version ?? "unknown",
    label: entry.version ?? t("iot.devices.monitoring.unknownVersion"),
    count: entry.count,
  }));
  const protocolSegments: ShareSegment[] = payload.protocolMix.map((entry) => ({
    key: entry.protocolId ?? "unknown",
    label: entry.protocolId ?? t("iot.devices.monitoring.unknownVersion"),
    count: entry.count,
  }));

  return (
    <div className="space-y-6">
      <div className="grid gap-6 sm:grid-cols-2">
        <div className="space-y-3">
          <p className="text-xs font-medium">{t("iot.devices.monitoring.coverage")}</p>
          {coverage.map((row) => (
            <CoverageMeter key={row.key} label={row.label} covered={row.covered} total={total} />
          ))}
        </div>

        <dl className="grid grid-cols-2 gap-3 self-start">
          <Figure label={t("iot.devices.monitoring.measurements")} value={total} />
          <Figure label={t("iot.devices.monitoring.workbookRuns")} value={payload.workbookRuns} />
        </dl>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div className="space-y-2">
          <p className="text-xs font-medium">{t("iot.devices.monitoring.firmware")}</p>
          <ShareBar segments={firmwareSegments} category={t("iot.devices.monitoring.firmware")} />
        </div>
        <div className="space-y-2">
          <p className="text-xs font-medium">{t("iot.devices.monitoring.protocols")}</p>
          <ShareBar segments={protocolSegments} category={t("iot.devices.monitoring.protocols")} />
        </div>
      </div>
    </div>
  );
}

function CoverageMeter({
  label,
  covered,
  total,
}: {
  label: string;
  covered: number;
  total: number;
}) {
  const percent = (covered / total) * 100;

  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between text-xs">
        <span>{label}</span>
        <span className="text-muted-foreground tabular-nums">
          {`${percent.toFixed(0)}% (${String(covered)}/${String(total)})`}
        </span>
      </div>
      <Progress value={percent} className="h-1.5" />
    </div>
  );
}

function Figure({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="text-lg font-medium tabular-nums">{value}</dd>
    </div>
  );
}
