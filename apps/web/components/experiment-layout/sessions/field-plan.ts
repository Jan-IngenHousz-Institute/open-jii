import type {
  ExperimentLayout,
  ExperimentUnit,
} from "@repo/api/domains/experiment/layout/experiment-layout.schema";
import type {
  PlotAttributes,
  WalkingOrder,
  WalkingStrategy,
} from "@repo/api/domains/experiment/sessions/experiment-sessions.schema";

import { rowLetter } from "../row-letter";

/** Each treatment's count over a run of plots in walking order, and the tolerance it is held to. */
export interface WalkBalance {
  window: number;
  expected: number;
  isWithinTolerance: boolean;
}

const BALANCE_PER_TREATMENT = 4;
const BALANCE_TOLERANCE = 1;

/** A layout read together with its plots' attributes and walking order. */
export class FieldPlan {
  readonly plots: readonly ExperimentUnit[];
  readonly treatments: readonly string[];
  readonly genotypes: readonly string[];
  readonly strategy: WalkingStrategy | null;
  readonly seed: string | null;

  private readonly attributes: ReadonlyMap<string, PlotAttributes>;
  private readonly positions: ReadonlyMap<string, number>;
  private readonly byPosition: ReadonlyMap<string, ExperimentUnit>;
  private readonly order: readonly string[];

  constructor(
    readonly layout: ExperimentLayout,
    walkingOrder: WalkingOrder,
  ) {
    this.plots = layout.units.filter((unit) => unit.active);
    this.strategy = walkingOrder.strategy;
    this.seed = walkingOrder.seed;
    this.attributes = new Map(walkingOrder.plots.map((plot) => [plot.unitId, plot]));
    this.order = walkingOrder.order;
    this.positions = new Map(walkingOrder.order.map((unitId, index) => [unitId, index + 1]));

    const byPosition = new Map<string, ExperimentUnit>();
    for (const unit of layout.units) {
      if (unit.row !== null && unit.column !== null) {
        byPosition.set(FieldPlan.positionKey(unit.row, unit.column), unit);
      }
    }
    this.byPosition = byPosition;

    this.treatments = FieldPlan.distinct(walkingOrder.plots.map((plot) => plot.treatment));
    this.genotypes = FieldPlan.distinct(walkingOrder.plots.map((plot) => plot.genotype));
  }

  get hasTreatments(): boolean {
    return this.treatments.length > 0;
  }

  unitAt(row: number, column: number): ExperimentUnit | undefined {
    return this.byPosition.get(FieldPlan.positionKey(row, column));
  }

  identifierOf(unitId: string): string {
    return this.plots.find((plot) => plot.id === unitId)?.identifier ?? unitId;
  }

  treatmentOf(unitId: string): string | null {
    return this.attributes.get(unitId)?.treatment ?? null;
  }

  treatmentIndexOf(unitId: string): number {
    const treatment = this.treatmentOf(unitId);
    return treatment === null ? -1 : this.treatments.indexOf(treatment);
  }

  genotypeOf(unitId: string): string | null {
    return this.attributes.get(unitId)?.genotype ?? null;
  }

  positionOf(unitId: string): number | undefined {
    return this.positions.get(unitId);
  }

  /** Plot centers in walking order, in grid units, for drawing the walk as one line. */
  walkPoints(): { x: number; y: number }[] {
    return this.order.flatMap((unitId) => {
      const plot = this.plots.find((unit) => unit.id === unitId);
      if (plot?.row == null || plot.column == null) {
        return [];
      }
      return [{ x: plot.column - 0.5, y: plot.row - 0.5 }];
    });
  }

  /** How many of the given plots carry each treatment, in the field's treatment order. */
  countByTreatment(unitIds: Iterable<string>): Map<string, number> {
    return this.countBy(unitIds, this.treatments, (unitId) => this.treatmentOf(unitId));
  }

  countByGenotype(unitIds: Iterable<string>): Map<string, number> {
    return this.countBy(unitIds, this.genotypes, (unitId) => this.genotypeOf(unitId));
  }

  totalByTreatment(): Map<string, number> {
    return this.countByTreatment(this.plots.map((plot) => plot.id));
  }

  totalByGenotype(): Map<string, number> {
    return this.countByGenotype(this.plots.map((plot) => plot.id));
  }

  /** The first and last row letters the plots cover. */
  rowsCovered(unitIds: Iterable<string>): { first: string; last: string } {
    const rows = [...unitIds].flatMap((unitId) => {
      const row = this.plots.find((plot) => plot.id === unitId)?.row;
      return row == null ? [] : [row];
    });
    return { first: rowLetter(Math.min(...rows)), last: rowLetter(Math.max(...rows)) };
  }

  /** Whether every run of the walk holds each treatment its fair number of times, within one. */
  balance(): WalkBalance {
    const window = this.treatments.length * BALANCE_PER_TREATMENT;
    let isWithinTolerance = true;

    for (let start = 0; start + window <= this.order.length; start++) {
      const counts = this.countByTreatment(this.order.slice(start, start + window));
      for (const count of counts.values()) {
        if (Math.abs(count - BALANCE_PER_TREATMENT) > BALANCE_TOLERANCE) {
          isWithinTolerance = false;
        }
      }
    }

    return { window, expected: BALANCE_PER_TREATMENT, isWithinTolerance };
  }

  /** Whether a share holds every treatment in about the field's proportions. */
  isBalanced(unitIds: readonly string[]): boolean {
    const counts = this.countByTreatment(unitIds);
    const totals = this.totalByTreatment();
    const fraction = unitIds.length / this.plots.length;

    return this.treatments.every((treatment) => {
      const expected = (totals.get(treatment) ?? 0) * fraction;
      return Math.abs((counts.get(treatment) ?? 0) - expected) <= BALANCE_TOLERANCE;
    });
  }

  private countBy(
    unitIds: Iterable<string>,
    keys: readonly string[],
    keyOf: (unitId: string) => string | null,
  ): Map<string, number> {
    const counts = new Map(keys.map((key) => [key, 0]));
    for (const unitId of unitIds) {
      const key = keyOf(unitId);
      if (key !== null) {
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }
    return counts;
  }

  private static positionKey(row: number, column: number): string {
    return `${row}:${column}`;
  }

  private static distinct(values: readonly (string | null)[]): string[] {
    const present = values.filter((value): value is string => value !== null);
    return [...new Set(present)].sort((a, b) => a.localeCompare(b));
  }
}
