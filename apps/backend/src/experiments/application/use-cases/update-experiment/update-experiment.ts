import { Injectable, Logger } from "@nestjs/common";

import { ErrorCodes } from "../../../../common/utils/error-codes";
import { Result, success, failure, AppError } from "../../../../common/utils/fp-utils";
import { ExperimentDto, UpdateExperimentDto } from "../../../core/models/experiment.model";
import { ExperimentRepository } from "../../../core/repositories/experiment.repository";

@Injectable()
export class UpdateExperimentUseCase {
  private readonly logger = new Logger(UpdateExperimentUseCase.name);

  constructor(private readonly experimentRepository: ExperimentRepository) {}

  async execute(
    id: string,
    data: UpdateExperimentDto,
    userId: string,
  ): Promise<Result<ExperimentDto>> {
    this.logger.log({
      msg: "Updating experiment",
      operation: "updateExperiment",
      experimentId: id,
      userId,
    });

    // Check if experiment exists and user is a member
    const accessCheckResult = await this.experimentRepository.checkAccess(id, userId);

    return accessCheckResult.chain(
      async ({
        experiment,
        hasAccess,
        isAdmin,
      }: {
        experiment: ExperimentDto | null;
        hasAccess: boolean;
        isAdmin: boolean;
      }) => {
        if (!experiment) {
          this.logger.warn({
            msg: "Attempt to update non-existent experiment",
            errorCode: ErrorCodes.EXPERIMENT_NOT_FOUND,
            operation: "updateExperiment",
            experimentId: id,
          });
          return failure(AppError.notFound(`Experiment with ID ${id} not found`));
        }

        // Check if user is trying to change status to archived - only admins can do this
        if (data.status === "archived" && experiment.status !== "archived" && !isAdmin) {
          this.logger.warn({
            msg: "Non-admin cannot archive experiment",
            errorCode: ErrorCodes.FORBIDDEN,
            operation: "updateExperiment",
            experimentId: id,
            userId,
          });
          return failure(AppError.forbidden("Only admins can archive experiments"));
        }

        if (!hasAccess) {
          this.logger.warn({
            msg: "User does not have access to experiment",
            errorCode: ErrorCodes.FORBIDDEN,
            operation: "updateExperiment",
            experimentId: id,
            userId,
          });
          return failure(AppError.forbidden("You do not have access to this experiment"));
        }

        // Handling for archived experiments
        if (experiment.status === "archived") {
          if (!isAdmin) {
            this.logger.warn({
              msg: "Non-admin attempted to update archived experiment",
              errorCode: ErrorCodes.FORBIDDEN,
              operation: "updateExperiment",
              experimentId: id,
              userId,
            });
            return failure(AppError.forbidden("You do not have access to this experiment"));
          }

          // Admins can only update the status field when experiment is archived
          const updateFields = Object.keys(data).filter((key) => data[key] !== undefined);
          if (updateFields.length !== 1 || updateFields[0] !== "status") {
            this.logger.warn({
              msg: "Admin attempted to update fields other than status on archived experiment",
              errorCode: ErrorCodes.UNPROCESSABLE_ENTITY,
              operation: "updateExperiment",
              experimentId: id,
              userId,
            });
            return failure(
              AppError.forbidden("Only the status field can be updated on archived experiments"),
            );
          }

          this.logger.debug({
            msg: "Admin updating archived experiment status",
            operation: "updateExperiment",
            experimentId: id,
            userId,
          });
        } else {
          this.logger.debug({
            msg: "Updating experiment",
            operation: "updateExperiment",
            experimentId: id,
          });
        }

        // Update the experiment
        const updateResult = await this.experimentRepository.update(id, data);
        return updateResult.chain((updatedExperiments: ExperimentDto[]) => {
          if (updatedExperiments.length === 0) {
            this.logger.error({
              msg: "Failed to update experiment",
              errorCode: ErrorCodes.EXPERIMENT_UPDATE_FAILED,
              operation: "updateExperiment",
              experimentId: id,
            });
            return failure(AppError.internal(`Failed to update experiment ${id}`));
          }

          const updatedExperiment = updatedExperiments[0];
          this.logger.log({
            msg: "Experiment updated successfully",
            operation: "updateExperiment",
            experimentId: id,
            userId,
            status: "success",
          });
          return success(updatedExperiment);
        });
      },
    );
  }
}
