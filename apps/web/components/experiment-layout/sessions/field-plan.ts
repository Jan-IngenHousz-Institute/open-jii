import type {
  ExperimentLayout,
  ExperimentUnit,
} from "@repo/api/domains/experiment/layout/experiment-layout.schema";
import type {
  FieldShare,
  FieldSplit,
  PlotAttributes,
  WalkingOrder,
  WalkingStrategy,
} from "@repo/api/domains/experiment/sessions/experiment-sessions.schema";

import { PlotCategories } from "../plot-state";
import { rowLetter } from "../row-letter";

/** Each treatment's count over a run of plots in walking order, and the tolerance it is held to. */
export interface WalkBalance {
  window: number;
  expected: number;
  /** Walk positions, from 1, of the first run that leaves the tolerance. */
  outside: { first: number; last: number } | null;
}

const BALANCE_PER_TREATMENT = 4;
const BALANCE_TOLERANCE = 1;
const RANDOM_STRATEGIES: readonly WalkingStrategy[] = ["randomByBlock", "treatmentBalanced"];

/** A layout read together with its plots' attributes and walking order. */
export class FieldPlan {
  readonly plots: readonly ExperimentUnit[];
  readonly treatments: readonly string[];
  readonly genotypes: readonly string[];
  readonly categories: PlotCategories;
  readonly strategy: WalkingStrategy | null;
  readonly orderCode: string | null;
  readonly order: readonly string[];

  private readonly attributes: ReadonlyMap<string, PlotAttributes>;
  private readonly positions: ReadonlyMap<string, number>;

  constructor(
    readonly layout: ExperimentLayout,
    walkingOrder: WalkingOrder,
  ) {
    this.plots = layout.units.filter((unit) => unit.active);
    this.strategy = walkingOrder.strategy;
    this.orderCode = walkingOrder.orderCode;
    this.attributes = new Map(walkingOrder.plots.map((plot) => [plot.unitId, plot]));
    this.order = walkingOrder.order;
    this.positions = new Map(walkingOrder.order.map((unitId, index) => [unitId, index + 1]));

    this.treatments = FieldPlan.distinct(walkingOrder.plots.map((plot) => plot.treatment));
    this.genotypes = FieldPlan.distinct(walkingOrder.plots.map((plot) => plot.genotype));
    this.categories = new PlotCategories(this.treatments);
  }

  get hasTreatments(): boolean {
    return this.treatments.length > 0;
  }

  get hasOrder(): boolean {
    return this.order.length > 0;
  }

  get isRandom(): boolean {
    return this.strategy !== null && RANDOM_STRATEGIES.includes(this.strategy);
  }

  /** The plot the app starts from in layout order, before any strategy is saved. */
  get firstInLayout(): string {
    const first = [...this.plots]
      .sort((a, b) => (a.row ?? 0) - (b.row ?? 0) || (a.column ?? 0) - (b.column ?? 0))
      .at(0);
    return first?.identifier ?? "";
  }

  identifierOf(unitId: string): string {
    return this.plots.find((plot) => plot.id === unitId)?.identifier ?? unitId;
  }

  treatmentOf(unitId: string): string | null {
    return this.attributes.get(unitId)?.treatment ?? null;
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

  /** How many of the given plots carry each treatment, zeros included, in the field's order. */
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

  /** The first and last row letters the plots sit in. */
  rowsSpanned(unitIds: Iterable<string>): { first: string; last: string } {
    const rows = [...unitIds].flatMap((unitId) => {
      const row = this.plots.find((plot) => plot.id === unitId)?.row;
      return row == null ? [] : [row];
    });
    return { first: rowLetter(Math.min(...rows)), last: rowLetter(Math.max(...rows)) };
  }

  /** The walk positions a share runs over, when it is one unbroken run of the walk. */
  walkRun(unitIds: readonly string[]): { first: number; last: number } | null {
    const positions = unitIds
      .flatMap((unitId) => this.positions.get(unitId) ?? [])
      .sort((a, b) => a - b);
    const first = positions.at(0);
    const last = positions.at(-1);
    const isUnbroken =
      first !== undefined && last !== undefined && last - first + 1 === positions.length;
    return isUnbroken ? { first, last } : null;
  }

  /** Whether every run of the walk holds each treatment its fair number of times, within one. */
  balance(): WalkBalance {
    const window = this.treatments.length * BALANCE_PER_TREATMENT;

    for (let start = 0; start + window <= this.order.length; start++) {
      const counts = this.countByTreatment(this.order.slice(start, start + window));
      const isOutside = [...counts.values()].some(
        (count) => Math.abs(count - BALANCE_PER_TREATMENT) > BALANCE_TOLERANCE,
      );
      if (isOutside) {
        return {
          window,
          expected: BALANCE_PER_TREATMENT,
          outside: { first: start + 1, last: start + window },
        };
      }
    }

    return { window, expected: BALANCE_PER_TREATMENT, outside: null };
  }

  /** Treatments a share holds none of. */
  missingTreatments(unitIds: readonly string[]): string[] {
    return [...this.countByTreatment(unitIds)]
      .filter(([, count]) => count === 0)
      .map(([treatment]) => treatment);
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

  /**
   * Cuts the walk between measurers. Equal shares take equal runs of the walk; row bands hand out
   * whole blocks in layout order, so shares are unequal when blocks do not divide evenly.
   */
  split(split: FieldSplit, userIds: readonly string[]): FieldShare[] {
    return split === "equalShares" ? this.equalShares(userIds) : this.rowBands(userIds);
  }

  private equalShares(userIds: readonly string[]): FieldShare[] {
    const size = Math.ceil(this.order.length / Math.max(userIds.length, 1));
    return userIds.map((userId, index) => ({
      userId,
      unitIds: this.order.slice(index * size, (index + 1) * size),
    }));
  }

  private rowBands(userIds: readonly string[]): FieldShare[] {
    const blocks = FieldPlan.distinct(
      this.order.map((unitId) => this.attributes.get(unitId)?.block ?? null),
    );
    const blocksEach = Math.ceil(blocks.length / Math.max(userIds.length, 1));

    return userIds.map((userId, index) => {
      const owned = new Set(blocks.slice(index * blocksEach, (index + 1) * blocksEach));
      return {
        userId,
        unitIds: this.order.filter((unitId) => owned.has(this.attributes.get(unitId)?.block ?? "")),
      };
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

  private static distinct(values: readonly (string | null)[]): string[] {
    const present = values.filter((value): value is string => value !== null);
    return [...new Set(present)].sort((a, b) => a.localeCompare(b, "en-US", { numeric: true }));
  }
}
