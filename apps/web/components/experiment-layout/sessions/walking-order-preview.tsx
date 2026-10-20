import { RefreshCw } from "lucide-react";

import type { ExperimentUnit } from "@repo/api/domains/experiment/layout/experiment-layout.schema";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";

import type { FieldPlan } from "./field-plan";
import { SessionGrid } from "./session-grid";
import { SessionGridCell } from "./session-grid-cell";
import { treatmentTone } from "./session-tones";
import { TreatmentLegend } from "./treatment-legend";

interface WalkingOrderPreviewProps {
  plan: FieldPlan;
  /** Numbers the plots and draws the walk; otherwise the grid shows treatments only. */
  isPreviewing: boolean;
}

export function WalkingOrderPreview({ plan, isPreviewing }: WalkingOrderPreviewProps) {
  const { t } = useTranslation("fieldSessions");
  const balance = plan.balance();
  const walkLine = plan
    .walkPoints()
    .map(({ x, y }) => `${x},${y}`)
    .join(" ");

  const renderCell = (unit: ExperimentUnit | undefined) => (
    <SessionGridCell
      unit={unit}
      fillClassName={unit ? treatmentTone(plan.treatmentIndexOf(unit.id)).full : undefined}
      order={unit && isPreviewing ? plan.positionOf(unit.id) : undefined}
    />
  );

  const walk = (
    <polyline
      points={walkLine}
      fill="none"
      className="stroke-foreground/70"
      strokeWidth={1.5}
      strokeLinejoin="round"
      strokeLinecap="round"
      vectorEffect="non-scaling-stroke"
    />
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("gridTitle", { level: plan.layout.levelName })}</CardTitle>
        <CardDescription>
          {isPreviewing
            ? t("walkingOrder.previewDescription", { count: plan.plots.length })
            : t("plotCount", { count: plan.plots.length })}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <SessionGrid
          layout={plan.layout}
          renderCell={renderCell}
          overlay={isPreviewing ? walk : undefined}
        />
      </CardContent>
      {isPreviewing ? (
        <CardFooter className="flex-col items-start gap-3 border-t pt-4">
          <TreatmentLegend plan={plan} />
          <p className="text-sm">
            {balance.isWithinTolerance
              ? t("walkingOrder.balance", { window: balance.window, expected: balance.expected })
              : t("walkingOrder.unbalanced")}
          </p>
          <div className="flex items-center gap-3">
            <span className="text-muted-foreground font-mono text-sm">
              {t("walkingOrder.seed", { seed: plan.seed })}
            </span>
            <Button type="button" variant="outline" size="sm">
              <RefreshCw className="size-4" />
              {t("walkingOrder.regenerate")}
            </Button>
          </div>
        </CardFooter>
      ) : null}
    </Card>
  );
}
