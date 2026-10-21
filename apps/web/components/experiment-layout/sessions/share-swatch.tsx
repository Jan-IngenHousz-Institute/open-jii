import { cn } from "@repo/ui/lib/utils";

import type { PlotShare } from "../plot-state";

interface ShareSwatchProps {
  style: PlotShare | undefined;
}

/** A share's border with its measurer's initials, as the plot-state legend draws it. */
export function ShareSwatch({ style }: ShareSwatchProps) {
  return (
    <span
      className={cn(
        "flex h-4 min-w-6 items-center justify-center rounded-sm border-2 px-0.5 text-[9px] font-semibold",
        style?.borderClassName ?? "border-border",
      )}
    >
      {style?.initials}
    </span>
  );
}
