import { Injectable, Logger, Inject } from "@nestjs/common";
import { v4 as uuidv4 } from "uuid";

import {
  AddAnnotationBody,
  AddAnnotationsBulkBody,
  Annotation,
  zAddAnnotationsBulkBody,
} from "@repo/api";

import { Result, failure, AppError, tryCatch, success } from "../../../../../common/utils/fp-utils";
import { ExperimentDataAnnotation } from "../../../../core/models/experiment-data-annotation.model";
import { DATABRICKS_PORT } from "../../../../core/ports/databricks.port";
import type { DatabricksPort } from "../../../../core/ports/databricks.port";
import { ExperimentRepository } from "../../../../core/repositories/experiment.repository";

@Injectable()
export class AddAnnotationUseCase {
  private readonly logger = new Logger(AddAnnotationUseCase.name);

  constructor(
    private readonly experimentRepository: ExperimentRepository,
    @Inject(DATABRICKS_PORT) private readonly databricksPort: DatabricksPort,
  ) {}

  // Single annotation
  async execute(
    experimentId: string,
    userId: string,
    annotationData: AddAnnotationBody,
  ): Promise<Result<Annotation>> {
    const annotationBulkData: AddAnnotationsBulkBody = {
      rowIds: [annotationData.rowId],
      tableName: annotationData.tableName,
      annotation: annotationData.annotation,
    };
    return this.executeMany(experimentId, userId, annotationBulkData).then((result) =>
      result.map((annotations: Annotation[]) => annotations[0]),
    );
  }

  // Bulk annotations - main implementation
  async executeMany(
    experimentId: string,
    userId: string,
    bulkAnnotationData: AddAnnotationsBulkBody,
  ): Promise<Result<Annotation[]>> {
    this.logger.log(
      `Adding ${bulkAnnotationData.rowIds.length} annotation(s) to experiment ${experimentId} by user ${userId}`,
    );

    // Validate input data
    const validationErrors = zAddAnnotationsBulkBody.safeParse(bulkAnnotationData);

    if (!validationErrors.success) {
      return failure(AppError.badRequest("Invalid annotation data"));
    }

    // Check experiment exists and user has access
    const accessResult = await this.experimentRepository.checkAccess(experimentId, userId);
    if (accessResult.isFailure()) {
      return accessResult.chain(() => failure(AppError.forbidden("Access denied")));
    }

    const { experiment, hasAccess } = accessResult.value;
    if (!hasAccess) {
      return failure(AppError.forbidden("Insufficient permissions"));
    }
    if (!experiment) {
      return failure(AppError.notFound("Experiment not found"));
    }

    // Validate data references against Databricks schema
    // const dataReferences = annotationsData.map((a) => a.dataReference);
    // const validationResult = await this.databricksPort.validateAnnotationDataReferences(
    //   experimentId,
    //   experiment.name,
    //   dataReferences,
    // );
    //
    // if (validationResult.isFailure()) {
    //   return validationResult;
    // }

    // Create annotation objects
    const annotations: ExperimentDataAnnotation[] = [];
    for (const rowId of bulkAnnotationData.rowIds) {
      annotations.push({
        id: uuidv4(),
        experimentId,
        userId,
        type: bulkAnnotationData.annotation.type,
        content: bulkAnnotationData.annotation.content,
        dataReference: {
          tableName: bulkAnnotationData.tableName,
          rowId,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        isDeleted: false,
      });
    }

    // Type-specific processing
    const processedAnnotations = await this.processAnnotationsByType(annotations);

    // Store in Databricks
    const storeResult = await this.databricksPort.storeExperimentAnnotations(
      experimentId,
      experiment.name,
      processedAnnotations,
    );

    if (storeResult.isFailure()) {
      this.logger.error(
        `Failed to store annotations for experiment ${experimentId}:`,
        storeResult.error.message,
      );
      return failure(
        AppError.internal(`Failed to store annotations: ${storeResult.error.message}`),
      );
    }

    const storedAnnotations: Annotation[] = storeResult.value.map((createdAnnotation) => {
      return {
        id: createdAnnotation.id,
        rowId: createdAnnotation.dataReference.rowId,
        type: createdAnnotation.type,
        content: createdAnnotation.content,
        createdBy: createdAnnotation.userId,
        createdAt: createdAnnotation.createdAt.toISOString(),
        updatedAt: createdAnnotation.updatedAt.toISOString(),
      };
    });
    return success(storedAnnotations);
  }

  private async processAnnotationsByType(
    annotations: ExperimentDataAnnotation[],
  ): Promise<ExperimentDataAnnotation[]> {
    // Group by type for efficient processing
    const byType = annotations.reduce(
      (acc, annotation) => {
        acc[annotation.type] = acc[annotation.type] ?? [];
        acc[annotation.type].push(annotation);
        return acc;
      },
      {} as Record<string, ExperimentDataAnnotation[]>,
    );

    const processed: ExperimentDataAnnotation[] = [];

    for (const [type, typeAnnotations] of Object.entries(byType)) {
      switch (type) {
        case "flag":
          // Check for flag conflicts
          processed.push(...(await this.processFlags(typeAnnotations)));
          break;
        default:
          processed.push(...typeAnnotations);
      }
    }

    return processed;
  }

  private async processFlags(
    annotations: ExperimentDataAnnotation[],
  ): Promise<ExperimentDataAnnotation[]> {
    // Could check for conflicting flags on same data reference
    await tryCatch(() => {
      return;
    });
    return annotations;
  }
}
