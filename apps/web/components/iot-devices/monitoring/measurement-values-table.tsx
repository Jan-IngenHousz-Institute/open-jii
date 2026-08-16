"use client";

import { format } from "date-fns";
import { formatValue } from "~/components/experiment-data/experiment-data-utils";

import type { DeviceMeasurement } from "@repo/api/domains/iot/iot.schema";
import { useTranslation } from "@repo/i18n";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components/table";

import { buildMeasurementValueTable, inferColumnType } from "./measurement-values";

interface MeasurementValuesTableProps {
  measurements: DeviceMeasurement[];
}

/**
 * The readings themselves: one row per sample the device sent, with a column
 * per field it reported. The device defines the shape, so the columns come
 * from the data rather than from an assumed schema.
 */
export function MeasurementValuesTable({ measurements }: MeasurementValuesTableProps) {
  const { t } = useTranslation("iot");
  const { columns, rows, hiddenColumnCount } = buildMeasurementValueTable(measurements);

  if (rows.length === 0) {
    return (
      <p className="text-muted-foreground rounded-lg border border-dashed p-4 text-sm">
        {measurements.length === 0
          ? t("iot.devices.monitoring.noMeasurements")
          : t("iot.devices.monitoring.noReadableSamples")}
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <div className="max-h-96 overflow-auto rounded-lg border">
        <Table>
          <TableHeader className="bg-background sticky top-0">
            <TableRow>
              <TableHead>{t("iot.devices.monitoring.measuredAt")}</TableHead>
              {columns.map((column) => (
                <TableHead key={column} className="text-right font-mono text-xs">
                  {column}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, position) => (
              <TableRow key={`${row.timestamp}-${String(position)}`}>
                <TableCell className="whitespace-nowrap text-xs tabular-nums">
                  {format(new Date(row.timestamp), "MMM d HH:mm:ss")}
                </TableCell>
                {columns.map((column) => (
                  <TableCell key={column} className="text-xs">
                    {/* The platform's own cell formatter, so a reading renders
                        the way the experiment data tables render it. */}
                    {column in row.values
                      ? formatValue(
                          row.values[column],
                          inferColumnType(row.values[column]),
                          `${row.timestamp}-${String(position)}`,
                          column,
                        )
                      : "-"}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {hiddenColumnCount > 0 && (
        <p className="text-muted-foreground text-xs">
          {t("iot.devices.monitoring.moreFields", { count: hiddenColumnCount })}
        </p>
      )}
    </div>
  );
}
