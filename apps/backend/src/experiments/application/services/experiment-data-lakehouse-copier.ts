import { success } from "../../../common/utils/fp-utils";
import type { Result } from "../../../common/utils/fp-utils";

/** What copying one group of records came to. */
export type CopyOutcome = "copied" | "stopped" | { failed: string };

/**
 * Copies one kind of record from Postgres to the lakehouse. A copy takes each record's state at the
 * time of the copy: it writes the records that still exist and deletes the copies of the rest, so
 * several edits arrive as one and copying a record twice does no harm.
 */
export abstract class ExperimentDataLakehouseCopier<T extends { id: string }> {
  /** The records each statement-sized group copies. */
  groupsOf(ids: string[]): Promise<Result<string[][]>> {
    return Promise.resolve(success([ids]));
  }

  async copy(ids: string[], canContinue: () => boolean): Promise<CopyOutcome> {
    if (!canContinue()) {
      return "stopped";
    }

    const found = await this.find(ids);
    if (found.isFailure()) {
      return { failed: found.error.message };
    }
    if (!canContinue()) {
      return "stopped";
    }

    if (found.value.length > 0) {
      const merged = await this.merge(found.value, canContinue);
      if (merged.isFailure()) {
        return { failed: merged.error.message };
      }
      if (merged.value === "stopped") {
        return "stopped";
      }
    }

    const gone = this.gone(ids, found.value);
    if (gone.length === 0) {
      return "copied";
    }
    if (!canContinue()) {
      return "stopped";
    }

    const deleted = await this.remove(gone);
    return deleted.isFailure() ? { failed: deleted.error.message } : "copied";
  }

  protected abstract find(ids: string[]): Promise<Result<T[]>>;

  /** Merges in one statement or several, starting none once `canContinue` says no. */
  protected abstract merge(
    records: T[],
    canContinue: () => boolean,
  ): Promise<Result<"merged" | "stopped">>;

  protected abstract remove(ids: string[]): Promise<Result<void>>;

  protected gone(ids: string[], found: { id: string }[]): string[] {
    const kept = new Set(found.map(({ id }) => id));
    return ids.filter((id) => !kept.has(id));
  }
}
