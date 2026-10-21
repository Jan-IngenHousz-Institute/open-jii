import { Info } from "lucide-react";

interface StepMarkerProps {
  holdsFreeze: boolean;
  position: number;
}

/** A step's rank in the amber of work left, or an information mark for a step that only informs. */
export function StepMarker({ holdsFreeze, position }: StepMarkerProps) {
  if (!holdsFreeze) {
    return (
      <span className="bg-muted text-muted-foreground flex size-6 shrink-0 items-center justify-center rounded-full">
        <Info aria-hidden className="size-3.5" />
      </span>
    );
  }

  return (
    <span className="bg-status-stale text-status-stale-foreground flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-medium tabular-nums">
      {position}
    </span>
  );
}
