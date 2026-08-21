"use client";

import { useTranslation } from "@repo/i18n";
import { Badge } from "@repo/ui/components/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components/table";
import { cn } from "@repo/ui/lib/utils";

import type { BulkBatch, BulkRow, BulkRowStatus } from "./bulk-register-parse";
import { LIST_HEADER_BG, LIST_TABLE_BORDER, LIST_TEXT_MUTED } from "./iot-devices-list-tokens";

interface BulkRegisterPreviewProps {
  batch: BulkBatch;
}

const STATUS_CLASS: Record<BulkRowStatus, string> = {
  ready: "border-transparent bg-status-active text-status-active-foreground",
  invalid: "border-transparent bg-status-stale text-status-stale-foreground",
  duplicate: "border-transparent bg-status-stale text-status-stale-foreground",
  registered: "border-transparent bg-secondary text-secondary-foreground",
};

/**
 * The pre-flight: every pasted line classified before anything is sent, so
 * typos, in-batch duplicates, and already-registered serials are visible and
 * excluded up front instead of coming back as per-row failures.
 */
export function BulkRegisterPreview({ batch }: BulkRegisterPreviewProps) {
  const { t } = useTranslation("iot");

  function renderRow(row: BulkRow, index: number) {
    return (
      <TableRow key={`${row.serialNumber}:${String(index)}`} className={LIST_TABLE_BORDER}>
        <TableCell className="px-4 py-2 font-mono text-xs">
          {row.status === "invalid" ? row.line : row.serialNumber}
        </TableCell>
        <TableCell className={cn("px-4 py-2 text-[13px]", LIST_TEXT_MUTED)}>{row.name}</TableCell>
        <TableCell className="px-4 py-2">
          <Badge variant="outline" className={cn("font-normal", STATUS_CLASS[row.status])}>
            {t(`iot.devices.bulkDialog.status.${row.status}`)}
          </Badge>
        </TableCell>
      </TableRow>
    );
  }

  return (
    <div className={cn("max-h-64 overflow-y-auto rounded-lg border", LIST_TABLE_BORDER)}>
      <Table>
        <TableHeader>
          <TableRow className={cn("hover:bg-transparent", LIST_HEADER_BG, LIST_TABLE_BORDER)}>
            <ColumnHead>{t("iot.devices.bulkDialog.serialColumn")}</ColumnHead>
            <ColumnHead>{t("iot.devices.bulkDialog.nameColumn")}</ColumnHead>
            <ColumnHead>{t("iot.devices.bulkDialog.statusColumn")}</ColumnHead>
          </TableRow>
        </TableHeader>
        <TableBody>{batch.rows.map(renderRow)}</TableBody>
      </Table>
    </div>
  );
}

function ColumnHead({ children }: { children: React.ReactNode }) {
  return (
    <TableHead
      className={cn(
        "h-9 px-4 align-middle text-[11px] font-semibold uppercase tracking-[0.02em]",
        LIST_TEXT_MUTED,
      )}
    >
      {children}
    </TableHead>
  );
}
