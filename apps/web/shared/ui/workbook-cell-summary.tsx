"use client";

import { Code, FileText, FlaskConical, GitBranch, HelpCircle } from "lucide-react";
import type { ReactNode } from "react";

import type { WorkbookCell } from "@repo/api/schemas/workbook-cells.schema";
import { useTranslation } from "@repo/i18n";
import { cn } from "@repo/ui/lib/utils";

const cellIcons: Record<string, ReactNode> = {
  protocol: <FlaskConical className="h-3 w-3" />,
  macro: <Code className="h-3 w-3" />,
  question: <HelpCircle className="h-3 w-3" />,
  branch: <GitBranch className="h-3 w-3" />,
  markdown: <FileText className="h-3 w-3" />,
};

/** Count cells by type, ignoring runtime-only output cells. */
export function getWorkbookCellSummary(cells: WorkbookCell[]): [string, number][] {
  const counts: Record<string, number> = {};
  for (const cell of cells) {
    if (cell.type === "output") continue;
    counts[cell.type] = (counts[cell.type] ?? 0) + 1;
  }
  return Object.entries(counts);
}

/** Pill badges summarizing a workbook's cells by type. */
export function WorkbookCellSummary({
  cells,
  className,
}: {
  cells: WorkbookCell[];
  className?: string;
}) {
  const { t } = useTranslation("workbook");
  const summary = getWorkbookCellSummary(cells);
  if (summary.length === 0) return null;
  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {summary.map(([type, count]) => {
        const icon = cellIcons[type];
        if (!icon) return null;
        return (
          <span
            key={type}
            className="bg-muted text-muted-foreground inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
          >
            {icon}
            {t(`workbooks.cellSummary.${type}`, { count })}
          </span>
        );
      })}
    </div>
  );
}
