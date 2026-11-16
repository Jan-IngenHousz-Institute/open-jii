import type {
  ExperimentLayout,
  ExperimentUnit,
} from "@repo/api/domains/experiment/layout/experiment-layout.schema";
import type {
  FieldShare,
  FieldSplit,
  WalkingOrder,
  WalkingStrategy,
} from "@repo/api/domains/experiment/sessions/experiment-sessions.schema";

import { PlotCategories } from "../plot-state";
import { rowLetter } from "../row-letter";

/** Each balance value's share of a run of plots in walking order, held to its share of the field. */
export interface WalkBalance {
  window: number;
  /** Walk positions, from 1, of the first run that leaves the tolerance. */
  outside: { first: number; last: number } | null;
}

/** A stretch of the walk, by one-based positions. */
export interface WalkStretch {
  first: number;
  last: number;
}

const WINDOW_PER_VALUE = 4;
const BALANCE_TOLERANCE = 1;
const RANDOM_STRATEGIES: readonly WalkingStrategy[] = [
  "random",
  "randomByBlock",
  "treatmentBalanced",
];

// Header names only suggest a role, and the researcher can pick any other attribute.
const SUGGESTED_BALANCE = "treatment";
const SUGGESTED_BLOCKS = "block";

/** A layout read together with its plots' attributes and walking order. */
export class FieldPlan {
  readonly plots: readonly ExperimentUnit[];
  readonly attributeNames: readonly string[];
  /** The attribute walks, shares and progress balance and count by. */
  readonly balanceName: string | null;
  /** The attribute Random by block and row bands group plots by. */
  readonly blocksName: string | null;
  readonly balanceValues: readonly string[];
  readonly categories: PlotCategories;
  readonly strategy: WalkingStrategy | null;
  readonly orderCode: string | null;
  readonly order: readonly string[];

  private readonly values: ReadonlyMap<string, Readonly<Record<string, string>>>;
  private readonly positions: ReadonlyMap<string, number>;

  constructor(
    readonly layout: ExperimentLayout,
    walkingOrder: WalkingOrder,
  ) {
    this.plots = layout.units.filter((unit) => unit.active);
    this.strategy = walkingOrder.strategy;
    this.orderCode = walkingOrder.orderCode;
    this.attributeNames = walkingOrder.attributes;
    this.values = new Map(walkingOrder.plots.map((plot) => [plot.unitId, plot.values]));
    this.order = walkingOrder.order;
    this.positions = new Map(walkingOrder.order.map((unitId, index) => [unitId, index + 1]));

    const roles = FieldPlan.rolesOf(walkingOrder);
    this.balanceName = roles.balanceName;
    this.blocksName = roles.blocksName;
    this.balanceValues = this.distinctValues(this.balanceName);
    this.categories = new PlotCategories(this.balanceValues);
  }

  get hasAttributes(): boolean {
    return this.attributeNames.length > 0;
  }

  get hasBalance(): boolean {
    return this.balanceValues.length > 0;
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

  valueOf(unitId: string, attribute: string | null): string | null {
    return attribute === null ? null : (this.values.get(unitId)?.[attribute] ?? null);
  }

  balanceValueOf(unitId: string): string | null {
    return this.valueOf(unitId, this.balanceName);
  }

  positionOf(unitId: string): number | undefined {
    return this.positions.get(unitId);
  }

  /** Attributes other than the balance and blocks ones, which progress can also count by. */
  get otherAttributes(): string[] {
    return this.attributeNames.filter(
      (name) => name !== this.balanceName && name !== this.blocksName,
    );
  }

  /** Plot centers in walking order, in grid units, for drawing the walk as one line. */
  walkPoints(unitIds: readonly string[] = this.order): { x: number; y: number }[] {
    return unitIds.flatMap((unitId) => {
      const plot = this.plots.find((unit) => unit.id === unitId);
      if (plot?.row == null || plot.column == null) {
        return [];
      }
      return [{ x: plot.column - 0.5, y: plot.row - 0.5 }];
    });
  }

  /** The plots of a stretch of the walk. */
  stretchPlots({ first, last }: WalkStretch): readonly string[] {
    return this.order.slice(first - 1, last);
  }

  /** How many of the given plots carry each balance value, zeros included, in the field's order. */
  countByBalance(unitIds: Iterable<string>): Map<string, number> {
    return this.countByAttribute(this.balanceName, unitIds);
  }

  totalByBalance(): Map<string, number> {
    return this.countByBalance(this.plots.map((plot) => plot.id));
  }

  countByAttribute(attribute: string | null, unitIds: Iterable<string>): Map<string, number> {
    const counts = new Map(this.distinctValues(attribute).map((value) => [value, 0]));
    for (const unitId of unitIds) {
      const value = this.valueOf(unitId, attribute);
      if (value !== null) {
        counts.set(value, (counts.get(value) ?? 0) + 1);
      }
    }
    return counts;
  }

  totalByAttribute(attribute: string): Map<string, number> {
    return this.countByAttribute(
      attribute,
      this.plots.map((plot) => plot.id),
    );
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

  /** Whether every run of the walk holds each balance value in proportion to the field, within one. */
  balance(): WalkBalance {
    const window = WINDOW_PER_VALUE * Math.max(this.balanceValues.length, 1);

    for (let start = 0; start + window <= this.order.length; start++) {
      const run = this.order.slice(start, start + window);
      if (!this.isBalanced(run)) {
        return { window, outside: { first: start + 1, last: start + window } };
      }
    }

    return { window, outside: null };
  }

  /** Balance values a share holds none of. */
  missingBalanceValues(unitIds: readonly string[]): string[] {
    return [...this.countByBalance(unitIds)]
      .filter(([, count]) => count === 0)
      .map(([value]) => value);
  }

  /** Whether a share holds every balance value in about the field's proportions. */
  isBalanced(unitIds: readonly string[]): boolean {
    const counts = this.countByBalance(unitIds);
    const totals = this.totalByBalance();
    const fraction = unitIds.length / this.plots.length;

    return this.balanceValues.every((value) => {
      const expected = (totals.get(value) ?? 0) * fraction;
      return Math.abs((counts.get(value) ?? 0) - expected) <= BALANCE_TOLERANCE;
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
    const blockOf = (unitId: string) => this.valueOf(unitId, this.blocksName) ?? "";
    const blocks = FieldPlan.distinct(this.order.map(blockOf));
    const blocksEach = Math.ceil(blocks.length / Math.max(userIds.length, 1));

    return userIds.map((userId, index) => {
      const owned = new Set(blocks.slice(index * blocksEach, (index + 1) * blocksEach));
      return {
        userId,
        unitIds: this.order.filter((unitId) => owned.has(blockOf(unitId))),
      };
    });
  }

  private distinctValues(attribute: string | null): string[] {
    return FieldPlan.distinct(
      [...this.values.keys()].map((unitId) => this.valueOf(unitId, attribute)),
    );
  }

  /** The attributes a walk balances on and takes blocks from: chosen, else suggested by header name. */
  static rolesOf(walkingOrder: WalkingOrder): {
    balanceName: string | null;
    blocksName: string | null;
  } {
    return {
      balanceName:
        walkingOrder.balanceOn ?? FieldPlan.suggested(walkingOrder.attributes, SUGGESTED_BALANCE),
      blocksName:
        walkingOrder.blocksFrom ?? FieldPlan.suggested(walkingOrder.attributes, SUGGESTED_BLOCKS),
    };
  }

  private static suggested(names: readonly string[], suggestion: string): string | null {
    return names.find((name) => name.trim().toLowerCase() === suggestion) ?? null;
  }

  private static distinct(values: readonly (string | null)[]): string[] {
    const present = values.filter((value): value is string => value !== null && value !== "");
    return [...new Set(present)].sort((a, b) => a.localeCompare(b, "en-US", { numeric: true }));
  }
}
