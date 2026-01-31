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
    userName: z.string().max(255).nullable().optional(),
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
    userName: (value: string | null | undefined) => this.schemas.userName.safeParse(value),

    annotation: (annotation: CreateAnnotationDto & { id: string }): boolean => {
      const validations = [
        this.validate.uuid(annotation.id),
        this.validate.uuid(annotation.userId),
        this.validate.identifier(annotation.tableName),
        this.validate.identifier(annotation.type),
        this.validate.content(annotation.contentText),
        this.validate.flag(annotation.flagType),
        this.validate.userName(annotation.userName),
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
   * Store multiple annotations in centrum.experiment_annotations
   */
  async storeAnnotations(
    experimentId: string,
    annotations: CreateAnnotationDto[],
  ): Promise<Result<AnnotationRowsAffected>> {
    this.logger.log({
      msg: "Storing annotations",
      operation: "storeAnnotations",
      experimentId,
      annotationCount: annotations.length,
    });

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
          '${experimentId}',
          '${annotation.userId}',
          ${this.formatSqlValue(annotation.userName)},
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
      INSERT INTO experiment_annotations (
        id,
        experiment_id,
        user_id,
        user_name,
        table_name,
        row_id,
        type,
        content_text,
        flag_type,
        created_at,
        updated_at
      ) VALUES ${valuesClauses.join(", ")}
    `;

    const insertResult = await this.databricksPort.executeSqlQuery(
      this.databricksPort.CENTRUM_SCHEMA_NAME,
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
    experimentId: string,
    annotationId: string,
    updateData: UpdateAnnotationDto,
  ): Promise<Result<AnnotationRowsAffected>> {
    this.logger.log({
      msg: "Updating annotation",
      operation: "updateAnnotation",
      experimentId,
      annotationId,
    });

    if (!this.validate.updateData(updateData)) {
      return failure(AppError.validationError("Invalid update data"));
    }

    const annotationIdValidation = this.validate.uuid(annotationId);
    if (!annotationIdValidation.success) {
      return failure(AppError.validationError("Invalid annotation ID"));
    }

    const now = new Date();

    const setClauses: string[] = [];

    if (updateData.contentText !== undefined) {
      setClauses.push(`content_text = ${this.formatSqlValue(updateData.contentText)}`);
    }
    if (updateData.flagType !== undefined) {
      setClauses.push(`flag_type = ${this.formatSqlValue(updateData.flagType)}`);
    }

    setClauses.push(`updated_at = '${now.toISOString()}'`);

    const updateQuery = `
      UPDATE experiment_annotations
      SET ${setClauses.join(", ")}
      WHERE id = '${annotationId}' AND experiment_id = '${experimentId}'
    `;

    const updateResult = await this.databricksPort.executeSqlQuery(
      this.databricksPort.CENTRUM_SCHEMA_NAME,
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
    experimentId: string,
    annotationId: string,
  ): Promise<Result<AnnotationRowsAffected>> {
    this.logger.log({
      msg: "Deleting annotation",
      operation: "deleteAnnotation",
      experimentId,
      annotationId,
    });

    const annotationIdValidation = this.validate.uuid(annotationId);
    if (!annotationIdValidation.success) {
      return failure(AppError.validationError("Invalid annotation ID"));
    }

    const deleteQuery = `
      DELETE FROM experiment_annotations
      WHERE id = '${annotationId}' AND experiment_id = '${experimentId}'
    `;

    const deleteResult = await this.databricksPort.executeSqlQuery(
      this.databricksPort.CENTRUM_SCHEMA_NAME,
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
    experimentId: string,
    tableName: string,
    rowIds: string[],
    type: string,
  ): Promise<Result<AnnotationRowsAffected>> {
    this.logger.log({
      msg: "Bulk deleting annotations",
      operation: "deleteAnnotationsBulk",
      experimentId,
      tableName,
      type,
      rowCount: rowIds.length,
    });

    if (rowIds.length === 0) {
      return success({ rowsAffected: 0 } as AnnotationRowsAffected);
    }

    const rowIdList = rowIds.map((id) => `'${id}'`).join(", ");

    const deleteQuery = `
      DELETE FROM experiment_annotations
      WHERE experiment_id = '${experimentId}'
      AND table_name = ${this.formatSqlValue(tableName)}
      AND type = ${this.formatSqlValue(type)}
      AND row_id IN (${rowIdList})
    `;

    const deleteResult = await this.databricksPort.executeSqlQuery(
      this.databricksPort.CENTRUM_SCHEMA_NAME,
      deleteQuery,
    );
    if (deleteResult.isFailure()) {
      return failure(
        AppError.internal(`Failed to delete annotations: ${deleteResult.error.message}`),
      );
    }
    return success(this.getRowsAffectedFromResult(deleteResult.value));
  }
}
