import { cn } from "@repo/ui/lib/utils";

import type { FieldPlan } from "./field-plan";
import { treatmentTone } from "./session-tones";

interface TreatmentLegendProps {
  plan: FieldPlan;
}

export function TreatmentLegend({ plan }: TreatmentLegendProps) {
  const renderTreatment = (treatment: string, index: number) => (
    <span key={treatment} className="flex items-center gap-1.5">
      <span className={cn("size-3 rounded-sm", treatmentTone(index).swatch)} />
      {treatment}
    </span>
  );

  return (
    <div className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
      {plan.treatments.map(renderTreatment)}
    </div>
  );
}
