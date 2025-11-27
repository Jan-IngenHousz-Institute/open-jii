import { Injectable, Logger, Inject } from "@nestjs/common";

import {
  AddAnnotationsBulkBody,
  AnnotationCommentContent,
  AnnotationFlagContent,
  AnnotationRowsAffected,
} from "@repo/api";

import type { Result } from "../../../../../common/utils/fp-utils";
import { success } from "../../../../../common/utils/fp-utils";
import { AppError, failure } from "../../../../../common/utils/fp-utils";
import type { CreateAnnotationDto } from "../../../../core/models/experiment-data-annotation.model";
import type { ExperimentDto } from "../../../../core/models/experiment.model";
import { DATABRICKS_PORT } from "../../../../core/ports/databricks.port";
import type { DatabricksPort } from "../../../../core/ports/databricks.port";
import { ExperimentDataAnnotationsRepository } from "../../../../core/repositories/experiment-data-annotations.repository";
import { ExperimentRepository } from "../../../../core/repositories/experiment.repository";

@Injectable()
export class AddAnnotationsUseCase {
  private readonly logger = new Logger(AddAnnotationsUseCase.name);

  constructor(
    private readonly experimentRepository: ExperimentRepository,
    private readonly experimentDataAnnotationsRepository: ExperimentDataAnnotationsRepository,
    @Inject(DATABRICKS_PORT) private readonly databricksPort: DatabricksPort,
  ) {}

  async execute(
    experimentId: string,
    data: AddAnnotationsBulkBody,
    userId: string,
  ): Promise<Result<AnnotationRowsAffected>> {
    this.logger.log(`Adding annotation(s) to experiment data for user ${userId}`);

    // Validate that the user ID is provided
    if (!userId) {
      this.logger.warn("Attempt to add annotation(s) to experiment without user ID");
      return failure(
        AppError.badRequest("User ID is required to add annotation(s) to an experiment"),
      );
    }

    // Check if experiment exists and user has access
    const accessResult = await this.experimentRepository.checkAccess(experimentId, userId);

    return accessResult.chain(
      async ({
        hasAccess,
        experiment,
      }: {
        hasAccess: boolean;
        experiment: ExperimentDto | null;
      }) => {
        if (!experiment) {
          this.logger.warn(`Experiment with ID ${experimentId} not found`);
          return failure(AppError.notFound(`Experiment with ID ${experimentId} not found`));
        }
        if (!hasAccess && experiment.visibility !== "public") {
          this.logger.warn(
            `User ${userId} attempted to access data of experiment ${experimentId} without proper permissions`,
          );
          return failure(AppError.forbidden("You do not have access to this experiment"));
        }

        const createResult = await this.experimentDataAnnotationsRepository.ensureTableExists(
          experiment.name,
          experimentId,
        );
        if (createResult.isFailure()) {
          return failure(AppError.internal(createResult.error.message));
        }

        const newAnnotations: CreateAnnotationDto[] = [];
        for (const rowId of data.rowIds) {
          const newAnnotation: CreateAnnotationDto = {
            userId,
            tableName: data.tableName,
            rowId,
            type: data.annotation.type,
          };
          if (data.annotation.type === "comment") {
            const content = data.annotation.content as unknown as AnnotationCommentContent;
            newAnnotation.contentText = content.text;
          } else {
            const content = data.annotation.content as unknown as AnnotationFlagContent;
            newAnnotation.flagType = content.flagType;
            newAnnotation.contentText = content.reason;
          }
          newAnnotations.push(newAnnotation);
        }

        const result = await this.experimentDataAnnotationsRepository.storeAnnotations(
          experiment.name,
          experimentId,
          newAnnotations,
        );

        if (result.isFailure()) {
          return failure(AppError.internal(result.error.message));
        }

        // Trigger silver data refresh to update enriched tables with new annotations
        const refreshResult = await this.databricksPort.refreshSilverData(
          experiment.name,
          experimentId,
        );

        if (refreshResult.isFailure()) {
          this.logger.warn(
            `Failed to trigger silver data refresh after adding annotations: ${refreshResult.error.message}`,
          );
          // Don't fail the whole operation, just log the warning
        }

        return success(result.value);
      },
    );
  }
}
