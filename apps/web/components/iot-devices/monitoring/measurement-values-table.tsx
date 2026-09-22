"use client";

import { DataTable } from "@/components/data-table/data-table";

import type { DeviceMeasurement } from "@repo/api/domains/iot/iot.schema";
import { useTranslation } from "@repo/i18n";
import { EmptyState } from "@repo/ui/components/empty-state";

import { buildMeasurementValueTable } from "./measurement-values";

interface MeasurementValuesTableProps {
  measurements: DeviceMeasurement[];
}

/**
 * The readings themselves, rendered by the platform's data table: one column
 * per field the device reported, each cell typed the way the experiment data
 * tables type it. The device defines the shape, so the columns come from the
 * data rather than from an assumed schema.
 */
export function MeasurementValuesTable({ measurements }: MeasurementValuesTableProps) {
  const { t } = useTranslation("iot");
  const { columns, rows } = buildMeasurementValueTable(measurements);

  if (rows.length === 0) {
    return (
      <EmptyState
        size="inline"
        description={
          measurements.length === 0
            ? t("iot.devices.monitoring.noMeasurements")
            : t("iot.devices.monitoring.noReadableSamples")
        }
      />
    );
  }

  return (
    <DataTable
      columns={columns}
      rows={rows}
      pagination={{ mode: "client", pageSize: 5, pageSizeOptions: [5, 25, 50] }}
    />
  );
}
