import { useTranslation } from "@repo/i18n";

import { CoverageLine } from "./coverage-line";
import type { FieldPlan } from "./field-plan";
import type { SessionDay } from "./session-day";
import { treatmentTone } from "./session-tones";

interface TreatmentCoveragePanelProps {
  plan: FieldPlan;
  day: SessionDay;
}

export function TreatmentCoveragePanel({ plan, day }: TreatmentCoveragePanelProps) {
  const { t } = useTranslation("fieldSessions");
  const covered = plan.countByTreatment(day.covered);
  const totals = plan.totalByTreatment();
  const missing = day.missingByTreatment();

  const renderTreatment = (treatment: string, index: number) => {
    const missingPlots = (missing.get(treatment) ?? []).map((unitId) => plan.identifierOf(unitId));
    return (
      <div key={treatment} className="space-y-1">
        <CoverageLine
          label={treatment}
          measured={covered.get(treatment) ?? 0}
          total={totals.get(treatment) ?? 0}
          swatchClassName={treatmentTone(index).swatch}
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
