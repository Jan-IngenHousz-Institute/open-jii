import { Injectable, Inject, Logger } from "@nestjs/common";

import { Result, failure, success, AppError } from "../../../common/utils/fp-utils";
import type {
  ExperimentMetadataDto,
  CreateExperimentMetadataDto,
  UpdateExperimentMetadataDto,
} from "../models/experiment-metadata.model";
import { DATABRICKS_PORT } from "../ports/databricks.port";
import type { DatabricksPort } from "../ports/databricks.port";

/**
 * Repository for experiment metadata operations.
 * Persists metadata to Databricks Delta Lake using parameterized queries.
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

      const query = `SELECT id, experiment_id, columns, rows, identifier_column_id, experiment_question_id, created_by, created_at, updated_at FROM ${this.metadataTable} WHERE experiment_id = :experiment_id LIMIT 1`;

      const result = await this.databricksPort.executeSqlQuery(
        this.databricksPort.CENTRUM_SCHEMA_NAME,
        query,
        [{ name: "experiment_id", value: experimentId }],
      );

      if (result.isFailure()) {
        return failure(AppError.internal(`Failed to find metadata: ${result.error.message}`));
      }

      if (result.value.rows.length === 0) {
        return success(null);
      }

      return success(this.mapRowToDto(result.value.columns, result.value.rows[0]));
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

      const id = crypto.randomUUID();
      const now = new Date();
      const isoNow = now.toISOString();
      const columnsJson = JSON.stringify(dto.columns);
      const rowsJson = JSON.stringify(dto.rows);

      const query = `INSERT INTO ${this.metadataTable} (id, experiment_id, columns, rows, identifier_column_id, experiment_question_id, created_by, created_at, updated_at) VALUES (:id, :experiment_id, :columns, :rows, :identifier_column_id, :experiment_question_id, :created_by, :created_at, :updated_at)`;

      const parameters = [
        { name: "id", value: id },
        { name: "experiment_id", value: experimentId },
        { name: "columns", value: columnsJson },
        { name: "rows", value: rowsJson },
        { name: "identifier_column_id", value: dto.identifierColumnId ?? null },
        { name: "experiment_question_id", value: dto.experimentQuestionId ?? null },
        { name: "created_by", value: createdBy },
        { name: "created_at", value: isoNow },
        { name: "updated_at", value: isoNow },
      ];

      const result = await this.databricksPort.executeSqlQuery(
        this.databricksPort.CENTRUM_SCHEMA_NAME,
        query,
        parameters,
      );

      if (result.isFailure()) {
        return failure(AppError.internal(`Failed to create metadata: ${result.error.message}`));
      }

      return success({
        id,
        experimentId,
        columns: dto.columns,
        rows: dto.rows,
        identifierColumnId: dto.identifierColumnId ?? null,
        experimentQuestionId: dto.experimentQuestionId ?? null,
        createdBy,
        createdAt: now,
        updatedAt: now,
      });
    }

  async update(id: string, dto: UpdateExperimentMetadataDto): Promise<Result<ExperimentMetadataDto | null>> {
      this.logger.debug({
        msg: "Updating metadata",
        id,
      });

      // First fetch existing to merge
      const selectQuery = `SELECT id, experiment_id, columns, rows, identifier_column_id, experiment_question_id, created_by, created_at, updated_at FROM ${this.metadataTable} WHERE id = :id LIMIT 1`;

      const selectResult = await this.databricksPort.executeSqlQuery(
        this.databricksPort.CENTRUM_SCHEMA_NAME,
        selectQuery,
        [{ name: "id", value: id }],
      );

      if (selectResult.isFailure()) {
        return failure(AppError.internal(`Failed to fetch metadata for update: ${selectResult.error.message}`));
      }

      if (selectResult.value.rows.length === 0) {
        return success(null);
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

      const updateQuery = `UPDATE ${this.metadataTable} SET columns = :columns, rows = :rows, identifier_column_id = :identifier_column_id, experiment_question_id = :experiment_question_id, updated_at = :updated_at WHERE id = :id`;

      const parameters = [
        { name: "columns", value: JSON.stringify(updatedColumns) },
        { name: "rows", value: JSON.stringify(updatedRows) },
        { name: "identifier_column_id", value: updatedIdentifierColumnId ?? null },
        { name: "experiment_question_id", value: updatedExperimentQuestionId ?? null },
        { name: "updated_at", value: isoNow },
        { name: "id", value: id },
      ];

      const updateResult = await this.databricksPort.executeSqlQuery(
        this.databricksPort.CENTRUM_SCHEMA_NAME,
        updateQuery,
        parameters,
      );

      if (updateResult.isFailure()) {
        return failure(AppError.internal(`Failed to update metadata: ${updateResult.error.message}`));
      }

      return success({
        ...existing,
        columns: updatedColumns,
        rows: updatedRows,
        identifierColumnId: updatedIdentifierColumnId ?? null,
        experimentQuestionId: updatedExperimentQuestionId ?? null,
        updatedAt: now,
      });
    }

  async delete(id: string): Promise<Result<boolean>> {
      this.logger.debug({
        msg: "Deleting metadata",
        id,
      });

      const query = `DELETE FROM ${this.metadataTable} WHERE id = :id`;

      const result = await this.databricksPort.executeSqlQuery(
        this.databricksPort.CENTRUM_SCHEMA_NAME,
        query,
        [{ name: "id", value: id }],
      );

      if (result.isFailure()) {
        return failure(AppError.internal(`Failed to delete metadata: ${result.error.message}`));
      }

      return success(true);
    }

  async deleteByExperimentId(experimentId: string): Promise<Result<boolean>> {
      this.logger.debug({
        msg: "Deleting metadata by experiment ID",
        experimentId,
      });

      const query = `DELETE FROM ${this.metadataTable} WHERE experiment_id = :experiment_id`;

      const result = await this.databricksPort.executeSqlQuery(
        this.databricksPort.CENTRUM_SCHEMA_NAME,
        query,
        [{ name: "experiment_id", value: experimentId }],
      );

      if (result.isFailure()) {
        return failure(AppError.internal(`Failed to delete metadata by experiment ID: ${result.error.message}`));
      }

      return success(true);
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
