"use client";

import { PanelCard } from "@/components/iot-devices/monitoring/panel-card";
import { useLocale } from "@/hooks/useLocale";
import { CheckCircle2, CircleDashed, XCircle } from "lucide-react";

import type { DeviceCalibration } from "@repo/api/domains/iot/calibration/iot-calibration.schema";
import { useTranslation } from "@repo/i18n";

import { CalibrationSeriesTable } from "./calibration-series-table";

/**
 * Whether a run's coefficients reached the hardware, and what the device read back
 * afterwards. Approval and the write are separate events, so a session can be approved
 * on record with nothing on the device.
 */
export function CalibrationWriteRecord({ applied }: { applied: DeviceCalibration }) {
  const { t } = useTranslation("iot");
  const locale = useLocale();

  const results = Object.entries(applied.writeResults ?? {});
  const verification = Object.entries(applied.verification ?? {});

  function renderResult([block, result]: (typeof results)[number]) {
    return (
      <li key={block} className="flex flex-wrap items-center gap-2 text-sm">
        {result.verified ? (
          <CheckCircle2 className="text-primary size-4 shrink-0" aria-hidden />
        ) : (
          <XCircle className="text-destructive size-4 shrink-0" aria-hidden />
        )}
        <span className="font-medium">{block}</span>
        <span className="text-muted-foreground">
          {result.verified
            ? t("iot.calibration.write.verified")
            : t("iot.calibration.write.failed")}
        </span>
        {result.error !== undefined && (
          <span className="text-destructive font-mono text-xs">{result.error}</span>
        )}
      </li>
    );
  }

  function renderVerificationSeries([series, rows]: (typeof verification)[number]) {
    return <CalibrationSeriesTable key={series} series={series} rows={rows} />;
  }

  function renderBody() {
    const writtenAt = applied.writtenToDeviceAt;
    if (writtenAt === null) {
      return (
        <p className="text-muted-foreground flex items-center gap-2 text-sm">
          <CircleDashed className="size-4 shrink-0" aria-hidden />
          {t("iot.calibration.run.writeNever")}
        </p>
      );
    }

    return (
      <div className="space-y-4">
        <p className="text-muted-foreground text-sm">
          {t("iot.calibration.run.writtenAt", {
            date: new Date(writtenAt).toLocaleString(locale),
          })}
        </p>
        {results.length > 0 && <ul className="space-y-1">{results.map(renderResult)}</ul>}
        {verification.length > 0 && (
          <div className="space-y-3">
            <p className="text-sm font-medium">{t("iot.calibration.run.verificationTitle")}</p>
            {verification.map(renderVerificationSeries)}
          </div>
        )}
      </div>
    );
  }

  return <PanelCard title={t("iot.calibration.run.writeTitle")}>{renderBody()}</PanelCard>;
}
