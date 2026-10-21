import { useTranslation } from "@repo/i18n";

import { CoverageLine } from "./coverage-line";
import type { FieldPlan } from "./field-plan";
import type { SessionDay } from "./session-day";

interface TreatmentCoveragePanelProps {
  plan: FieldPlan;
  day: SessionDay;
}

export function TreatmentCoveragePanel({ plan, day }: TreatmentCoveragePanelProps) {
  const { t } = useTranslation("fieldSessions");
  const measured = plan.countByTreatment(day.measured);
  const totals = plan.totalByTreatment();
  const missing = day.missingByTreatment();

  const renderTreatment = (treatment: string) => {
    const missingPlots = (missing.get(treatment) ?? []).map((unitId) => plan.identifierOf(unitId));
    return (
      <div key={treatment} className="space-y-1">
        <CoverageLine
          label={treatment}
          measured={measured.get(treatment) ?? 0}
          total={totals.get(treatment) ?? 0}
          category={plan.categories.get(treatment)}
        />
        {missingPlots.length > 0 ? (
          <p className="text-muted-foreground text-xs">
            {t("overview.missing", { plots: missingPlots.join(", ") })}
          </p>
        ) : null}
      </div>
    );
  };

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">{t("overview.coverageTitle")}</p>
      {plan.treatments.map(renderTreatment)}
    </div>
  );
}
