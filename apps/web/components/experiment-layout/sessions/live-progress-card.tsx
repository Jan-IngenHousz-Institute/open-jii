import { useLocale } from "@/hooks/useLocale";
import { formatRelativeTime } from "@/util/date";

import type {
  FieldShare,
  SessionProgress,
} from "@repo/api/domains/experiment/sessions/experiment-sessions.schema";
import { useTranslation } from "@repo/i18n";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@repo/ui/components/card";

import { AttributeCoverage } from "./attribute-coverage";
import type { FieldPlan } from "./field-plan";
import type { FieldShares } from "./field-shares";
import { MeasurerProgress } from "./measurer-progress";

interface LiveProgressCardProps {
  plan: FieldPlan;
  shares: FieldShares;
  progress: SessionProgress;
}

/** The Field days view's side panel while sessions run: each measurer, then each attribute's values. */
export function LiveProgressCard({ plan, shares, progress }: LiveProgressCardProps) {
  const { t } = useTranslation("fieldSessions");
  const locale = useLocale();

  const measured = new Set(progress.measurers.flatMap((entry) => entry.measuredUnitIds));
  const counted = plan.balanceName === null ? [] : [plan.balanceName, ...plan.otherAttributes];

  const renderMeasurer = (share: FieldShare) => {
    const entry = progress.measurers.find((candidate) => candidate.userId === share.userId);
    const inShare = new Set(share.unitIds);
    const measuredInShare = entry?.measuredUnitIds.filter((unitId) => inShare.has(unitId)) ?? [];
    const skipped = entry?.skippedUnitIds.filter((unitId) => !measured.has(unitId)) ?? [];

    return (
      <MeasurerProgress
        key={share.userId}
        name={shares.nameOf(share.userId)}
        style={shares.styleOf(share.userId)}
        assigned={share.unitIds.length}
        measured={measuredInShare.length}
        skipped={skipped.length}
        lastUploadAt={entry?.lastUploadAt ?? null}
      />
    );
  };

  const renderAttribute = (attribute: string) => (
    <AttributeCoverage key={attribute} plan={plan} attribute={attribute} measured={measured} />
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("live.title")}</CardTitle>
        <CardAction className="text-muted-foreground text-sm">
          {t("fieldDays.updated", { time: formatRelativeTime(progress.updatedAt, locale) })}
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-5">{shares.shares.map(renderMeasurer)}</div>
        {counted.map(renderAttribute)}
      </CardContent>
    </Card>
  );
}
