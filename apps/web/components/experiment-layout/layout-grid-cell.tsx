import type { ExperimentUnit } from "@repo/api/domains/experiment/layout/experiment-layout.schema";
import { useTranslation } from "@repo/i18n";
import { cn } from "@repo/ui/lib/utils";

interface LayoutGridCellProps {
  unit: ExperimentUnit | undefined;
}

export function LayoutGridCell({ unit }: LayoutGridCellProps) {
  const { t } = useTranslation("experiments");
  const isGap = !unit?.active;

  return (
    <div
      title={isGap ? t("layout.gap") : unit.identifier}
      className={cn(
        "flex h-10 items-center justify-center rounded-md border text-xs font-medium",
        isGap
          ? "text-muted-foreground border-dashed bg-transparent"
          : "bg-primary/5 border-primary/20 text-foreground",
      )}
    >
      {isGap ? t("layout.gapShort") : unit.identifier}
    </div>
  );
}
