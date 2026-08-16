"use client";

import { format } from "date-fns";
import { useState } from "react";

import { useTranslation } from "@repo/i18n";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components/table";

import type { ActivityEntry, ActivityKind } from "./device-activity";

const PAGE_SIZE = 25;

const KIND_VARIANT: Record<ActivityKind, "default" | "secondary" | "outline"> = {
  connected: "default",
  disconnected: "secondary",
  firmwareChanged: "outline",
  registered: "outline",
};

interface EventLogProps {
  entries: ActivityEntry[];
}

/**
 * The device's activity record: broker connections, firmware transitions seen
 * in the data, and registration. The evidence behind everything above it.
 */
export function EventLog({ entries }: EventLogProps) {
  const { t } = useTranslation("iot");
  const [page, setPage] = useState(1);

  if (entries.length === 0) {
    return (
      <p className="text-muted-foreground rounded-lg border border-dashed p-4 text-sm">
        {t("iot.devices.monitoring.noEvents")}
      </p>
    );
  }

  const totalPages = Math.max(1, Math.ceil(entries.length / PAGE_SIZE));
  // The list shrinks when the range narrows; the page must follow.
  const currentPage = Math.min(page, totalPages);
  const pageEntries = entries.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <div className="space-y-3">
      <div className="max-h-96 overflow-auto rounded-lg border">
        <Table>
          <TableHeader className="bg-background sticky top-0">
            <TableRow>
              <TableHead>{t("iot.devices.monitoring.eventTime")}</TableHead>
              <TableHead>{t("iot.devices.monitoring.eventType")}</TableHead>
              <TableHead>{t("iot.devices.monitoring.eventDetail")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageEntries.map((entry, position) => (
              <TableRow key={`${entry.timestamp}-${entry.kind}-${String(position)}`}>
                <TableCell className="whitespace-nowrap text-xs tabular-nums">
                  {format(new Date(entry.timestamp), "MMM d HH:mm:ss")}
                </TableCell>
                <TableCell className="text-xs">
                  <Badge variant={KIND_VARIANT[entry.kind]} className="font-normal">
                    {t(`iot.devices.monitoring.activity.${entry.kind}`)}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground font-mono text-xs">
                  {entry.detail ?? "-"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-end gap-2 text-xs">
          <span className="text-muted-foreground">
            {t("iot.devices.pageOf", { page: currentPage, total: totalPages })}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage <= 1}
            onClick={() => {
              setPage(currentPage - 1);
            }}
          >
            {t("iot.devices.monitoring.previous")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage >= totalPages}
            onClick={() => {
              setPage(currentPage + 1);
            }}
          >
            {t("iot.devices.monitoring.next")}
          </Button>
        </div>
      )}
    </div>
  );
}
