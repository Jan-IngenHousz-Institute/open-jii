import { Injectable, Logger, Inject } from "@nestjs/common";

import { AnnotationRowsAffected, UpdateAnnotationBody } from "@repo/api";

import { ErrorCodes } from "../../../../../common/utils/error-codes";
import { AppError, failure, Result, success } from "../../../../../common/utils/fp-utils";
import { UpdateAnnotationDto } from "../../../../core/models/experiment-data-annotation.model";
import type { ExperimentDto } from "../../../../core/models/experiment.model";
import { DATABRICKS_PORT } from "../../../../core/ports/databricks.port";
import type { DatabricksPort } from "../../../../core/ports/databricks.port";
import { ExperimentDataAnnotationsRepository } from "../../../../core/repositories/experiment-data-annotations.repository";
import { ExperimentRepository } from "../../../../core/repositories/experiment.repository";

@Injectable()
export class UpdateAnnotationUseCase {
  private readonly logger = new Logger(UpdateAnnotationUseCase.name);

  constructor(
    private readonly experimentRepository: ExperimentRepository,
    private readonly experimentDataAnnotationsRepository: ExperimentDataAnnotationsRepository,
    @Inject(DATABRICKS_PORT) private readonly databricksPort: DatabricksPort,
  ) {}

  async execute(
    experimentId: string,
    annotationId: string,
    data: UpdateAnnotationBody,
    userId: string,
  ): Promise<Result<AnnotationRowsAffected>> {
    this.logger.log({
      msg: "Updating annotation to experiment data",
      operation: "updateAnnotation",
      experimentId,
      annotationId,
      userId,
    });

    // Validate that the user ID is provided
    if (!userId) {
      this.logger.warn({
        msg: "Attempt to update annotation for experiment without user ID",
        operation: "updateAnnotation",
        experimentId,
        annotationId,
      });
      return failure(
        AppError.badRequest("User ID is required to update annotation for experiment"),
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
          this.logger.warn({
            msg: "Experiment not found",
            operation: "updateAnnotation",
            experimentId,
          });
          return failure(AppError.notFound(`Experiment with ID ${experimentId} not found`));
        }
        if (!hasAccess && experiment.visibility !== "public") {
          this.logger.warn({
            msg: "User attempted to access experiment data without proper permissions",
            operation: "updateAnnotation",
            experimentId,
            userId,
          });
          return failure(AppError.forbidden("You do not have access to this experiment"));
        }

        if (!experiment.schemaName) {
          this.logger.error({
            msg: "Experiment has no schema name",
            errorCode: ErrorCodes.EXPERIMENT_SCHEMA_NOT_READY,
            operation: "updateAnnotation",
            experimentId,
            error: "Experiment schema not provisioned",
          });
          return failure(AppError.internal("Experiment schema not provisioned"));
        }

        const updateAnnotation: UpdateAnnotationDto = {};
        if ("text" in data.content) {
          updateAnnotation.contentText = data.content.text;
        }
        if ("flagType" in data.content) {
          updateAnnotation.flagType = data.content.flagType;
          updateAnnotation.contentText = data.content.text ?? null;
        }

        const result = await this.experimentDataAnnotationsRepository.updateAnnotation(
          experiment.schemaName,
          experimentId,
          annotationId,
          updateAnnotation,
        );

        if (result.isFailure()) {
          return failure(AppError.internal(result.error.message));
        }

        // No manual refresh needed - materialized views auto-refresh

        return success(result.value);
      },
    );
  }
}
