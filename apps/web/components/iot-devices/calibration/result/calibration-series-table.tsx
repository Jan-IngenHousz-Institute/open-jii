"use client";

import { DataTable } from "@/components/data-table/data-table";
import { useMemo } from "react";

import type { CalibrationRunPayload } from "@repo/api/domains/iot/calibration/iot-calibration.schema";
import { useTranslation } from "@repo/i18n";

import { seriesTableData } from "./series-table-data";

type SeriesRow = CalibrationRunPayload[string][number];

/**
 * What the bench actually measured, one table per series. A reviewer approving a
 * calibration on its coefficients alone cannot see a point that went wrong, so the readings
 * render on the platform's own data table: the same cell for the same kind of reading
 * wherever it appears.
 */
export function CalibrationSeriesTable({ series, rows }: { series: string; rows: SeriesRow[] }) {
  const { t } = useTranslation("iot");
  const table = useMemo(() => seriesTableData(series, rows), [series, rows]);

  if (rows.length === 0) {
    return null;
  }

  return (
    <section className="space-y-2">
      <p className="text-sm font-medium">
        {t("iot.calibration.review.seriesCaption", { series, points: rows.length })}
      </p>
      <DataTable columns={table.columns} rows={table.rows} preserveColumnOrder />
    </section>
  );
}
