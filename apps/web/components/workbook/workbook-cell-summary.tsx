import { Code, FileText, FlaskConical, GitBranch, HelpCircle } from "lucide-react";
import type { ReactNode } from "react";

import type { WorkbookCell } from "@repo/api/schemas/workbook-cells.schema";
import { cn } from "@repo/ui/lib/utils";

const cellMeta: Record<string, { label: string; icon: ReactNode }> = {
  protocol: { label: "Protocol", icon: <FlaskConical className="h-3 w-3" /> },
  macro: { label: "Macro", icon: <Code className="h-3 w-3" /> },
  question: { label: "Question", icon: <HelpCircle className="h-3 w-3" /> },
  branch: { label: "Branch", icon: <GitBranch className="h-3 w-3" /> },
  markdown: { label: "Note", icon: <FileText className="h-3 w-3" /> },
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
  const summary = getWorkbookCellSummary(cells);
  if (summary.length === 0) return null;
  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {summary.map(([type, count]) => {
        const meta = cellMeta[type];
        return (
          <span
            key={type}
            className="bg-muted text-muted-foreground inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
          >
            {meta.icon}
            {count} {meta.label}
            {count > 1 ? "s" : ""}
          </span>
        );
      })}
    </div>
  );
}
