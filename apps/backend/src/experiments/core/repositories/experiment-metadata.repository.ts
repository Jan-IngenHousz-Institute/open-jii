import { Injectable, Inject, Logger } from "@nestjs/common";

import { Result, success, failure, AppError, tryCatch } from "../../../common/utils/fp-utils";
import type {
  ExperimentMetadataDto,
  CreateExperimentMetadataDto,
  UpdateExperimentMetadataDto,
} from "../models/experiment-metadata.model";
import { DATABRICKS_PORT } from "../ports/databricks.port";
import type { DatabricksPort } from "../ports/databricks.port";

/**
 * Repository for experiment metadata operations.
 * Persists metadata to Databricks Delta Lake.
 */
@Injectable()
export class ExperimentMetadataRepository {
  private readonly logger = new Logger(ExperimentMetadataRepository.name);

  constructor(@Inject(DATABRICKS_PORT) private readonly databricksPort: DatabricksPort) {}

  private get metadataTable(): string {
    return `${this.databricksPort.CATALOG_NAME}.${this.databricksPort.CENTRUM_SCHEMA_NAME}.experiment_metadata`;
  }

  async findByExperimentId(experimentId: string): Promise<Result<ExperimentMetadataDto | null>> {
    this.logger.debug({
      msg: "Finding metadata by experiment ID",
      experimentId,
    });

    return tryCatch(async () => {
      const escapedId = experimentId.replace(/'/g, "''");
      const query = `SELECT id, experiment_id, columns, rows, identifier_column_id, experiment_question_id, created_by, created_at, updated_at FROM ${this.metadataTable} WHERE experiment_id = '${escapedId}' LIMIT 1`;

      const result = await this.databricksPort.executeSqlQuery(
        this.databricksPort.CENTRUM_SCHEMA_NAME,
        query,
      );

      if (result.isFailure()) {
        throw new Error(result.error.message);
      }

      if (result.value.rows.length === 0) {
        return null;
      }

      return this.mapRowToDto(result.value.columns, result.value.rows[0]);
    });
  }

  async create(
    experimentId: string,
    dto: CreateExperimentMetadataDto,
    createdBy: string,
  ): Promise<Result<ExperimentMetadataDto>> {
    this.logger.debug({
      msg: "Creating metadata for experiment",
      experimentId,
      columnCount: dto.columns.length,
      rowCount: dto.rows.length,
    });

    return tryCatch(async () => {
      const id = crypto.randomUUID();
      const now = new Date();
      const columnsJson = JSON.stringify(dto.columns).replace(/'/g, "''");
      const rowsJson = JSON.stringify(dto.rows).replace(/'/g, "''");
      const escapedExperimentId = experimentId.replace(/'/g, "''");
      const escapedCreatedBy = createdBy.replace(/'/g, "''");
      const identifierColumnId = dto.identifierColumnId
        ? `'${dto.identifierColumnId.replace(/'/g, "''")}'`
        : "NULL";
      const experimentQuestionId = dto.experimentQuestionId
        ? `'${dto.experimentQuestionId.replace(/'/g, "''")}'`
        : "NULL";
      const isoNow = now.toISOString();

      const query = `INSERT INTO ${this.metadataTable} (id, experiment_id, columns, rows, identifier_column_id, experiment_question_id, created_by, created_at, updated_at) VALUES ('${id}', '${escapedExperimentId}', '${columnsJson}', '${rowsJson}', ${identifierColumnId}, ${experimentQuestionId}, '${escapedCreatedBy}', '${isoNow}', '${isoNow}')`;

      const result = await this.databricksPort.executeSqlQuery(
        this.databricksPort.CENTRUM_SCHEMA_NAME,
        query,
      );

      if (result.isFailure()) {
        throw new Error(result.error.message);
      }

      return {
        id,
        experimentId,
        columns: dto.columns,
        rows: dto.rows,
        identifierColumnId: dto.identifierColumnId ?? null,
        experimentQuestionId: dto.experimentQuestionId ?? null,
        createdBy,
        createdAt: now,
        updatedAt: now,
      };
    });
  }

  async update(id: string, dto: UpdateExperimentMetadataDto): Promise<Result<ExperimentMetadataDto | null>> {
    this.logger.debug({
      msg: "Updating metadata",
      id,
    });

    return tryCatch(async () => {
      // First fetch existing to merge
      const escapedId = id.replace(/'/g, "''");
      const selectQuery = `SELECT id, experiment_id, columns, rows, identifier_column_id, experiment_question_id, created_by, created_at, updated_at FROM ${this.metadataTable} WHERE id = '${escapedId}' LIMIT 1`;

      const selectResult = await this.databricksPort.executeSqlQuery(
        this.databricksPort.CENTRUM_SCHEMA_NAME,
        selectQuery,
      );

      if (selectResult.isFailure()) {
        throw new Error(selectResult.error.message);
      }

      if (selectResult.value.rows.length === 0) {
        return null;
      }

      const existing = this.mapRowToDto(selectResult.value.columns, selectResult.value.rows[0]);
      const now = new Date();
      const isoNow = now.toISOString();

      const updatedColumns = dto.columns ?? existing.columns;
      const updatedRows = dto.rows ?? existing.rows;
      const updatedIdentifierColumnId =
        dto.identifierColumnId !== undefined ? dto.identifierColumnId : existing.identifierColumnId;
      const updatedExperimentQuestionId =
        dto.experimentQuestionId !== undefined
          ? dto.experimentQuestionId
          : existing.experimentQuestionId;

      const columnsJson = JSON.stringify(updatedColumns).replace(/'/g, "''");
      const rowsJson = JSON.stringify(updatedRows).replace(/'/g, "''");
      const identifierVal = updatedIdentifierColumnId
        ? `'${updatedIdentifierColumnId.replace(/'/g, "''")}'`
        : "NULL";
      const questionVal = updatedExperimentQuestionId
        ? `'${updatedExperimentQuestionId.replace(/'/g, "''")}'`
        : "NULL";

      const updateQuery = `UPDATE ${this.metadataTable} SET columns = '${columnsJson}', rows = '${rowsJson}', identifier_column_id = ${identifierVal}, experiment_question_id = ${questionVal}, updated_at = '${isoNow}' WHERE id = '${escapedId}'`;

      const updateResult = await this.databricksPort.executeSqlQuery(
        this.databricksPort.CENTRUM_SCHEMA_NAME,
        updateQuery,
      );

      if (updateResult.isFailure()) {
        throw new Error(updateResult.error.message);
      }

      return {
        ...existing,
        columns: updatedColumns,
        rows: updatedRows,
        identifierColumnId: updatedIdentifierColumnId ?? null,
        experimentQuestionId: updatedExperimentQuestionId ?? null,
        updatedAt: now,
      };
    });
  }

  async delete(id: string): Promise<Result<boolean>> {
    this.logger.debug({
      msg: "Deleting metadata",
      id,
    });

    return tryCatch(async () => {
      const escapedId = id.replace(/'/g, "''");
      const query = `DELETE FROM ${this.metadataTable} WHERE id = '${escapedId}'`;

      const result = await this.databricksPort.executeSqlQuery(
        this.databricksPort.CENTRUM_SCHEMA_NAME,
        query,
      );

      if (result.isFailure()) {
        throw new Error(result.error.message);
      }

      return true;
    });
  }

  async deleteByExperimentId(experimentId: string): Promise<Result<boolean>> {
    this.logger.debug({
      msg: "Deleting metadata by experiment ID",
      experimentId,
    });

    return tryCatch(async () => {
      const escapedId = experimentId.replace(/'/g, "''");
      const query = `DELETE FROM ${this.metadataTable} WHERE experiment_id = '${escapedId}'`;

      const result = await this.databricksPort.executeSqlQuery(
        this.databricksPort.CENTRUM_SCHEMA_NAME,
        query,
      );

      if (result.isFailure()) {
        throw new Error(result.error.message);
      }

      return true;
    });
  }

  /**
   * Map a raw Databricks row to ExperimentMetadataDto
   */
  private mapRowToDto(
    columns: { name: string }[],
    row: (string | null)[],
  ): ExperimentMetadataDto {
    const colIndex = (name: string) => columns.findIndex((c) => c.name === name);

    return {
      id: row[colIndex("id")] as string,
      experimentId: row[colIndex("experiment_id")] as string,
      columns: JSON.parse(row[colIndex("columns")] ?? "[]"),
      rows: JSON.parse(row[colIndex("rows")] ?? "[]"),
      identifierColumnId: row[colIndex("identifier_column_id")] ?? null,
      experimentQuestionId: row[colIndex("experiment_question_id")] ?? null,
      createdBy: row[colIndex("created_by")] as string,
      createdAt: new Date(row[colIndex("created_at")] as string),
      updatedAt: new Date(row[colIndex("updated_at")] as string),
    };
  }
}
