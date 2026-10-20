import type { ExperimentUnit } from "@repo/api/domains/experiment/layout/experiment-layout.schema";
import { useTranslation } from "@repo/i18n";

import type { FieldPlan } from "./field-plan";
import type { SessionDay } from "./session-day";
import { SessionGrid } from "./session-grid";
import { SessionGridCell } from "./session-grid-cell";
import { treatmentTone } from "./session-tones";

interface SessionFieldMapProps {
  plan: FieldPlan;
  day: SessionDay;
}

export function SessionFieldMap({ plan, day }: SessionFieldMapProps) {
  const { t } = useTranslation("fieldSessions");
  const skipped = new Set(day.skippedUnitIds);
  const offPlan = new Set(day.offPlanUnitIds);

  const offPlanDot = <span className="bg-destructive block size-1.5 rounded-full" />;

  const renderCell = (unit: ExperimentUnit | undefined) => {
    if (!unit) {
      return <SessionGridCell unit={unit} isCompact />;
    }
    const tone = treatmentTone(plan.treatmentIndexOf(unit.id));
    const isCovered = day.covered.has(unit.id);
    const isSkipped = skipped.has(unit.id);

    return (
      <SessionGridCell
        unit={unit}
        isCompact
        fillClassName={isCovered ? tone.full : tone.pale}
        borderClassName={isSkipped ? "border-status-stale-foreground" : undefined}
        isDashed={isSkipped}
        marker={offPlan.has(unit.id) ? offPlanDot : undefined}
      />
    );
  };

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">{t("overview.fieldMap")}</p>
      <SessionGrid layout={plan.layout} renderCell={renderCell} isCompact />
      <div className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        <span className="flex items-center gap-1.5">
          <span className="bg-foreground/40 size-3 rounded-sm" />
          {t("overview.legendMeasured")}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="border-status-stale-foreground size-3 rounded-sm border-2 border-dashed" />
          {t("overview.legendSkipped")}
        </span>
        <span className="flex items-center gap-1.5">
          {offPlanDot}
          {t("overview.legendOffPlan")}
        </span>
      </div>
    </div>
  );
}
