import { Inject, Injectable } from "@nestjs/common";

import { and, eq, experimentMetadataSheets } from "@repo/database";
import type { DatabaseInstance } from "@repo/database";

import { AppError, Result, tryCatch } from "../../../common/utils/fp-utils";
import type { MetadataSheetRecord } from "../models/experiment-metadata.model";

/** Researchers' custom metadata sheets in Postgres. */
@Injectable()
export class ExperimentMetadataRepository {
  constructor(@Inject("DATABASE") private readonly database: DatabaseInstance) {}

  async insert(sheet: MetadataSheetRecord): Promise<Result<void>> {
    return tryCatch(
      async () => {
        await this.database.insert(experimentMetadataSheets).values(sheet);
      },
      (error) => this.queryError(error),
    );
  }

  async update(
    experimentId: string,
    metadataId: string,
    metadata: Record<string, unknown>,
    updatedAt: Date,
  ): Promise<Result<void>> {
    return tryCatch(
      async () => {
        await this.database
          .update(experimentMetadataSheets)
          .set({ metadata, updatedAt })
          .where(
            and(
              eq(experimentMetadataSheets.id, metadataId),
              eq(experimentMetadataSheets.experimentId, experimentId),
            ),
          );
      },
      (error) => this.queryError(error),
    );
  }

  async delete(experimentId: string, metadataId: string): Promise<Result<void>> {
    return tryCatch(
      async () => {
        await this.database
          .delete(experimentMetadataSheets)
          .where(
            and(
              eq(experimentMetadataSheets.id, metadataId),
              eq(experimentMetadataSheets.experimentId, experimentId),
            ),
          );
      },
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
