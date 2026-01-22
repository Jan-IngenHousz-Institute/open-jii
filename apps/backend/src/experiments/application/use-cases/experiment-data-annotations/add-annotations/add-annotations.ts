import { Injectable, Logger, Inject } from "@nestjs/common";

import { AddAnnotationsBulkBody, AnnotationRowsAffected } from "@repo/api";

import { ErrorCodes } from "../../../../../common/utils/error-codes";
import type { Result } from "../../../../../common/utils/fp-utils";
import { success } from "../../../../../common/utils/fp-utils";
import { AppError, failure } from "../../../../../common/utils/fp-utils";
import { UserRepository } from "../../../../../users/core/repositories/user.repository";
import {
  isCommentContent,
  isFlagContent,
} from "../../../../core/models/experiment-data-annotation.model";
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
    private readonly userRepository: UserRepository,
    @Inject(DATABRICKS_PORT) private readonly databricksPort: DatabricksPort,
  ) {}

  async execute(
    experimentId: string,
    data: AddAnnotationsBulkBody,
    userId: string,
  ): Promise<Result<AnnotationRowsAffected>> {
    this.logger.log({
      msg: "Adding annotation(s) to experiment data",
      operation: "addAnnotations",
      context: AddAnnotationsUseCase.name,
      experimentId,
      userId,
    });

    // Validate that the user ID is provided
    if (!userId) {
      this.logger.warn({
        msg: "Attempt to add annotation(s) to experiment without user ID",
        operation: "addAnnotations",
        context: AddAnnotationsUseCase.name,
        experimentId,
      });
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
          this.logger.warn({
            msg: "Experiment not found",
            operation: "addAnnotations",
            context: AddAnnotationsUseCase.name,
            experimentId,
          });
          return failure(AppError.notFound(`Experiment with ID ${experimentId} not found`));
        }
        if (!hasAccess && experiment.visibility !== "public") {
          this.logger.warn({
            msg: "User attempted to access experiment data without proper permissions",
            operation: "addAnnotations",
            context: AddAnnotationsUseCase.name,
            experimentId,
            userId,
          });
          return failure(AppError.forbidden("You do not have access to this experiment"));
        }

        if (!experiment.schemaName) {
          this.logger.error({
            msg: "Experiment has no schema name",
            errorCode: ErrorCodes.EXPERIMENT_SCHEMA_NOT_READY,
            operation: "addAnnotations",
            context: AddAnnotationsUseCase.name,
            experimentId,
            error: "Experiment schema not provisioned",
          });
          return failure(AppError.internal("Experiment schema not provisioned"));
        }

        const createResult = await this.experimentDataAnnotationsRepository.ensureTableExists(
          experiment.schemaName,
          experimentId,
        );
        if (createResult.isFailure()) {
          return failure(AppError.internal(createResult.error.message));
        }

        // Fetch user profile to get full name
        const userProfilesResult = await this.userRepository.findUsersByIds([userId]);
        if (userProfilesResult.isFailure()) {
          this.logger.warn({
            msg: "Failed to fetch user profile",
            operation: "addAnnotations",
            context: AddAnnotationsUseCase.name,
            userId,
            experimentId,
          });
        }
        const userProfile = userProfilesResult.isSuccess() ? userProfilesResult.value[0] : null;
        const userName = userProfile
          ? `${userProfile.firstName || ""} ${userProfile.lastName || ""}`.trim() || null
          : null;

        const newAnnotations = data.rowIds.map((rowId) => {
          const base: CreateAnnotationDto = {
            userId,
            userName,
            tableName: data.tableName,
            rowId,
            type: data.annotation.type,
          };

          if (isCommentContent(data.annotation.content)) {
            return { ...base, contentText: data.annotation.content.text };
          }

          if (isFlagContent(data.annotation.content)) {
            return {
              ...base,
              flagType: data.annotation.content.flagType,
              contentText: data.annotation.content.text ?? null,
            };
          }

          return base;
        });

        const result = await this.experimentDataAnnotationsRepository.storeAnnotations(
          experiment.schemaName,
          newAnnotations,
        );

        if (result.isFailure()) {
          return failure(AppError.internal(result.error.message));
        }

        // Trigger silver data refresh to update enriched tables with new annotations
        if (experiment.schemaName && experiment.pipelineId) {
          const refreshResult = await this.databricksPort.refreshSilverData(
            experiment.schemaName,
            experiment.pipelineId,
          );

          if (refreshResult.isFailure()) {
            this.logger.warn({
              msg: "Failed to trigger silver data refresh after adding annotations",
              operation: "addAnnotations",
              context: AddAnnotationsUseCase.name,
              experimentId,
              schemaName: experiment.schemaName,
              error: refreshResult.error.message,
            });
            // Don't fail the whole operation, just log the warning
          }
        }

        return success(result.value);
      },
    );
  }
}
