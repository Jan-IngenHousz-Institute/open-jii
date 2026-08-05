"use client";

import {
  Code,
  Columns3,
  FileText,
  FlaskConical,
  GitBranch,
  HelpCircle,
  Terminal,
} from "lucide-react";
import type { ReactNode } from "react";

import type { WorkbookCell } from "@repo/api/domains/workbook/workbook-cells.schema";
import { walkWorkbookCells } from "@repo/api/transforms/workbook-cell-tree";
import { useTranslation } from "@repo/i18n";
import { cn } from "@repo/ui/lib/utils";

const cellIcons: Record<string, ReactNode> = {
  protocol: <FlaskConical className="h-3 w-3" />,
  command: <Terminal className="h-3 w-3" />,
  macro: <Code className="h-3 w-3" />,
  question: <HelpCircle className="h-3 w-3" />,
  branch: <GitBranch className="h-3 w-3" />,
  markdown: <FileText className="h-3 w-3" />,
  parallel: <Columns3 className="h-3 w-3" />,
};

const cellTypeOrder = Object.keys(cellIcons);

/** Count cells by type, ignoring runtime-only output cells. */
export function getWorkbookCellSummary(cells: WorkbookCell[]): [string, number][] {
  const counts: Record<string, number> = {};
  for (const { cell } of walkWorkbookCells(cells)) {
    if (cell.type === "output") continue;
    counts[cell.type] = (counts[cell.type] ?? 0) + 1;
  }
  return Object.entries(counts);
}

/**
 * Pill badges summarizing a workbook's cells by type. Takes per-type counts (list
 * responses ship `cellTypeCounts` instead of full cells); types without an icon —
 * runtime-only output cells and unknown legacy types — are skipped.
 */
export function WorkbookCellSummary({
  counts,
  className,
}: {
  counts: Record<string, number>;
  className?: string;
}) {
  const { t } = useTranslation("workbook");
  const summary = Object.entries(counts)
    .filter(([type]) => type in cellIcons)
    .sort(([a], [b]) => cellTypeOrder.indexOf(a) - cellTypeOrder.indexOf(b));
  if (summary.length === 0) return null;
  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {summary.map(([type, count]) => (
        <span
          key={type}
          className="bg-muted text-muted-foreground inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
        >
          {cellIcons[type]}
          {t(`workbooks.cellSummary.${type}`, { count })}
        </span>
      ))}
    </div>
  );
}
