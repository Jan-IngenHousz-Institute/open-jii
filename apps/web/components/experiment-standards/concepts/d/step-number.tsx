import type { ReactNode } from "react";

/** The round marker in front of a step: its rank, or a lock when the step waits. */
export function StepNumber({ children }: { children: ReactNode }) {
  return (
    <span className="bg-muted text-muted-foreground flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-medium tabular-nums">
      {children}
    </span>
  );
}
