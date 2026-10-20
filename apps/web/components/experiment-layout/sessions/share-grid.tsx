import type { ExperimentUnit } from "@repo/api/domains/experiment/layout/experiment-layout.schema";
import type { Measurer } from "@repo/api/domains/experiment/sessions/experiment-sessions.schema";
import { useTranslation } from "@repo/i18n";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";

import type { FieldPlan } from "./field-plan";
import type { FieldShares } from "./field-shares";
import { MeasurerLegend } from "./measurer-legend";
import { SessionGrid } from "./session-grid";
import { SessionGridCell } from "./session-grid-cell";
import { measurerTone, treatmentTone } from "./session-tones";
import { TreatmentLegend } from "./treatment-legend";

interface ShareGridProps {
  plan: FieldPlan;
  measurers: Measurer[];
  shares: FieldShares;
  stroke: readonly string[];
  canPaint: boolean;
  onStrokeStart: (unit: ExperimentUnit) => void;
  onStrokeEnter: (unit: ExperimentUnit) => void;
  onStrokeEnd: () => void;
}

export function ShareGrid({
  plan,
  measurers,
  shares,
  stroke,
  canPaint,
  onStrokeStart,
  onStrokeEnter,
  onStrokeEnd,
}: ShareGridProps) {
  const { t } = useTranslation("fieldSessions");

  const shareMeasurers = shares.shares.flatMap((share) => {
    const measurer = measurers.find((candidate) => candidate.userId === share.userId);
    return measurer ? [measurer] : [];
  });

  const renderCell = (unit: ExperimentUnit | undefined) => {
    if (!unit) {
      return <SessionGridCell unit={unit} />;
    }
    const ownerIndex = shares.ownerIndexOf(unit.id);
    return (
      <SessionGridCell
        unit={unit}
        fillClassName={treatmentTone(plan.treatmentIndexOf(unit.id)).full}
        borderClassName={ownerIndex >= 0 ? measurerTone(ownerIndex).border : undefined}
        isHighlighted={stroke.includes(unit.id)}
        onPointerDown={canPaint ? onStrokeStart : undefined}
        onPointerEnter={canPaint ? onStrokeEnter : undefined}
      />
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("gridTitle", { level: plan.layout.levelName })}</CardTitle>
        <CardDescription>
          {t("divide.gridDescription", { count: plan.plots.length })}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <SessionGrid layout={plan.layout} renderCell={renderCell} onPointerUp={onStrokeEnd} />
      </CardContent>
      <CardFooter className="flex-wrap gap-x-6 gap-y-2 border-t pt-4">
        <MeasurerLegend measurers={shareMeasurers} />
        <TreatmentLegend plan={plan} />
      </CardFooter>
    </Card>
  );
}
