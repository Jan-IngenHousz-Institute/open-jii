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
      {filters ? <div className="flex flex-wrap items-center gap-2">{filters}</div> : null}
    </div>
  );
}
