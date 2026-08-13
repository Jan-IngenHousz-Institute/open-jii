"use client";

import { useState } from "react";

import type { DeviceLifecycleEvent } from "@repo/api/domains/iot/iot.schema";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components/table";

const PAGE_SIZE = 25;

interface EventLogProps {
  events: DeviceLifecycleEvent[];
}

/**
 * The raw connectivity record, newest first. The session strip shows the
 * shape; this is the evidence, disconnect reasons included.
 */
export function EventLog({ events }: EventLogProps) {
  const { t } = useTranslation("iot");
  const [page, setPage] = useState(1);

  if (events.length === 0) {
    return (
      <p className="text-muted-foreground rounded-lg border border-dashed p-4 text-sm">
        {t("iot.devices.monitoring.noEvents")}
      </p>
    );
  }

  const newestFirst = [...events].reverse();
  const totalPages = Math.max(1, Math.ceil(newestFirst.length / PAGE_SIZE));
  // The event list shrinks when the range narrows; the page must follow.
  const currentPage = Math.min(page, totalPages);
  const pageEvents = newestFirst.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("iot.devices.monitoring.eventTime")}</TableHead>
              <TableHead>{t("iot.devices.monitoring.eventType")}</TableHead>
              <TableHead>{t("iot.devices.monitoring.eventReason")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageEvents.map((event, index) => (
              <TableRow key={`${event.eventTimestamp}-${event.eventType}-${String(index)}`}>
                <TableCell className="whitespace-nowrap text-xs tabular-nums">
                  {event.eventTimestamp.substring(0, 19).replace("T", " ")}
                </TableCell>
                <TableCell className="text-xs">
                  {t(`iot.devices.connectivity.${event.eventType}`)}
                </TableCell>
                <TableCell className="text-muted-foreground font-mono text-xs">
                  {event.disconnectReason ?? "-"}
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
