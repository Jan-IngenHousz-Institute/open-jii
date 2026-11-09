import { Inject, Injectable } from "@nestjs/common";

import { and, eq, experimentAnnotations, inArray, profiles, sql } from "@repo/database";
import type { DatabaseInstance, DbOrTx, Transaction } from "@repo/database";

import { AppError, Result, tryCatch } from "../../../common/utils/fp-utils";
import type {
  AnnotationCopy,
  AnnotationRecord,
  UpdateAnnotationDto,
} from "../models/experiment-data-annotation.model";

// Ten columns a record, well inside the 65,535 parameters a Postgres statement takes.
const INSERT_CHUNK = 1000;

// One parameter a row id, beside the three that name the experiment, table and type.
const ROW_ID_CHUNK = 10_000;

/** Researchers' annotations in Postgres. */
@Injectable()
export class ExperimentAnnotationsRepository {
  constructor(@Inject("DATABASE") private readonly database: DatabaseInstance) {}

  /** Runs `work` as one transaction, so a write and the copies it owes land together or not at all. */
  async transaction<T>(work: (tx: Transaction) => Promise<T>): Promise<Result<T>> {
    return tryCatch(
      () => this.database.transaction(work),
      (error) => this.queryError(error),
    );
  }

  /** Inserts every record, in statements small enough for Postgres's parameter limit. */
  async insert(tx: DbOrTx, records: AnnotationRecord[]): Promise<void> {
    for (let start = 0; start < records.length; start += INSERT_CHUNK) {
      await tx.insert(experimentAnnotations).values(records.slice(start, start + INSERT_CHUNK));
    }
  }

  /** Whether the annotation was there to update. */
  /** Updates an annotation of the given type; one of the other type stays as it is. */
  async update(
    tx: DbOrTx,
    experimentId: string,
    annotationId: string,
    type: AnnotationRecord["type"],
    update: UpdateAnnotationDto,
    updatedAt: Date,
  ): Promise<boolean> {
    const updated = await tx
      .update(experimentAnnotations)
      .set({ ...update, updatedAt })
      .where(
        and(
          eq(experimentAnnotations.id, annotationId),
          eq(experimentAnnotations.experimentId, experimentId),
          eq(experimentAnnotations.type, type),
        ),
      )
      .returning({ id: experimentAnnotations.id });

    return updated.length > 0;
  }

  /** The ids it deleted: the annotation's, or none when it was not there. */
  async delete(tx: DbOrTx, experimentId: string, annotationId: string): Promise<string[]> {
    const deleted = await tx
      .delete(experimentAnnotations)
      .where(
        and(
          eq(experimentAnnotations.id, annotationId),
          eq(experimentAnnotations.experimentId, experimentId),
        ),
      )
      .returning({ id: experimentAnnotations.id });

    return deleted.map(({ id }) => id);
  }

  /** Deletes the annotations of one type on the given rows of one table, returning their ids. */
  async deleteFromRows(
    tx: DbOrTx,
    experimentId: string,
    tableName: string,
    rowIds: string[],
    type: AnnotationRecord["type"],
  ): Promise<string[]> {
    const ids: string[] = [];

    for (let start = 0; start < rowIds.length; start += ROW_ID_CHUNK) {
      const deleted = await tx
        .delete(experimentAnnotations)
        .where(
          and(
            eq(experimentAnnotations.experimentId, experimentId),
            eq(experimentAnnotations.tableName, tableName),
            eq(experimentAnnotations.type, type),
            inArray(experimentAnnotations.rowId, rowIds.slice(start, start + ROW_ID_CHUNK)),
          ),
        )
        .returning({ id: experimentAnnotations.id });
      ids.push(...deleted.map(({ id }) => id));
    }

    return ids;
  }

  /** The annotations among `ids` that still exist, each with its author's name as it reads now. */
  async findCopies(ids: string[]): Promise<Result<AnnotationCopy[]>> {
    return tryCatch(
      () =>
        this.database
          .select({
            id: experimentAnnotations.id,
            experimentId: experimentAnnotations.experimentId,
            tableName: experimentAnnotations.tableName,
            rowId: experimentAnnotations.rowId,
            type: experimentAnnotations.type,
            contentText: experimentAnnotations.contentText,
            flagType: experimentAnnotations.flagType,
            createdBy: experimentAnnotations.createdBy,
            createdAt: experimentAnnotations.createdAt,
            updatedAt: experimentAnnotations.updatedAt,
            userName: sql<
              string | null
            >`nullif(trim(coalesce(${profiles.firstName}, '') || ' ' || coalesce(${profiles.lastName}, '')), '')`,
          })
          .from(experimentAnnotations)
          .leftJoin(profiles, eq(profiles.userId, experimentAnnotations.createdBy))
          .where(inArray(experimentAnnotations.id, ids)),
      (error) => this.queryError(error),
    );
  }

  /**
   * Drizzle's message repeats the statement with its parameters, the annotations' text and authors,
   * which would reach the logs; Postgres's SQLSTATE says what went wrong. The driver puts its own
   * failures, such as CONNECT_TIMEOUT, in the same field, and those are no SQLSTATE.
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
        ? "Postgres did not answer the annotations query"
        : `Postgres refused the annotations query with SQLSTATE ${code}`,
    );
  }
}
