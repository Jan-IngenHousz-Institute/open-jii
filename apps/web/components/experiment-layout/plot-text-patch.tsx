import type { ReactNode } from "react";

import { cn } from "@repo/ui/lib/utils";

interface PlotTextPatchProps {
  /** The plot's own fill, laid over the card color so the patch matches the plot exactly. */
  fillClassName: string;
  className?: string;
  /** Room around the text, so a line drawn under the patch stops clear of it. */
  padClassName?: string;
  children: ReactNode;
}

/** Text on a plot, raised above a line drawn over the grid on a patch of the plot's fill. */
export function PlotTextPatch({
  fillClassName,
  className,
  padClassName = "px-0.5",
  children,
}: PlotTextPatchProps) {
  return (
    <span className={cn("bg-card z-2 rounded-md", className)}>
      <span className={cn("block rounded-md", padClassName, fillClassName)}>{children}</span>
    </span>
  );
}
