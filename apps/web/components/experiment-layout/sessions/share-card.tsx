import { useLocale } from "@/hooks/useLocale";
import { TriangleAlert } from "lucide-react";

import { useTranslation } from "@repo/i18n";
import { Badge } from "@repo/ui/components/badge";
import { cn } from "@repo/ui/lib/utils";

import type { PlotShare } from "../plot-state";
import type { FieldPlan } from "./field-plan";
import { ShareSwatch } from "./share-swatch";
import { TreatmentChip } from "./treatment-chip";

interface ShareCardProps {
  plan: FieldPlan;
  name: string;
  style: PlotShare | undefined;
  unitIds: readonly string[];
}

/** One measurer's share: its size, where it runs in the walk, and every treatment's count. */
export function ShareCard({ plan, name, style, unitIds }: ShareCardProps) {
  const { t } = useTranslation("fieldSessions");
  const locale = useLocale();

  const counts = [...plan.countByTreatment(unitIds)];
  const missing = plan.missingTreatments(unitIds);
  const hasPlots = unitIds.length > 0;
  const isMissingTreatment = missing.length > 0;
  const isOutsideBalance = !isMissingTreatment && !plan.isBalanced(unitIds);
  const isBalanced = !isMissingTreatment && !isOutsideBalance;
  const rows = hasPlots ? plan.rowsSpanned(unitIds) : null;
  const run = plan.walkRun(unitIds);

  const size = rows
    ? t("divide.sharePlots", { count: unitIds.length, first: rows.first, last: rows.last })
    : t("divide.sharePlotsCount", { count: 0 });
  const summary = run ? t("divide.shareWalk", { size, first: run.first, last: run.last }) : size;
  const missingList = new Intl.ListFormat(locale, { type: "conjunction" }).format(missing);

  const renderCount = ([treatment, count]: [string, number]) => {
    const category = plan.categories.get(treatment);
    return (
      <span
        key={treatment}
        className={cn(
          "flex items-center gap-1.5",
          count === 0 && "text-status-stale-foreground font-medium",
        )}
      >
        <TreatmentChip category={category} />
        {treatment} {count}
      </span>
    );
  };

  return (
    <div className="space-y-2 rounded-lg border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex shrink-0 items-center gap-2 text-sm font-medium">
          <ShareSwatch style={style} />
          {name}
        </span>
        {isBalanced ? (
          <Badge className="bg-status-active text-status-active-foreground">
            {t("divide.balanced")}
          </Badge>
        ) : (
          <Badge className="bg-status-stale text-status-stale-foreground whitespace-normal text-left">
            <TriangleAlert aria-hidden />
            {isMissingTreatment
              ? t("divide.missing", { treatments: missingList })
              : t("divide.outsideBalance")}
          </Badge>
        )}
      </div>
      <p className="text-muted-foreground text-sm">{summary}</p>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">{counts.map(renderCount)}</div>
      {isBalanced ? null : (
        <p className="text-status-stale-foreground text-xs">
          {isMissingTreatment ? t("divide.missingWarning") : t("divide.outsideWarning")}
        </p>
      )}
    </div>
  );
}
