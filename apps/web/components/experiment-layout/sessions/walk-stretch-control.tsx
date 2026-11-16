import { useTranslation } from "@repo/i18n";
import { Slider } from "@repo/ui/components/slider";

import type { FieldPlan, WalkStretch } from "./field-plan";

interface WalkStretchControlProps {
  plan: FieldPlan;
  stretch: WalkStretch;
  onMove: (first: number) => void;
}

/** Slides a stretch of the walk along it and says what the stretch holds of each balance value. */
export function WalkStretchControl({ plan, stretch, onMove }: WalkStretchControlProps) {
  const { t } = useTranslation("fieldSessions");

  const length = stretch.last - stretch.first + 1;
  const counts = [...plan.countByBalance(plan.stretchPlots(stretch))]
    .map(([value, count]) => t("walkingOrder.stretchCount", { count, value }))
    .join(", ");

  const handleChange = ([first]: number[]) => {
    onMove(first);
  };

  return (
    <div className="space-y-3" data-walk-stretch>
      <Slider
        min={1}
        max={Math.max(1, plan.order.length - length + 1)}
        step={1}
        value={[stretch.first]}
        onValueChange={handleChange}
        aria-label={t("walkingOrder.stretchLabel")}
      />
      <p className="text-sm">
        {t("walkingOrder.stretchHolds", { first: stretch.first, last: stretch.last, counts })}
      </p>
    </div>
  );
}
