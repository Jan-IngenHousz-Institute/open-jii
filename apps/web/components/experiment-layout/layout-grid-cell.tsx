import type { ExperimentUnit } from "@repo/api/domains/experiment/layout/experiment-layout.schema";

import type { PlotCategory } from "./plot-state";
import { PlotStateCell } from "./plot-state-cell";

interface LayoutGridCellProps {
  unit: ExperimentUnit | undefined;
  category?: PlotCategory;
  isSelected: boolean;
  /** Absent in a preview, where nothing can be inspected yet. */
  onSelect?: (unit: ExperimentUnit) => void;
}

/** One position of the Plots view in its default mode, where clicking a plot inspects it. */
export function LayoutGridCell({ unit, category, isSelected, onSelect }: LayoutGridCellProps) {
  if (unit === undefined) {
    return <PlotStateCell kind="gap" />;
  }

  const isRemoved = !unit.active && (unit.readingCount ?? 0) > 0;
  const kind = unit.active ? "plot" : isRemoved ? "removed" : "gap";
  const cell = (
    <PlotStateCell
      kind={kind}
      identifier={unit.identifier}
      category={category}
      isSelected={isSelected}
    />
  );

  if (kind === "gap" || onSelect === undefined) {
    return cell;
  }

  const handleClick = () => {
    onSelect(unit);
  };

  return (
    <button
      type="button"
      aria-label={unit.identifier}
      aria-pressed={isSelected}
      onClick={handleClick}
      className="focus-visible:ring-ring h-full w-full rounded-md transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2"
    >
      {cell}
    </button>
  );
}
