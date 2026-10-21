import { Pencil } from "lucide-react";

import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import { Card, CardAction, CardDescription, CardHeader, CardTitle } from "@repo/ui/components/card";

import type { FieldPlan } from "./field-plan";

interface WalkingOrderSummaryProps {
  plan: FieldPlan;
  /** Opens the strategy cards. Absent for viewers. */
  onChange?: () => void;
}

/** The saved strategy in one line, once the view's work has moved on to dividing the field. */
export function WalkingOrderSummary({ plan, onChange }: WalkingOrderSummaryProps) {
  const { t } = useTranslation("fieldSessions");

  const strategy =
    plan.strategy === null ? "" : t(`walkingOrder.strategies.${plan.strategy}.label`);
  const summary =
    plan.orderCode === null
      ? t("walkingOrder.summaryNoCode", { strategy })
      : t("walkingOrder.summary", { strategy, code: plan.orderCode });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("walkingOrder.title")}</CardTitle>
        <CardDescription>{summary}</CardDescription>
        {onChange ? (
          <CardAction>
            <Button type="button" variant="outline" size="sm" onClick={onChange}>
              <Pencil className="size-4" aria-hidden />
              {t("walkingOrder.change")}
            </Button>
          </CardAction>
        ) : null}
      </CardHeader>
    </Card>
  );
}
