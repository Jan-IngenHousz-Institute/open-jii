import { Injectable, Inject, Logger } from "@nestjs/common";
import { randomUUID } from "crypto";
import { SafeParseReturnType, z } from "zod";

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
        this.validate.uuid(annotation.rowId),
        this.validate.identifier(annotation.tableName),
        this.validate.identifier(annotation.type),
        this.validate.content(annotation.contentText),
        this.validate.flag(annotation.flagType),
        this.validate.content(annotation.flagReason),
      ];

      return validations.every((result) => result.success === true);
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
      if ("flagReason" in updateData) {
        validations.push(this.validate.content(updateData.flagReason));
      }

      return validations.every((result) => result.success === true);
    },
  };

  /**
   * Store multiple annotations in the experiment annotations table
   */
  async storeAnnotations(
    experimentName: string,
    experimentId: string,
    annotations: CreateAnnotationDto[],
  ): Promise<Result<SchemaData>> {
    this.logger.log(`Storing ${annotations.length} annotations for experiment ${experimentId}`);

    if (annotations.length === 0) {
      return success({ columns: [], rows: [], totalRows: 0, truncated: false } as SchemaData);
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
          ${this.formatSqlValue(annotation.flagReason)},
          '${now.toISOString()}',
          '${now.toISOString()}'
        )`,
    );

    const insertQuery = `
      INSERT INTO experiment_annotations (
        id,
        user_id,
        table_name,
        row_id,
        type,
        content_text,
        flag_type,
        flag_reason,
        created_at,
        updated_at
      ) VALUES ${valuesClauses.join(", ")}
    `;

    return this.databricksPort.executeExperimentSqlQuery(experimentName, experimentId, insertQuery);
  }

  /**
   * Update an existing annotation
   */
  async updateAnnotation(
    experimentName: string,
    experimentId: string,
    annotationId: string,
    updateData: UpdateAnnotationDto,
  ): Promise<Result<SchemaData>> {
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
    if (updateData.flagReason !== undefined) {
      setClauses.push(`flag_reason = ${this.formatSqlValue(updateData.flagReason)}`);
    }

    setClauses.push(`updated_at = '${now.toISOString()}'`);

    // Build raw SQL string for update
    const updateQuery = `
      UPDATE experiment_annotations 
      SET ${setClauses.join(", ")}
      WHERE id = '${annotationId}'
    `;

    return this.databricksPort.executeExperimentSqlQuery(experimentName, experimentId, updateQuery);
  }

  /**
   * Delete a single annotation
   */
  async deleteAnnotation(
    experimentName: string,
    experimentId: string,
    annotationId: string,
  ): Promise<Result<SchemaData>> {
    this.logger.log(`Deleting annotation ${annotationId} for experiment ${experimentId}`);

    // Validate input parameters
    const annotationIdValidation = this.validate.uuid(annotationId);
    if (!annotationIdValidation.success) {
      return failure(AppError.validationError("Invalid annotation ID"));
    }

    // Build raw SQL string for delete
    const deleteQuery = `
      DELETE FROM experiment_annotations
      WHERE id = '${annotationId}'
    `;

    return this.databricksPort.executeExperimentSqlQuery(experimentName, experimentId, deleteQuery);
  }

  /**
   * Delete multiple annotations by their IDs
   */
  async deleteAnnotationsBulk(
    experimentName: string,
    experimentId: string,
    annotationIds: string[],
  ): Promise<Result<SchemaData>> {
    this.logger.log(`Bulk deleting ${annotationIds.length} annotations`);

    if (annotationIds.length === 0) {
      return success({ columns: [], rows: [], totalRows: 0, truncated: false } as SchemaData);
    }

    // Validate input parameters
    const uuidsValidation = this.validate.uuids(annotationIds);
    if (!uuidsValidation.success) {
      return failure(AppError.validationError("Invalid annotation IDs provided"));
    }

    // Build IN clause for annotation IDs
    const annotationIdsList = annotationIds.map((id) => `'${id}'`).join(", ");

    // Build raw SQL string for bulk delete
    const deleteQuery = `
      DELETE FROM experiment_annotations
      WHERE id IN (${annotationIdsList})
    `;

    return this.databricksPort.executeExperimentSqlQuery(experimentName, experimentId, deleteQuery);
  }
}
