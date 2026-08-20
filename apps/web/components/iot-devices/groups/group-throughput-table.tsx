"use client";

import { formatTimestamp } from "@/util/date";

import { useTranslation } from "@repo/i18n";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components/table";

interface GroupThroughputTableProps {
  series: { key: string; name: string; counts: number[] }[];
  axis: string[];
  locale: string;
}

/** The chart's numbers as rows: one line per non-empty (bucket, member) pair. */
export function GroupThroughputTable({ series, axis, locale }: GroupThroughputTableProps) {
  const { t } = useTranslation("iot");

  const rows = axis.flatMap((bucketStart, position) =>
    series
      .filter((entry) => entry.counts[position] > 0)
      .map((entry) => ({
        key: `${bucketStart}:${entry.key}`,
        bucketStart,
        name: entry.name,
        count: entry.counts[position],
      })),
  );

  return (
    <div className="max-h-72 overflow-y-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("iot.devices.monitoring.bucketColumn")}</TableHead>
            <TableHead>{t("iot.groups.deviceColumn")}</TableHead>
            <TableHead className="text-right">{t("iot.devices.monitoring.measurements")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.key}>
              <TableCell className="text-muted-foreground text-sm tabular-nums">
                {formatTimestamp(row.bucketStart, locale)}
              </TableCell>
              <TableCell className="text-sm">{row.name}</TableCell>
              <TableCell className="text-right text-sm tabular-nums">{row.count}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
