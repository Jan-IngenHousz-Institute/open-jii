import { Injectable, Inject } from "@nestjs/common";

import type { StatementParameter } from "../../../common/modules/databricks/services/sql/sql.types";
import { Result, failure, success, AppError } from "../../../common/utils/fp-utils";
import type { MetadataSheetRecord } from "../models/experiment-metadata.model";
import { DATABRICKS_PORT } from "../ports/databricks.port";
import type { DatabricksPort } from "../ports/databricks.port";

/**
 * The documents one MERGE carries, at least one sheet. The statement API takes 16 MiB of SQL text
 * and does not say whether bound values count, and a backlog can owe hundreds of 5 MB sheets.
 */
const MERGE_BYTES = 4 * 1024 * 1024;

interface SheetDocument {
  sheet: MetadataSheetRecord;
  json: string;
}

/**
 * The lakehouse's copy of metadata sheets, which the warehouse views and exports read. Postgres
 * holds the sheets; the experiment data outbox keeps this copy to their state. Values are bound as
 * statement parameters, never written into the SQL text.
 *
 * Databricks table schema:
 *   metadata_id   STRING   (PK, UUID)
 *   experiment_id STRING
 *   metadata      VARIANT  (arbitrary JSON blob)
 *   created_by    STRING
 *   created_at    TIMESTAMP
 *   updated_at    TIMESTAMP
 */
@Injectable()
export class ExperimentMetadataWarehouseRepository {
  constructor(@Inject(DATABRICKS_PORT) private readonly databricksPort: DatabricksPort) {}

  private get metadataTable(): string {
    return `${this.databricksPort.CATALOG_NAME}.${this.databricksPort.CENTRUM_SCHEMA_NAME}.experiment_custom_metadata`;
  }

  /**
   * The ids of the sheets each MERGE should carry, from their sizes, so a copy can read and send
   * one statement's documents at a time.
   */
  statementGroups(sizes: { id: string; bytes: number }[]): string[][] {
    const groups: string[][] = [];
    let current: string[] = [];
    let bytes = 0;

    for (const sheet of sizes) {
      if (current.length > 0 && bytes + sheet.bytes > MERGE_BYTES) {
        groups.push(current);
        current = [];
        bytes = 0;
      }
      current.push(sheet.id);
      bytes += sheet.bytes;
    }

    if (current.length > 0) {
      groups.push(current);
    }
    return groups;
  }

  /** Writes each sheet's current state, in statements of at most `MERGE_BYTES` of documents. */
  async merge(sheets: MetadataSheetRecord[]): Promise<Result<void>> {
    for (const documents of this.bySize(sheets)) {
      const merged = await this.mergeStatement(documents);
      if (merged.isFailure()) {
        return merged;
      }
    }

    return success(undefined);
  }

  private bySize(sheets: MetadataSheetRecord[]): SheetDocument[][] {
    const statements: SheetDocument[][] = [];
    let current: SheetDocument[] = [];
    let bytes = 0;

    for (const sheet of sheets) {
      const json = JSON.stringify(sheet.metadata);
      const size = Buffer.byteLength(json);
      if (current.length > 0 && bytes + size > MERGE_BYTES) {
        statements.push(current);
        current = [];
        bytes = 0;
      }
      current.push({ sheet, json });
      bytes += size;
    }

    if (current.length > 0) {
      statements.push(current);
    }
    return statements;
  }

  private async mergeStatement(documents: SheetDocument[]): Promise<Result<void>> {
    const parameters: StatementParameter[] = [];
    const rows = documents.map(({ sheet, json }, i) => {
      parameters.push(
        { name: `metadata_id_${i}`, value: sheet.id },
        { name: `experiment_id_${i}`, value: sheet.experimentId },
        { name: `metadata_${i}`, value: json },
        { name: `created_by_${i}`, value: sheet.createdBy },
        { name: `created_at_${i}`, value: sheet.createdAt.toISOString(), type: "TIMESTAMP" },
        { name: `updated_at_${i}`, value: sheet.updatedAt.toISOString(), type: "TIMESTAMP" },
      );
      return `(:metadata_id_${i}, :experiment_id_${i}, :metadata_${i}, :created_by_${i}, :created_at_${i}, :updated_at_${i})`;
    });

    const statement = `
      MERGE INTO ${this.metadataTable} AS target
      USING (
        SELECT metadata_id, experiment_id, PARSE_JSON(metadata) AS metadata, created_by, created_at, updated_at
        FROM VALUES ${rows.join(", ")}
        AS copy(metadata_id, experiment_id, metadata, created_by, created_at, updated_at)
      ) AS source
      ON target.metadata_id = source.metadata_id
      WHEN MATCHED THEN UPDATE SET
        experiment_id = source.experiment_id, metadata = source.metadata, created_by = source.created_by,
        created_at = source.created_at, updated_at = source.updated_at
      WHEN NOT MATCHED THEN INSERT (metadata_id, experiment_id, metadata, created_by, created_at, updated_at)
        VALUES (source.metadata_id, source.experiment_id, source.metadata, source.created_by,
                source.created_at, source.updated_at)
    `;

    return this.execute(statement, parameters, "merge metadata sheets");
  }

  /** Deletes the copies of sheets Postgres no longer holds. */
  async delete(ids: string[]): Promise<Result<void>> {
    if (ids.length === 0) {
      return success(undefined);
    }

    const parameters = ids.map((id, i) => ({ name: `metadata_id_${i}`, value: id }));
    const statement = `
      DELETE FROM ${this.metadataTable}
      WHERE metadata_id IN (${parameters.map(({ name }) => `:${name}`).join(", ")})
    `;

    return this.execute(statement, parameters, "delete metadata sheets");
  }

  private async execute(
    statement: string,
    parameters: StatementParameter[],
    what: string,
  ): Promise<Result<void>> {
    const result = await this.databricksPort.executeSqlQuery(
      this.databricksPort.CENTRUM_SCHEMA_NAME,
      statement,
      parameters,
    );
    if (result.isFailure()) {
      return failure(AppError.internal(`Failed to ${what}: ${result.error.message}`));
    }

    return success(undefined);
  }
}
