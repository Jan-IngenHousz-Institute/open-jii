import { Inject, Injectable } from "@nestjs/common";

import { and, eq, experimentAnnotations, inArray } from "@repo/database";
import type { DatabaseInstance, Transaction } from "@repo/database";

import { AppError, Result, tryCatch } from "../../../common/utils/fp-utils";
import type {
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

  /** Inserts every record or none, in statements small enough for Postgres's parameter limit. */
  async insert(records: AnnotationRecord[]): Promise<Result<void>> {
    return tryCatch(
      () => this.database.transaction((tx) => this.insertInChunks(tx, records)),
      (error) => this.queryError(error),
    );
  }

  async update(
    experimentId: string,
    annotationId: string,
    update: UpdateAnnotationDto,
    updatedAt: Date,
  ): Promise<Result<void>> {
    return tryCatch(
      async () => {
        await this.database
          .update(experimentAnnotations)
          .set({ ...update, updatedAt })
          .where(
            and(
              eq(experimentAnnotations.id, annotationId),
              eq(experimentAnnotations.experimentId, experimentId),
            ),
          );
      },
      (error) => this.queryError(error),
    );
  }

  async delete(experimentId: string, annotationId: string): Promise<Result<void>> {
    return tryCatch(
      async () => {
        await this.database
          .delete(experimentAnnotations)
          .where(
            and(
              eq(experimentAnnotations.id, annotationId),
              eq(experimentAnnotations.experimentId, experimentId),
            ),
          );
      },
      (error) => this.queryError(error),
    );
  }

  async deleteFromRows(
    experimentId: string,
    tableName: string,
    rowIds: string[],
    type: AnnotationRecord["type"],
  ): Promise<Result<void>> {
    return tryCatch(
      () =>
        this.database.transaction(async (tx) => {
          for (let start = 0; start < rowIds.length; start += ROW_ID_CHUNK) {
            await tx
              .delete(experimentAnnotations)
              .where(
                and(
                  eq(experimentAnnotations.experimentId, experimentId),
                  eq(experimentAnnotations.tableName, tableName),
                  eq(experimentAnnotations.type, type),
                  inArray(experimentAnnotations.rowId, rowIds.slice(start, start + ROW_ID_CHUNK)),
                ),
              );
          }
        }),
      (error) => this.queryError(error),
    );
  }

  private async insertInChunks(tx: Transaction, records: AnnotationRecord[]): Promise<void> {
    for (let start = 0; start < records.length; start += INSERT_CHUNK) {
      await tx.insert(experimentAnnotations).values(records.slice(start, start + INSERT_CHUNK));
    }
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
