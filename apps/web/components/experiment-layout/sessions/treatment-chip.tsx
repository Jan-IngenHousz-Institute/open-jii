import { cn } from "@repo/ui/lib/utils";

import type { PlotCategory } from "../plot-state";

interface TreatmentChipProps {
  category: PlotCategory | undefined;
}

/** A treatment's fill and one-letter code, as the plot-state legend draws it beside a count. */
export function TreatmentChip({ category }: TreatmentChipProps) {
  return (
    <span
      className={cn(
        "border-foreground/15 text-foreground/70 flex size-4 shrink-0 items-center justify-center rounded-sm border text-[10px] font-semibold",
        category?.fillClassName ?? "bg-muted/50",
      )}
    >
      {category?.code}
    </span>
  );
}
