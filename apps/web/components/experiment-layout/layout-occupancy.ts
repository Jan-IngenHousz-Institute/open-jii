import type { ExperimentLayout } from "@repo/api/domains/experiment/layout/experiment-layout.schema";

/** How a saved layout's positions are used: plots, and the empty positions that count as gaps. */
export class LayoutOccupancy {
  constructor(private readonly layout: ExperimentLayout) {}

  get plotCount(): number {
    return this.layout.units.filter((unit) => unit.active).length;
  }

  /** A removed plot keeps its position, so only an empty position counts as a gap. */
  get gapCount(): number {
    const occupied = this.layout.units.filter(
      (unit) =>
        (unit.active || (unit.readingCount ?? 0) > 0) && unit.row !== null && unit.column !== null,
    ).length;
    return this.layout.rows * this.layout.columns - occupied;
  }
}
