import type { ExperimentUnit } from "@repo/api/domains/experiment/layout/experiment-layout.schema";
import { useTranslation } from "@repo/i18n";
import { cn } from "@repo/ui/lib/utils";

interface LayoutGridCellProps {
  unit: ExperimentUnit | undefined;
  isSelected: boolean;
  onSelect: (unit: ExperimentUnit) => void;
}

export function LayoutGridCell({ unit, isSelected, onSelect }: LayoutGridCellProps) {
  const { t } = useTranslation("experiments");

  if (unit === undefined || !unit.active) {
    return (
      <div
        title={t("layout.gap")}
        className="text-muted-foreground flex h-10 items-center justify-center rounded-md border border-dashed bg-transparent text-xs font-medium"
      >
        {t("layout.gapShort")}
      </div>
    );
  }

  const handleClick = () => {
    onSelect(unit);
  };

  return (
    <button
      type="button"
      title={unit.identifier}
      aria-pressed={isSelected}
      onClick={handleClick}
      className={cn(
        "flex h-10 items-center justify-center rounded-md border text-xs font-medium transition-colors",
        isSelected
          ? "bg-primary text-primary-foreground border-primary"
          : "bg-primary/5 border-primary/20 text-foreground hover:bg-primary/10",
      )}
    >
      {unit.identifier}
    </button>
  );
}
