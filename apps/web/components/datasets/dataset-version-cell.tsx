"use client";

import { useTranslation } from "@repo/i18n";
import { TableCell } from "@repo/ui/components/table";
import { cn } from "@repo/ui/lib/utils";

interface DatasetVersionCellProps {
  version: number;
  /** The row above supersedes this one, so the chain enters from the top. */
  isSupersededAbove: boolean;
  /** This row supersedes the row below, so the chain leaves through the bottom. */
  supersedesBelow: boolean;
}

export function DatasetVersionCell({
  version,
  isSupersededAbove,
  supersedesBelow,
}: DatasetVersionCellProps) {
  const { t } = useTranslation("datasets");
  const isInChain = isSupersededAbove || supersedesBelow;

  return (
    <TableCell className="relative pl-4">
      {isSupersededAbove ? (
        <span aria-hidden className="bg-primary/60 absolute left-[20px] top-0 h-1/2 w-0.5" />
      ) : null}
      {supersedesBelow ? (
        <span aria-hidden className="bg-primary/60 absolute bottom-0 left-[20px] h-1/2 w-0.5" />
      ) : null}

      <div className="relative flex items-center gap-2.5">
        <span
          aria-hidden
          className={cn(
            "size-2.5 shrink-0 rounded-full",
            isInChain ? "bg-primary" : "bg-muted-foreground/40",
          )}
        />
        <span className="font-medium">{t("list.version", { version })}</span>
      </div>
    </TableCell>
  );
}
