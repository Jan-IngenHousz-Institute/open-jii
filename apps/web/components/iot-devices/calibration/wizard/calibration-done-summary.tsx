"use client";

import type {
  CalibrationRunPayload,
  CalibrationWriteResults,
  DeviceCalibration,
} from "@repo/api/domains/iot/calibration/iot-calibration.schema";
import { useTranslation } from "@repo/i18n";

interface CalibrationDoneSummaryProps {
  /** What the bench measured, or null when the session never captured anything. */
  payload: CalibrationRunPayload | null;
  applied: DeviceCalibration | null;
  results: CalibrationWriteResults | null;
  isReported: boolean;
}

/**
 * What the session actually left behind.
 *
 * How much was measured, what was decided, and how much of it is on the hardware: the three
 * things someone writes in a log book afterwards.
 */
export function CalibrationDoneSummary({
  payload,
  applied,
  results,
  isReported,
}: CalibrationDoneSummaryProps) {
  const { t } = useTranslation("iot");

  const series = Object.values(payload ?? {});
  const points = series.reduce((total, rows) => total + rows.length, 0);
  const blocks = applied === null ? 0 : Object.keys(applied.blocks).length;
  const confirmed = Object.values(results ?? {}).filter((result) => result.verified).length;

  const facts: [string, string][] = [];

  if (points > 0) {
    facts.push([
      t("iot.calibration.done.measured"),
      t("iot.calibration.done.measuredValue", { series: series.length, points }),
    ]);
  }
  if (applied !== null) {
    facts.push([
      t("iot.calibration.done.applied"),
      t("iot.calibration.done.appliedValue", { blocks }),
    ]);
  }
  if (results !== null) {
    facts.push([
      t("iot.calibration.done.onDevice"),
      isReported
        ? t("iot.calibration.done.onDeviceValue", { confirmed, blocks })
        : t("iot.calibration.done.onDeviceUnrecorded", { confirmed }),
    ]);
  }

  if (facts.length === 0) {
    return null;
  }

  function renderFact([label, value]: [string, string]) {
    return (
      <div key={label} className="contents">
        <dt className="text-muted-foreground">{label}</dt>
        <dd>{value}</dd>
      </div>
    );
  }

  return (
    <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-sm">
      {facts.map(renderFact)}
    </dl>
  );
}
