"use client";

import { useLocale } from "@/hooks/useLocale";
import { formatTimestamp } from "@/util/date";
import { useState } from "react";

import { useTranslation } from "@repo/i18n";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { EmptyState } from "@repo/ui/components/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components/table";
import { cn } from "@repo/ui/lib/utils";

import type { ActivityEntry, ActivityKind } from "./device-activity";

const PAGE_SIZE = 25;

// Status tints, not the primary badge: black on the primary teal is unreadable.
const KIND_CLASS: Record<ActivityKind, string> = {
  connected:
    "border-transparent bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  disconnected: "border-transparent bg-secondary text-secondary-foreground",
  firmwareChanged: "",
  registered: "",
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
  const locale = useLocale();
  const [page, setPage] = useState(1);

  if (entries.length === 0) {
    return <EmptyState size="inline" description={t("iot.devices.monitoring.noEvents")} />;
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
                  {formatTimestamp(entry.timestamp, locale)}
                </TableCell>
                <TableCell className="text-xs">
                  <Badge variant="outline" className={cn("font-normal", KIND_CLASS[entry.kind])}>
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
