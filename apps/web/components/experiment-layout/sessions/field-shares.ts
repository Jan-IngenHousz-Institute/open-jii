import type { FieldShare } from "@repo/api/domains/experiment/sessions/experiment-sessions.schema";

/** The field divided between measurers, one share each, in the order the measurers were picked. */
export class FieldShares {
  private readonly owners: ReadonlyMap<string, string>;

  constructor(readonly shares: readonly FieldShare[]) {
    const owners = new Map<string, string>();
    for (const share of shares) {
      for (const unitId of share.unitIds) {
        owners.set(unitId, share.userId);
      }
    }
    this.owners = owners;
  }

  ownerOf(unitId: string): string | undefined {
    return this.owners.get(unitId);
  }

  /** The measurer's place among the shares, which picks their color. */
  indexOf(userId: string): number {
    return this.shares.findIndex((share) => share.userId === userId);
  }

  ownerIndexOf(unitId: string): number {
    const owner = this.ownerOf(unitId);
    return owner === undefined ? -1 : this.indexOf(owner);
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
