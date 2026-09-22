import type { ReactNode } from "react";

import { cn } from "@repo/ui/lib/utils";

interface OverviewToolbarProps {
  search: ReactNode;
  filters?: ReactNode;
  className?: string;
}

export function OverviewToolbar({ search, filters, className }: OverviewToolbarProps) {
  return (
    <div className={cn("flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center", className)}>
      <div className="min-w-0 md:shrink-0">{search}</div>
      {/* One scrolling row on a phone rather than two stacked ones: the chips
          are a filter strip, and wrapping them pushed the table down. */}
      {filters ? (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 md:flex-wrap md:overflow-visible md:pb-0 [&>*]:shrink-0">
          {filters}
        </div>
      ) : null}
    </div>
  );
}
