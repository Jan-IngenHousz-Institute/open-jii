import { TriangleAlert } from "lucide-react";

import type { Measurer } from "@repo/api/domains/experiment/sessions/experiment-sessions.schema";
import { useTranslation } from "@repo/i18n";
import { Badge } from "@repo/ui/components/badge";
import { cn } from "@repo/ui/lib/utils";

import type { FieldPlan } from "./field-plan";
import { measurerTone, treatmentTone } from "./session-tones";

interface ShareCardProps {
  plan: FieldPlan;
  measurer: Measurer;
  shareIndex: number;
  unitIds: readonly string[];
}

export function ShareCard({ plan, measurer, shareIndex, unitIds }: ShareCardProps) {
  const { t } = useTranslation("fieldSessions");

  const counts = [...plan.countByTreatment(unitIds)].filter(([, count]) => count > 0);
  const isOneTreatment = counts.length === 1;
  const isBalanced = !isOneTreatment && plan.isBalanced(unitIds);
  const hasPlots = unitIds.length > 0;
  const rows = hasPlots ? plan.rowsCovered(unitIds) : null;

  const renderCount = ([treatment, count]: [string, number]) => (
    <span key={treatment} className="flex items-center gap-1.5">
      <span
        className={cn(
          "size-2.5 rounded-sm",
          treatmentTone(plan.treatments.indexOf(treatment)).swatch,
        )}
      />
      {treatment} {count}
    </span>
  );

  return (
    <div className="space-y-2 rounded-lg border p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-sm font-medium">
          <span className={cn("size-3 rounded-sm border-2", measurerTone(shareIndex).border)} />
          {measurer.name}
        </span>
        {isBalanced ? (
          <Badge className="bg-status-active text-status-active-foreground">
            {t("divide.balanced")}
          </Badge>
        ) : null}
        {isOneTreatment ? (
          <Badge className="bg-status-stale text-status-stale-foreground">
            <TriangleAlert />
            {t("divide.oneTreatment")}
          </Badge>
        ) : null}
      </div>
      <p className="text-muted-foreground text-sm">
        {rows
          ? t("divide.sharePlots", { count: unitIds.length, first: rows.first, last: rows.last })
          : t("divide.sharePlotsCount", { count: 0 })}
      </p>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">{counts.map(renderCount)}</div>
      {isOneTreatment ? (
        <p className="text-status-stale-foreground text-xs">{t("divide.oneTreatmentWarning")}</p>
      ) : null}
    </div>
  );
}
