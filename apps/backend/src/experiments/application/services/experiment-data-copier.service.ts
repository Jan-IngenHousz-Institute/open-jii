import { success } from "../../../common/utils/fp-utils";
import type { Result } from "../../../common/utils/fp-utils";
import type { CopyKey } from "../../core/models/experiment-data-outbox.model";

/** What copying one group of records came to. */
export type CopyOutcome = "copied" | "stopped" | { failed: string };

/**
 * Copies one kind of record from Postgres to one of its copies. A copy takes each record's state at
 * the time of the copy: it writes the records that still exist and deletes the copies of the rest,
 * so several edits arrive as one and copying a record twice does no harm.
 */
export abstract class ExperimentDataCopierService<T extends { id: string }> {
  /** The records each statement-sized group copies. */
  groupsOf(owed: CopyKey[]): Promise<Result<CopyKey[][]>> {
    return Promise.resolve(success([owed]));
  }

  /** `claimedAt` versions the serving store's copy, so a later claim wins however late it lands. */
  async copy(owed: CopyKey[], canContinue: () => boolean, claimedAt: Date): Promise<CopyOutcome> {
    if (!canContinue()) {
      return "stopped";
    }

    const found = await this.find(owed.map(({ id }) => id));
    if (found.isFailure()) {
      return { failed: found.error.message };
    }
    if (!canContinue()) {
      return "stopped";
    }

    if (found.value.length > 0) {
      const merged = await this.merge(found.value, canContinue, claimedAt);
      if (merged.isFailure()) {
        return { failed: merged.error.message };
      }
      if (merged.value === "stopped") {
        return "stopped";
      }
    }

    const gone = this.gone(owed, found.value);
    if (gone.length === 0) {
      return "copied";
    }
    if (!canContinue()) {
      return "stopped";
    }

    const deleted = await this.remove(gone, claimedAt);
    return deleted.isFailure() ? { failed: deleted.error.message } : "copied";
  }

  protected abstract find(ids: string[]): Promise<Result<T[]>>;

  /** Merges in one statement or several, starting none once `canContinue` says no. */
  protected abstract merge(
    records: T[],
    canContinue: () => boolean,
    claimedAt: Date,
  ): Promise<Result<"merged" | "stopped">>;

  protected abstract remove(gone: CopyKey[], claimedAt: Date): Promise<Result<void>>;

  protected gone(owed: CopyKey[], found: { id: string }[]): CopyKey[] {
    const kept = new Set(found.map(({ id }) => id));
    return owed.filter(({ id }) => !kept.has(id));
  }
}
