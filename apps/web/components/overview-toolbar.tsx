import type { ReactNode } from "react";

import { cn } from "@repo/ui/lib/utils";

interface OverviewToolbarProps {
  search: ReactNode;
  searchWidth?: "default" | "wide";
  filters?: ReactNode;
  className?: string;
}

// "Search organizations…" is the longest standard placeholder; 224px clipped its ellipsis.
const SEARCH_WIDTH = { default: "md:w-64", wide: "md:w-80" };

export function OverviewToolbar({
  search,
  searchWidth = "default",
  filters,
  className,
}: OverviewToolbarProps) {
  return (
    <div className={cn("flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center", className)}>
      <div className={cn("w-full min-w-0 md:shrink-0", SEARCH_WIDTH[searchWidth])}>{search}</div>
      {/* One scrolling row on a phone rather than two stacked ones: the chips
          are a filter strip, and wrapping them pushed the table down. Filters
          that render nothing, like an idle reset button, leave no gap. */}
      {filters ? (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 empty:hidden md:flex-wrap md:overflow-visible md:pb-0 [&>*]:shrink-0">
          {filters}
        </div>
      ) : null}
    </div>
  );
}
