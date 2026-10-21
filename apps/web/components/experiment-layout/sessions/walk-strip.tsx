import { useTranslation } from "@repo/i18n";
import { cn } from "@repo/ui/lib/utils";

import type { FieldPlan, WalkBalance } from "./field-plan";
import type { FieldShares } from "./field-shares";

interface WalkStripProps {
  plan: FieldPlan;
  outside: WalkBalance["outside"];
  shares?: FieldShares;
}

/** The walk laid out step by step from start to end, each step carrying its treatment's code. */
export function WalkStrip({ plan, outside, shares }: WalkStripProps) {
  const { t } = useTranslation("fieldSessions");

  const first = plan.order[0];
  const last = plan.order.at(-1);

  const isOutside = (position: number) =>
    outside !== null && position >= outside.first && position <= outside.last;

  const renderStep = (unitId: string, index: number) => {
    const position = index + 1;
    const treatment = plan.treatmentOf(unitId);
    const category = plan.categories.get(treatment);
    const share = shares?.styleOfPlot(unitId);

    return (
      <li
        key={unitId}
        title={t("walkingOrder.stripStep", {
          position,
          plot: plan.identifierOf(unitId),
          treatment: treatment ?? "",
        })}
        className={cn(
          "text-foreground/70 flex h-7 items-center justify-center rounded-sm text-[10px] font-semibold",
          category?.fillClassName ?? "bg-muted/50",
          share ? cn("border-2", share.borderClassName) : "border-foreground/15 border",
          isOutside(position) && "ring-status-stale-foreground ring-2",
        )}
      >
        {category?.code}
      </li>
    );
  };

  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium">{t("walkingOrder.strip")}</p>
      <ol
        className="grid gap-0.5"
        style={{ gridTemplateColumns: `repeat(${plan.order.length}, minmax(0, 1fr))` }}
      >
        {plan.order.map(renderStep)}
      </ol>
      <div className="text-muted-foreground flex justify-between text-xs">
        <span>
          {first ? t("walkingOrder.stripStart", { plot: plan.identifierOf(first) }) : null}
        </span>
        <span>{last ? t("walkingOrder.stripEnd", { plot: plan.identifierOf(last) }) : null}</span>
      </div>
    </div>
  );
}
