import type { Measurer } from "@repo/api/domains/experiment/sessions/experiment-sessions.schema";
import { cn } from "@repo/ui/lib/utils";

import { measurerTone } from "./session-tones";

interface MeasurerLegendProps {
  /** In share order, which picks each measurer's color. */
  measurers: readonly Measurer[];
}

export function MeasurerLegend({ measurers }: MeasurerLegendProps) {
  const renderMeasurer = (measurer: Measurer, index: number) => (
    <span key={measurer.userId} className="flex items-center gap-1.5">
      <span className={cn("size-3 rounded-sm border-2", measurerTone(index).border)} />
      {measurer.name}
    </span>
  );

  return (
    <div className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
      {measurers.map(renderMeasurer)}
    </div>
  );
}
