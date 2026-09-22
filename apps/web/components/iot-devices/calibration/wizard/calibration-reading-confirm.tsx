"use client";

import type { OperatorRequest } from "@/hooks/iot/useCalibrationOperator/useCalibrationOperator";
import { RotateCcw } from "lucide-react";

import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";

import { formatSeriesValue } from "../result/format-series-value";

type ConfirmRequest = Extract<OperatorRequest, { kind: "confirmReading" }>;

/**
 * The point the operator just took, offered back before the sweep moves on. A filter that
 * slipped or a reference that had not settled is only visible here; once the sweep has
 * moved on, the whole session is the only thing left to redo.
 */
export function CalibrationReadingConfirm({ request }: { request: ConfirmRequest }) {
  const { t } = useTranslation("iot");
  const { reading } = request;

  const columns = Object.keys(reading.row).filter((column) => column !== "stimulus");

  function renderCell(column: string) {
    return (
      <div key={column} className="contents">
        <dt className="text-muted-foreground">{column}</dt>
        <dd className="font-mono">{formatSeriesValue(reading.row[column])}</dd>
      </div>
    );
  }

  return (
    <div className="space-y-4" aria-live="polite">
      <p className="text-sm font-medium">
        {reading.stimulus === undefined
          ? t("iot.calibration.prompt.confirmReading")
          : t("iot.calibration.prompt.confirmReadingAt", {
              stimulus: formatSeriesValue(reading.stimulus),
            })}
      </p>
      <dl className="bg-background grid max-w-sm grid-cols-[max-content_1fr] gap-x-6 gap-y-1 rounded-md border px-3 py-2 text-sm">
        {columns.map(renderCell)}
      </dl>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" onClick={() => request.resolve(true)}>
          {t("iot.calibration.prompt.keepReading")}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => request.resolve(false)}>
          <RotateCcw className="mr-2 size-4" aria-hidden />
          {t("iot.calibration.prompt.retakeReading")}
        </Button>
      </div>
    </div>
  );
}
