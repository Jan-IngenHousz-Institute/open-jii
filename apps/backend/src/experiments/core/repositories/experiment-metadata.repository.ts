import { Injectable, Inject, Logger } from "@nestjs/common";
import { randomUUID } from "crypto";
import { z } from "zod";

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
 * Uses inline SQL with manual escaping (same pattern as annotations repo).
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
export class ExperimentMetadataRepository {
  private readonly logger = new Logger(ExperimentMetadataRepository.name);

  constructor(@Inject(DATABRICKS_PORT) private readonly databricksPort: DatabricksPort) {}

  private get metadataTable(): string {
    return `${this.databricksPort.CATALOG_NAME}.${this.databricksPort.CENTRUM_SCHEMA_NAME}.experiment_custom_metadata`;
  }

  // --- Validation ---

  private readonly schemas = {
    uuid: z.string().uuid(),
    jsonString: z.string().max(5_000_000), // 5 MB cap on serialized metadata
  };

  private validate = {
    uuid: (value: string) => this.schemas.uuid.safeParse(value),
  };

  // --- SQL helpers (mirrors annotations repo) ---

  private formatSqlValue(value: string | null | undefined): string {
    if (value === null || value === undefined) {
      return "NULL";
    }
    const escaped = value
      .replace(/'/g, "''")
      .replace(/\\/g, "\\\\")
      .replace(/\0/g, "\\0")
      .replace(/\n/g, "\\n")
      .replace(/\r/g, "\\r");
    return `'${escaped}'`;
  }

  // --- Repository methods ---

  async findAllByExperimentId(experimentId: string): Promise<Result<ExperimentMetadataDto[]>> {
    this.logger.log({
      msg: "Finding all metadata by experiment ID",
      operation: "findAllByExperimentId",
      experimentId,
    });

    if (!this.validate.uuid(experimentId).success) {
      return failure(AppError.validationError("Invalid experiment ID format"));
    }

    const query = `
      SELECT metadata_id, experiment_id, metadata, created_by, created_at, updated_at
      FROM ${this.metadataTable}
      WHERE experiment_id = ${this.formatSqlValue(experimentId)}
      ORDER BY created_at DESC
    `;

    const result = await this.databricksPort.executeSqlQuery(
      this.databricksPort.CENTRUM_SCHEMA_NAME,
      query,
    );

    if (result.isFailure()) {
      return failure(AppError.internal(`Failed to find metadata: ${result.error.message}`));
    }

    return success(result.value.rows.map((row) => this.mapRowToDto(result.value.columns, row)));
  }

  async create(
    experimentId: string,
    dto: CreateExperimentMetadataDto,
    userId: string,
  ): Promise<Result<ExperimentMetadataDto>> {
    this.logger.log({
      msg: "Creating metadata",
      operation: "create",
      experimentId,
    });

    if (!this.validate.uuid(experimentId).success || !this.validate.uuid(userId).success) {
      return failure(AppError.validationError("Invalid experiment ID or user ID format"));
    }

    const now = new Date();
    const isoNow = now.toISOString();
    const metadataJson = JSON.stringify(dto.metadata);

    if (!this.schemas.jsonString.safeParse(metadataJson).success) {
      return failure(AppError.validationError("Metadata payload exceeds the 5 MB size limit"));
    }

    const metadataId = randomUUID();

    const insertQuery = `
      INSERT INTO ${this.metadataTable}
        (metadata_id, experiment_id, metadata, created_by, created_at, updated_at)
      VALUES (
        ${this.formatSqlValue(metadataId)},
        ${this.formatSqlValue(experimentId)},
        PARSE_JSON(${this.formatSqlValue(metadataJson)}),
        ${this.formatSqlValue(userId)},
        ${this.formatSqlValue(isoNow)},
        ${this.formatSqlValue(isoNow)}
      )
    `;

    const insertResult = await this.databricksPort.executeSqlQuery(
      this.databricksPort.CENTRUM_SCHEMA_NAME,
      insertQuery,
    );

    if (insertResult.isFailure()) {
      return failure(AppError.internal(`Failed to create metadata: ${insertResult.error.message}`));
    }

    return success({
      metadataId,
      experimentId,
      metadata: dto.metadata,
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
    });
  }

  async deleteByMetadataId(metadataId: string, experimentId: string): Promise<Result<boolean>> {
    this.logger.log({
      msg: "Deleting metadata by metadata ID",
      operation: "deleteByMetadataId",
      metadataId,
      experimentId,
    });

    if (!this.validate.uuid(metadataId).success || !this.validate.uuid(experimentId).success) {
      return failure(AppError.validationError("Invalid metadata ID or experiment ID format"));
    }

    const query = `
      DELETE FROM ${this.metadataTable}
      WHERE metadata_id = ${this.formatSqlValue(metadataId)}
        AND experiment_id = ${this.formatSqlValue(experimentId)}
    `;

    const result = await this.databricksPort.executeSqlQuery(
      this.databricksPort.CENTRUM_SCHEMA_NAME,
      query,
    );

    if (result.isFailure()) {
      return failure(AppError.internal(`Failed to delete metadata: ${result.error.message}`));
    }

    return success(true);
  }

  async deleteAllByExperimentId(experimentId: string): Promise<Result<boolean>> {
    this.logger.log({
      msg: "Deleting all metadata by experiment ID",
      operation: "deleteAllByExperimentId",
      experimentId,
    });

    if (!this.validate.uuid(experimentId).success) {
      return failure(AppError.validationError("Invalid experiment ID format"));
    }

    const query = `
      DELETE FROM ${this.metadataTable}
      WHERE experiment_id = ${this.formatSqlValue(experimentId)}
    `;

    const result = await this.databricksPort.executeSqlQuery(
      this.databricksPort.CENTRUM_SCHEMA_NAME,
      query,
    );

    if (result.isFailure()) {
      return failure(AppError.internal(`Failed to delete metadata: ${result.error.message}`));
    }

    return success(true);
  }

  async update(
    metadataId: string,
    dto: UpdateExperimentMetadataDto,
    _userId: string,
    experimentId: string,
  ): Promise<Result<ExperimentMetadataDto>> {
    this.logger.log({
      msg: "Updating metadata",
      operation: "update",
      metadataId,
      experimentId,
    });

    if (!this.validate.uuid(metadataId).success || !this.validate.uuid(experimentId).success) {
      return failure(AppError.validationError("Invalid metadata ID or experiment ID format"));
    }

    const now = new Date();
    const isoNow = now.toISOString();
    const metadataJson = JSON.stringify(dto.metadata);

    if (!this.schemas.jsonString.safeParse(metadataJson).success) {
      return failure(AppError.validationError("Metadata payload exceeds the 5 MB size limit"));
    }

    const updateQuery = `
      UPDATE ${this.metadataTable}
      SET metadata = PARSE_JSON(${this.formatSqlValue(metadataJson)}),
          updated_at = ${this.formatSqlValue(isoNow)}
      WHERE metadata_id = ${this.formatSqlValue(metadataId)}
        AND experiment_id = ${this.formatSqlValue(experimentId)}
    `;

    const updateResult = await this.databricksPort.executeSqlQuery(
      this.databricksPort.CENTRUM_SCHEMA_NAME,
      updateQuery,
    );

    if (updateResult.isFailure()) {
      return failure(AppError.internal(`Failed to update metadata: ${updateResult.error.message}`));
    }

    return success({
      metadataId,
      experimentId,
      metadata: dto.metadata,
      createdBy: _userId,
      createdAt: now, // approximate; true value lives in DB
      updatedAt: now,
    });
  }

  /** Map a raw Databricks row to ExperimentMetadataDto */
  private mapRowToDto(columns: { name: string }[], row: (string | null)[]): ExperimentMetadataDto {
    const colIndex = (name: string) => columns.findIndex((c) => c.name === name);

    const rawMetadata = row[colIndex("metadata")];
    let metadata: Record<string, unknown> = {};
    if (rawMetadata) {
      try {
        metadata = JSON.parse(rawMetadata) as Record<string, unknown>;
      } catch {
        this.logger.warn({ msg: "Failed to parse metadata JSON", rawMetadata });
      }
    }

    const createdAtRaw = row[colIndex("created_at")];
    const updatedAtRaw = row[colIndex("updated_at")];

    return {
      metadataId: row[colIndex("metadata_id")] ?? "",
      experimentId: row[colIndex("experiment_id")] ?? "",
      metadata,
      createdBy: row[colIndex("created_by")] ?? "",
      createdAt: createdAtRaw ? new Date(createdAtRaw) : new Date(0),
      updatedAt: updatedAtRaw ? new Date(updatedAtRaw) : new Date(0),
    };
  }
}
