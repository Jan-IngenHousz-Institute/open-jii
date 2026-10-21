import { useTranslation } from "@repo/i18n";
import { Progress } from "@repo/ui/components/progress";

import type { PlotCategory } from "../plot-state";
import { TreatmentChip } from "./treatment-chip";

interface CoverageLineProps {
  label: string;
  measured: number;
  total: number;
  /** A treatment's fill and code, as the grid draws it. */
  category?: PlotCategory;
}

export function CoverageLine({ label, measured, total, category }: CoverageLineProps) {
  const { t } = useTranslation("fieldSessions");
  const percent = total > 0 ? (measured / total) * 100 : 0;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="flex items-center gap-1.5">
          {category ? <TreatmentChip category={category} /> : null}
          {label}
        </span>
        <span className="text-muted-foreground tabular-nums">
          {t("coverage", { measured, total })}
        </span>
      </div>
      <Progress value={percent} className="h-1.5" />
    </div>
  );
}
