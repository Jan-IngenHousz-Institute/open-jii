import type { ExperimentUnit } from "@repo/api/domains/experiment/layout/experiment-layout.schema";
import { useTranslation } from "@repo/i18n";

import { LayoutGridCell } from "./layout-grid-cell";
import { UnitName } from "./unit-name";

interface LayoutUnplacedStripProps {
  units: readonly ExperimentUnit[];
  levelName: string;
  selectedPlotId: string | null;
  onSelect: (unit: ExperimentUnit) => void;
}

/** Plots with a name and no row and column yet, which the grid cannot draw. */
export function LayoutUnplacedStrip({
  units,
  levelName,
  selectedPlotId,
  onSelect,
}: LayoutUnplacedStripProps) {
  const { t } = useTranslation("experiments");
  const unplaced = units.filter(
    (unit) => unit.active && (unit.row === null || unit.column === null),
  );

  if (unplaced.length === 0) {
    return null;
  }

  const unitName = new UnitName(levelName);

  const renderUnit = (unit: ExperimentUnit) => (
    <div key={unit.id} className="h-10 w-14">
      <LayoutGridCell unit={unit} isSelected={unit.id === selectedPlotId} onSelect={onSelect} />
    </div>
  );

  return (
    <section aria-label={t("layout.unplaced.title")} className="space-y-2" data-unplaced-strip>
      <div>
        <h4 className="text-sm font-medium">{t("layout.unplaced.title")}</h4>
        <p className="text-muted-foreground text-xs">
          {t("layout.unplaced.description", unitName.forCount(unplaced.length))}
        </p>
      </div>
      <div className="flex flex-wrap gap-1.5">{unplaced.map(renderUnit)}</div>
    </section>
  );
}
