import type {
  FieldShare,
  Measurer,
} from "@repo/api/domains/experiment/sessions/experiment-sessions.schema";

import type { PlotShare } from "../plot-state";
import { PlotShares } from "../plot-state";

/** The field divided between measurers, one share each, in the order the measurers were picked. */
export class FieldShares {
  /** Each share's border and initials from the plot-state legend, in share order. */
  readonly legend: PlotShares;

  private readonly owners: ReadonlyMap<string, string>;

  constructor(
    readonly shares: readonly FieldShare[],
    private readonly measurers: readonly Measurer[],
  ) {
    const owners = new Map<string, string>();
    for (const share of shares) {
      for (const unitId of share.unitIds) {
        owners.set(unitId, share.userId);
      }
    }
    this.owners = owners;
    this.legend = new PlotShares(shares.map((share) => this.nameOf(share.userId)));
  }

  nameOf(userId: string): string {
    return this.measurers.find((measurer) => measurer.userId === userId)?.name ?? "";
  }

  ownerOf(unitId: string): string | undefined {
    return this.owners.get(unitId);
  }

  /** The legend entry of a measurer's share. */
  styleOf(userId: string): PlotShare | undefined {
    return this.legend.at(this.shares.findIndex((share) => share.userId === userId));
  }

  /** The legend entry of the share a plot sits in. */
  styleOfPlot(unitId: string): PlotShare | undefined {
    const owner = this.ownerOf(unitId);
    return owner === undefined ? undefined : this.styleOf(owner);
  }

  /** Whether every given plot sits in exactly one share. */
  coversOnce(unitIds: readonly string[]): boolean {
    const assigned = this.shares.flatMap((share) => share.unitIds);
    const isUnique = new Set(assigned).size === assigned.length;
    return isUnique && unitIds.every((unitId) => this.owners.has(unitId));
  }

  /** The shares with the plots moved into one measurer's share and out of every other. */
  paint(unitIds: readonly string[], userId: string): FieldShare[] {
    const painted = new Set(unitIds);
    return this.shares.map((share) => {
      const kept = share.unitIds.filter((unitId) => !painted.has(unitId));
      const isTarget = share.userId === userId;
      return { ...share, unitIds: isTarget ? [...kept, ...unitIds] : kept };
    });
  }
}
