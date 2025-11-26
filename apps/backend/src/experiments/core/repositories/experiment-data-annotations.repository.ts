import { Injectable, Inject, Logger } from "@nestjs/common";
import { randomUUID } from "crypto";
import { SafeParseReturnType, z } from "zod";

import { AnnotationRowsAffected } from "@repo/api";

import type { SchemaData } from "../../../common/modules/databricks/services/sql/sql.types";
import { AppError, failure, Result, success } from "../../../common/utils/fp-utils";
import {
  BaseAnnotation,
  CreateAnnotationDto,
  UpdateAnnotationDto,
} from "../models/experiment-data-annotation.model";
import { DATABRICKS_PORT } from "../ports/databricks.port";
import type { DatabricksPort } from "../ports/databricks.port";

@Injectable()
export class ExperimentDataAnnotationsRepository {
  private readonly logger = new Logger(ExperimentDataAnnotationsRepository.name);

  constructor(
    @Inject(DATABRICKS_PORT)
    private readonly databricksPort: DatabricksPort,
  ) {}

  /**
   * Helper function to format string values for SQL with proper escaping
   */
  private formatSqlValue(value: string | null | undefined): string {
    if (value === null || value === undefined) {
      return "NULL";
    }
    // Escape single quotes and other potential SQL injection characters
    const escaped = value
      .replace(/'/g, "''")
      .replace(/\\/g, "\\\\")
      .replace(/\0/g, "\\0")
      .replace(/\n/g, "\\n")
      .replace(/\r/g, "\\r");
    return `'${escaped}'`;
  }

  // Zod validation schemas
  private readonly schemas = {
    uuid: z.string().uuid(),
    identifier: z
      .string()
      .regex(/^[a-zA-Z0-9_]+$/)
      .max(64),
    content: z.string().max(10000).nullable().optional(),
    flag: z.string().max(100).nullable().optional(),
  };

  /**
   * Validate input parameters
   */
  private validate = {
    uuid: (value: string) => this.schemas.uuid.safeParse(value),
    uuids: (values: string[]) => z.array(this.schemas.uuid).safeParse(values),
    identifier: (value: string) => this.schemas.identifier.safeParse(value),
    content: (value: string | null | undefined) => this.schemas.content.safeParse(value),
    flag: (value: string | null | undefined) => this.schemas.flag.safeParse(value),

    annotation: (annotation: CreateAnnotationDto & { id: string }): boolean => {
      const validations = [
        this.validate.uuid(annotation.id),
        this.validate.uuid(annotation.userId),
        this.validate.identifier(annotation.tableName),
        this.validate.identifier(annotation.type),
        this.validate.content(annotation.contentText),
        this.validate.flag(annotation.flagType),
      ];

      return validations.every((result) => result.success);
    },

    updateData: (updateData: Partial<UpdateAnnotationDto>): boolean => {
      const validations: SafeParseReturnType<
        string | null | undefined,
        string | null | undefined
      >[] = [];

      if ("contentText" in updateData) {
        validations.push(this.validate.content(updateData.contentText));
      }
      if ("flagType" in updateData) {
        validations.push(this.validate.flag(updateData.flagType));
      }

      return validations.every((result) => result.success);
    },
  };

  async deleteAnnotationsTable(
    experimentName: string,
    experimentId: string,
  ): Promise<Result<SchemaData>> {
    const createTableQuery = `
      DROP TABLE annotations
    `;

    return this.databricksPort.executeExperimentSqlQuery(
      experimentName,
      experimentId,
      createTableQuery,
    );
  }

  /*
   * Ensure the annotations table exists
   */
  async ensureTableExists(
    experimentName: string,
    experimentId: string,
  ): Promise<Result<SchemaData>> {
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS annotations (
        id STRING NOT NULL PRIMARY KEY,
        user_id STRING NOT NULL,
        table_name STRING NOT NULL,
        row_id INT NOT NULL,
        type STRING NOT NULL,
        content_text STRING,
        flag_type STRING,
        created_at TIMESTAMP NOT NULL,
        updated_at TIMESTAMP NOT NULL
      )
      USING DELTA
    `;

    const createResult = await this.databricksPort.executeExperimentSqlQuery(
      experimentName,
      experimentId,
      createTableQuery,
    );
    if (createResult.isFailure()) {
      return failure(AppError.internal(createResult.error.message));
    }

    const alterTableQuery = `
      ALTER TABLE annotations SET TBLPROPERTIES(downstream = "false")
    `;
    return this.databricksPort.executeExperimentSqlQuery(
      experimentName,
      experimentId,
      alterTableQuery,
    );
  }

  private getRowsAffectedFromResult(result: SchemaData): AnnotationRowsAffected {
    if (result.rows[0]) {
      const rowsAffectedIndex = result.columns.findIndex((col) => col.name === "num_affected_rows");
      if (rowsAffectedIndex !== -1 && result.rows[0][rowsAffectedIndex]) {
        const rowsAffected = parseInt(result.rows[0][rowsAffectedIndex], 10);
        return {
          rowsAffected,
        };
      }
    }
    return {
      rowsAffected: 0,
    };
  }

  /**
   * Store multiple annotations in the experiment annotations table
   */
  async storeAnnotations(
    experimentName: string,
    experimentId: string,
    annotations: CreateAnnotationDto[],
  ): Promise<Result<AnnotationRowsAffected>> {
    this.logger.log(`Storing ${annotations.length} annotations for experiment ${experimentId}`);

    if (annotations.length === 0) {
      return success({ rowsAffected: 0 } as AnnotationRowsAffected);
    }

    const now = new Date();

    // Validate and add IDs to all annotations
    const annotationsWithIds: Omit<BaseAnnotation, "createdAt" | "updatedAt">[] = [];

    for (const annotation of annotations) {
      const annotationId = randomUUID().toString();
      const annotationWithId: Omit<BaseAnnotation, "createdAt" | "updatedAt"> = {
        ...annotation,
        id: annotationId,
      };

      if (!this.validate.annotation(annotationWithId)) {
        return failure(
          AppError.validationError(
            `Validation failed for annotation: ${JSON.stringify(annotation)}`,
          ),
        );
      }

      annotationsWithIds.push(annotationWithId);
    }

    // Build single INSERT query with multiple VALUES
    const valuesClauses = annotationsWithIds.map(
      (annotation) =>
        `(
          '${annotation.id}',
          '${annotation.userId}',
          '${annotation.tableName}',
          '${annotation.rowId}',
          '${annotation.type}',
          ${this.formatSqlValue(annotation.contentText)},
          ${this.formatSqlValue(annotation.flagType)},
          '${now.toISOString()}',
          '${now.toISOString()}'
        )`,
    );

    const insertQuery = `
      INSERT INTO annotations (
        id,
        user_id,
        table_name,
        row_id,
        type,
        content_text,
        flag_type,
        created_at,
        updated_at
      ) VALUES ${valuesClauses.join(", ")}
    `;

    const insertResult = await this.databricksPort.executeExperimentSqlQuery(
      experimentName,
      experimentId,
      insertQuery,
    );
    if (insertResult.isFailure()) {
      return failure(
        AppError.internal(`Failed to insert annotations: ${insertResult.error.message}`),
      );
    }
    return success(this.getRowsAffectedFromResult(insertResult.value));
  }

  /**
   * Update an existing annotation
   */
  async updateAnnotation(
    experimentName: string,
    experimentId: string,
    annotationId: string,
    updateData: UpdateAnnotationDto,
  ): Promise<Result<AnnotationRowsAffected>> {
    this.logger.log(`Updating annotation ${annotationId} for experiment ${experimentId}`);

    if (!this.validate.updateData(updateData)) {
      return failure(AppError.validationError("Invalid update data"));
    }

    const annotationIdValidation = this.validate.uuid(annotationId);
    if (!annotationIdValidation.success) {
      return failure(AppError.validationError("Invalid annotation ID"));
    }

    const now = new Date();

    // Build SET clause dynamically based on provided update data
    const setClauses: string[] = [];

    if (updateData.contentText !== undefined) {
      setClauses.push(`content_text = ${this.formatSqlValue(updateData.contentText)}`);
    }
    if (updateData.flagType !== undefined) {
      setClauses.push(`flag_type = ${this.formatSqlValue(updateData.flagType)}`);
    }

    setClauses.push(`updated_at = '${now.toISOString()}'`);

    // Build raw SQL string for update
    const updateQuery = `
      UPDATE annotations 
      SET ${setClauses.join(", ")}
      WHERE id = '${annotationId}'
    `;

    const updateResult = await this.databricksPort.executeExperimentSqlQuery(
      experimentName,
      experimentId,
      updateQuery,
    );
    if (updateResult.isFailure()) {
      return failure(
        AppError.internal(`Failed to update annotation: ${updateResult.error.message}`),
      );
    }
    return success(this.getRowsAffectedFromResult(updateResult.value));
  }

  /**
   * Delete a single annotation
   */
  async deleteAnnotation(
    experimentName: string,
    experimentId: string,
    annotationId: string,
  ): Promise<Result<AnnotationRowsAffected>> {
    this.logger.log(`Deleting annotation ${annotationId} for experiment ${experimentId}`);

    // Validate input parameters
    const annotationIdValidation = this.validate.uuid(annotationId);
    if (!annotationIdValidation.success) {
      return failure(AppError.validationError("Invalid annotation ID"));
    }

    // Build raw SQL string for delete
    const deleteQuery = `
      DELETE FROM annotations
      WHERE id = '${annotationId}'
    `;

    const deleteResult = await this.databricksPort.executeExperimentSqlQuery(
      experimentName,
      experimentId,
      deleteQuery,
    );
    if (deleteResult.isFailure()) {
      return failure(
        AppError.internal(`Failed to delete annotation: ${deleteResult.error.message}`),
      );
    }
    return success(this.getRowsAffectedFromResult(deleteResult.value));
  }

  /**
   * Delete multiple annotations by their IDs
   */
  async deleteAnnotationsBulk(
    experimentName: string,
    experimentId: string,
    tableName: string,
    rowIds: string[],
    type: string,
  ): Promise<Result<AnnotationRowsAffected>> {
    this.logger.log(`Bulk deleting  annotations for ${rowIds.length} rows of type ${type}`);

    if (rowIds.length === 0) {
      return success({ rowsAffected: 0 } as AnnotationRowsAffected);
    }

    // Build IN clause for annotation IDs
    const rowIdList = rowIds.map((id) => `'${id}'`).join(", ");

    // Build raw SQL string for bulk delete
    const deleteQuery = `
      DELETE FROM annotations
      WHERE table_name=${this.formatSqlValue(tableName)}
      AND type=${this.formatSqlValue(type)}
      AND row_id IN (${rowIdList})
    `;

    const deleteResult = await this.databricksPort.executeExperimentSqlQuery(
      experimentName,
      experimentId,
      deleteQuery,
    );
    if (deleteResult.isFailure()) {
      return failure(
        AppError.internal(`Failed to delete annotation: ${deleteResult.error.message}`),
      );
    }
    return success(this.getRowsAffectedFromResult(deleteResult.value));
  }
}
