import { Inject, Injectable } from "@nestjs/common";

import { and, eq, experimentMetadataSheets, inArray } from "@repo/database";
import type { DatabaseInstance, DbOrTx, Transaction } from "@repo/database";

import { AppError, Result, tryCatch } from "../../../common/utils/fp-utils";
import type { MetadataSheetRecord } from "../models/experiment-metadata.model";

/** Researchers' custom metadata sheets in Postgres. */
@Injectable()
export class ExperimentMetadataRepository {
  constructor(@Inject("DATABASE") private readonly database: DatabaseInstance) {}

  /** Runs `work` as one transaction, so a write and the copies it owes land together or not at all. */
  async transaction<T>(work: (tx: Transaction) => Promise<T>): Promise<Result<T>> {
    return tryCatch(
      () => this.database.transaction(work),
      (error) => this.queryError(error),
    );
  }

  async insert(tx: DbOrTx, sheet: MetadataSheetRecord): Promise<void> {
    await tx.insert(experimentMetadataSheets).values(sheet);
  }

  /** The sheet as it reads after the update, or null when it was not there. */
  async update(
    tx: DbOrTx,
    experimentId: string,
    metadataId: string,
    metadata: Record<string, unknown>,
    updatedAt: Date,
  ): Promise<MetadataSheetRecord | null> {
    const updated = await tx
      .update(experimentMetadataSheets)
      .set({ metadata, updatedAt })
      .where(
        and(
          eq(experimentMetadataSheets.id, metadataId),
          eq(experimentMetadataSheets.experimentId, experimentId),
        ),
      )
      .returning();

    return updated.at(0) ?? null;
  }

  /** Whether the sheet was there to delete. */
  async delete(tx: DbOrTx, experimentId: string, metadataId: string): Promise<boolean> {
    const deleted = await tx
      .delete(experimentMetadataSheets)
      .where(
        and(
          eq(experimentMetadataSheets.id, metadataId),
          eq(experimentMetadataSheets.experimentId, experimentId),
        ),
      )
      .returning({ id: experimentMetadataSheets.id });

    return deleted.length > 0;
  }

  /** The sheets among `ids` that still exist. */
  async findByIds(ids: string[]): Promise<Result<MetadataSheetRecord[]>> {
    return tryCatch(
      () =>
        this.database
          .select()
          .from(experimentMetadataSheets)
          .where(inArray(experimentMetadataSheets.id, ids)),
      (error) => this.queryError(error),
    );
  }

  /**
   * Drizzle's message repeats the statement with its parameters, the sheet's contents, which would
   * reach the logs; Postgres's SQLSTATE says what went wrong. The driver puts its own failures, such
   * as CONNECT_TIMEOUT, in the same field, and those are no SQLSTATE.
   */
  private queryError(error: unknown): AppError {
    const cause = error instanceof Error ? error.cause : undefined;
    const code =
      typeof cause === "object" &&
      cause !== null &&
      "code" in cause &&
      typeof cause.code === "string" &&
      /^[0-9A-Z]{5}$/.test(cause.code)
        ? cause.code
        : null;
    return AppError.internal(
      code === null
        ? "Postgres did not answer the metadata sheets query"
        : `Postgres refused the metadata sheets query with SQLSTATE ${code}`,
    );
  }
}
