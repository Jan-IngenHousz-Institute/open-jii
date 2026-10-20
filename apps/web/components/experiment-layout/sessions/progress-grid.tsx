import type { ExperimentUnit } from "@repo/api/domains/experiment/layout/experiment-layout.schema";
import type {
  Measurer,
  SessionProgress,
} from "@repo/api/domains/experiment/sessions/experiment-sessions.schema";
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
import { ProgressLegend } from "./progress-legend";
import { SessionGrid } from "./session-grid";
import { SessionGridCell } from "./session-grid-cell";
import { measurerTone, treatmentTone } from "./session-tones";
import { TreatmentLegend } from "./treatment-legend";

interface ProgressGridProps {
  plan: FieldPlan;
  measurers: readonly Measurer[];
  shares: FieldShares;
  progress: SessionProgress;
}

export function ProgressGrid({ plan, measurers, shares, progress }: ProgressGridProps) {
  const { t } = useTranslation("fieldSessions");

  const measured = new Set(progress.measurers.flatMap((entry) => entry.measuredUnitIds));
  const skipped = new Set(progress.measurers.flatMap((entry) => entry.skippedUnitIds));
  const shareMeasurers = shares.shares.flatMap((share) => {
    const measurer = measurers.find((candidate) => candidate.userId === share.userId);
    return measurer ? [measurer] : [];
  });

  const renderCell = (unit: ExperimentUnit | undefined) => {
    if (!unit) {
      return <SessionGridCell unit={unit} />;
    }
    const tone = treatmentTone(plan.treatmentIndexOf(unit.id));
    const isMeasured = measured.has(unit.id);
    const isSkipped = !isMeasured && skipped.has(unit.id);
    const ownerIndex = shares.ownerIndexOf(unit.id);

    return (
      <SessionGridCell
        unit={unit}
        fillClassName={isMeasured ? tone.full : tone.pale}
        borderClassName={ownerIndex >= 0 ? measurerTone(ownerIndex).border : undefined}
        isDashed={isSkipped}
      />
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("gridTitle", { level: plan.layout.levelName })}</CardTitle>
        <CardDescription>
          {t("live.gridDescription", { measured: measured.size, total: plan.plots.length })}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <SessionGrid layout={plan.layout} renderCell={renderCell} />
      </CardContent>
      <CardFooter className="flex-wrap gap-x-6 gap-y-2 border-t pt-4">
        <ProgressLegend />
        <MeasurerLegend measurers={shareMeasurers} />
        <TreatmentLegend plan={plan} />
      </CardFooter>
    </Card>
  );
}
