import { formatHm } from "@/util/date";

import type {
  FieldShare,
  Measurer,
  SessionProgress,
} from "@repo/api/domains/experiment/sessions/experiment-sessions.schema";
import { useTranslation } from "@repo/i18n";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@repo/ui/components/card";

import { CoverageLine } from "./coverage-line";
import type { FieldPlan } from "./field-plan";
import type { FieldShares } from "./field-shares";
import { MeasurerRing } from "./measurer-ring";
import { treatmentTone } from "./session-tones";

interface LiveProgressCardProps {
  plan: FieldPlan;
  measurers: readonly Measurer[];
  shares: FieldShares;
  progress: SessionProgress;
}

export function LiveProgressCard({ plan, measurers, shares, progress }: LiveProgressCardProps) {
  const { t } = useTranslation("fieldSessions");

  const measured = new Set(progress.measurers.flatMap((entry) => entry.measuredUnitIds));
  const measuredByTreatment = plan.countByTreatment(measured);
  const totalByTreatment = plan.totalByTreatment();
  const measuredByGenotype = plan.countByGenotype(measured);
  const totalByGenotype = plan.totalByGenotype();
  const hasGenotypes = plan.genotypes.length > 0;

  const renderRing = (share: FieldShare, index: number) => {
    const entry = progress.measurers.find((candidate) => candidate.userId === share.userId);
    const inShare = new Set(share.unitIds);
    const measuredInShare = entry?.measuredUnitIds.filter((unitId) => inShare.has(unitId)) ?? [];
    const skipped = entry?.skippedUnitIds.filter((unitId) => !measured.has(unitId)) ?? [];
    const name = measurers.find((measurer) => measurer.userId === share.userId)?.name ?? "";

    return (
      <MeasurerRing
        key={share.userId}
        name={name}
        shareIndex={index}
        assigned={share.unitIds.length}
        measured={measuredInShare.length}
        skipped={skipped.length}
        lastUploadAt={entry?.lastUploadAt ?? null}
      />
    );
  };

  const renderTreatment = (treatment: string, index: number) => (
    <CoverageLine
      key={treatment}
      label={treatment}
      measured={measuredByTreatment.get(treatment) ?? 0}
      total={totalByTreatment.get(treatment) ?? 0}
      swatchClassName={treatmentTone(index).swatch}
    />
  );

  const renderGenotype = (genotype: string) => (
    <CoverageLine
      key={genotype}
      label={genotype}
      measured={measuredByGenotype.get(genotype) ?? 0}
      total={totalByGenotype.get(genotype) ?? 0}
    />
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("live.title")}</CardTitle>
        <CardAction className="text-muted-foreground text-sm">
          {t("live.updated", { time: formatHm(new Date(progress.updatedAt)) })}
        </CardAction>
      </CardHeader>
      <CardContent className="grid gap-8 lg:grid-cols-[auto_1fr_1fr]">
        <div className="flex flex-wrap gap-x-10 gap-y-4">{shares.shares.map(renderRing)}</div>
        <div className="space-y-3">
          <p className="text-sm font-medium">{t("live.byTreatment")}</p>
          {plan.treatments.map(renderTreatment)}
        </div>
        {hasGenotypes ? (
          <div className="space-y-3">
            <p className="text-sm font-medium">{t("live.byGenotype")}</p>
            {plan.genotypes.map(renderGenotype)}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
