import type {
  ExperimentLayout,
  ExperimentLayoutSetup,
  ExperimentUnit,
} from "@repo/api/domains/experiment/layout/experiment-layout.schema";
import { LAYOUT_MAX_SIDE } from "@repo/api/domains/experiment/layout/experiment-layout.schema";

import { LayoutNamingScheme } from "./layout-naming";

/**
 * What saving the setup form would make: the generated grid, keeping the gaps of a saved layout
 * that still fall inside it, and the saved plots the new size leaves out.
 */
export class LayoutPreview {
  readonly layout: ExperimentLayout;
  readonly removedPlots: readonly ExperimentUnit[];

  constructor(setup: ExperimentLayoutSetup, saved: ExperimentLayout | null) {
    const rows = LayoutPreview.side(setup.rows);
    const columns = LayoutPreview.side(setup.columns);
    const naming = new LayoutNamingScheme(setup.naming, columns, setup.firstNumber);
    const savedGaps = new Set(
      (saved?.units ?? [])
        .filter((unit) => !unit.active)
        .map((unit) => LayoutPreview.key(unit.row, unit.column)),
    );

    const units: ExperimentUnit[] = [];
    for (let row = 1; row <= rows; row++) {
      for (let column = 1; column <= columns; column++) {
        if (!savedGaps.has(LayoutPreview.key(row, column))) {
          units.push({
            id: `preview-${row}-${column}`,
            parentId: null,
            identifier: naming.identifier(row, column),
            row,
            column,
            active: true,
          });
        }
      }
    }

    this.layout = { ...setup, rows, columns, units };
    this.removedPlots = (saved?.units ?? []).filter(
      (unit) =>
        unit.active &&
        unit.row !== null &&
        unit.column !== null &&
        (unit.row > rows || unit.column > columns),
    );
  }

  get plotCount(): number {
    return this.layout.units.length;
  }

  get measuredRemovedCount(): number {
    return this.removedPlots.filter((unit) => (unit.readingCount ?? 0) > 0).length;
  }

  // A field being typed can hold an empty or out-of-range side for a moment.
  private static side(value: number): number {
    return Number.isInteger(value) && value > 0 ? Math.min(value, LAYOUT_MAX_SIDE) : 1;
  }

  private static key(row: number | null, column: number | null): string {
    return `${row}:${column}`;
  }
}
