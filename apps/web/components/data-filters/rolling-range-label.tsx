import type { ExperimentRelativeTimeWindow } from "@repo/api/domains/experiment/data/experiment-data.schema";
import { resolveRelativeTimeWindow } from "@repo/api/transforms/relative-time-filter";
import { useTranslation } from "@repo/i18n";
import { cn } from "@repo/ui/lib/utils";

import { formatYmdHm } from "../../util/date";
import { relativeTimePresetLabelKey } from "./value-inputs/date-range-presets";

export function RollingRangeLabel({
  window,
  evaluation,
  compact = false,
}: {
  window: ExperimentRelativeTimeWindow;
  evaluation: { at: number; server: boolean };
  compact?: boolean;
}) {
  const { t } = useTranslation("common");
  const bounds = resolveRelativeTimeWindow(window, evaluation.at)
    .map((at) => formatYmdHm(new Date(at)))
    .join(" → ");
  const detailClass = cn(
    "text-muted-foreground block truncate",
    compact ? "text-[10px]" : "text-xs",
  );
  return (
    <span className="min-w-0 text-left">
      <span className="block truncate">{t(relativeTimePresetLabelKey(window))}</span>
      <span className={detailClass} title={bounds}>
        {bounds}
      </span>
      {!evaluation.server && <span className={detailClass}>{t("dataFilters.rangePreview")}</span>}
    </span>
  );
}
