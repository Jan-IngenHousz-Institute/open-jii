import { Injectable, Logger, Inject } from "@nestjs/common";

import { AnnotationRowsAffected } from "@repo/api";

import { ErrorCodes } from "../../../../../common/utils/error-codes";
import { AppError, failure, Result, success } from "../../../../../common/utils/fp-utils";
import { DeleteAnnotationsRequest } from "../../../../core/models/experiment-data-annotation.model";
import type { ExperimentDto } from "../../../../core/models/experiment.model";
import { DATABRICKS_PORT } from "../../../../core/ports/databricks.port";
import type { DatabricksPort } from "../../../../core/ports/databricks.port";
import { ExperimentDataAnnotationsRepository } from "../../../../core/repositories/experiment-data-annotations.repository";
import { ExperimentRepository } from "../../../../core/repositories/experiment.repository";

@Injectable()
export class DeleteAnnotationsUseCase {
  private readonly logger = new Logger(DeleteAnnotationsUseCase.name);

  constructor(
    private readonly experimentRepository: ExperimentRepository,
    private readonly experimentDataAnnotationsRepository: ExperimentDataAnnotationsRepository,
    @Inject(DATABRICKS_PORT) private readonly databricksPort: DatabricksPort,
  ) {}

  async execute(
    experimentId: string,
    request: DeleteAnnotationsRequest,
    userId: string,
  ): Promise<Result<AnnotationRowsAffected>> {
    this.logger.log({
      msg: "Deleting annotation(s) from experiment data",
      operation: "deleteAnnotations",
      context: DeleteAnnotationsUseCase.name,
      experimentId,
      userId,
    });

    // Validate that the user ID is provided
    if (!userId) {
      this.logger.warn({
        msg: "Attempt to delete annotation(s) for experiment without user ID",
        operation: "deleteAnnotations",
        context: DeleteAnnotationsUseCase.name,
        experimentId,
      });
      return failure(
        AppError.badRequest("User ID is required to delete annotation(s) for an experiment"),
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
            operation: "deleteAnnotations",
            context: DeleteAnnotationsUseCase.name,
            experimentId,
          });
          return failure(AppError.notFound(`Experiment with ID ${experimentId} not found`));
        }
        if (!hasAccess && experiment.visibility !== "public") {
          this.logger.warn({
            msg: "User attempted to access experiment data without proper permissions",
            operation: "deleteAnnotations",
            context: DeleteAnnotationsUseCase.name,
            experimentId,
            userId,
          });
          return failure(AppError.forbidden("You do not have access to this experiment"));
        }

        if (!experiment.schemaName) {
          this.logger.error({
            msg: "Experiment has no schema name",
            errorCode: ErrorCodes.EXPERIMENT_SCHEMA_NOT_READY,
            operation: "deleteAnnotations",
            context: DeleteAnnotationsUseCase.name,
            experimentId,
            error: "Experiment schema not provisioned",
          });
          return failure(AppError.internal("Experiment schema not provisioned"));
        }

        if ("annotationId" in request) {
          const result = await this.experimentDataAnnotationsRepository.deleteAnnotation(
            experiment.schemaName,
            request.annotationId,
          );

          if (result.isFailure()) {
            return failure(AppError.internal(result.error.message));
          }

          // Trigger silver data refresh to update enriched tables with deleted annotation
          if (experiment.schemaName && experiment.pipelineId) {
            const refreshResult = await this.databricksPort.refreshSilverData(
              experiment.schemaName,
              experiment.pipelineId,
            );

            if (refreshResult.isFailure()) {
              this.logger.warn({
                msg: "Failed to trigger silver data refresh after deleting annotation",
                operation: "deleteAnnotations",
                context: DeleteAnnotationsUseCase.name,
                experimentId,
                schemaName: experiment.schemaName,
                error: refreshResult.error.message,
              });
              // Don't fail the whole operation, just log the warning
            }
          }

          return success(result.value);
        } else {
          const result = await this.experimentDataAnnotationsRepository.deleteAnnotationsBulk(
            experiment.schemaName,
            request.tableName,
            request.rowIds,
            request.type,
          );

          if (result.isFailure()) {
            return failure(AppError.internal(result.error.message));
          }

          // Trigger silver data refresh to update enriched tables with deleted annotations
          if (experiment.schemaName && experiment.pipelineId) {
            const refreshResult = await this.databricksPort.refreshSilverData(
              experiment.schemaName,
              experiment.pipelineId,
            );

            if (refreshResult.isFailure()) {
              this.logger.warn({
                msg: "Failed to trigger silver data refresh after bulk deleting annotations",
                operation: "deleteAnnotations",
                context: DeleteAnnotationsUseCase.name,
                experimentId,
                schemaName: experiment.schemaName,
                error: refreshResult.error.message,
              });
              // Don't fail the whole operation, just log the warning
            }
          }

          return success(result.value);
        }
      },
    );
  }
}
