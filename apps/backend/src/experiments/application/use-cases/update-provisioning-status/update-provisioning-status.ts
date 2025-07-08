import { Injectable, Logger } from "@nestjs/common";

import { ExperimentProvisioningStatus } from "@repo/api";

import { AppError, Result, failure, success } from "../../../../common/utils/fp-utils";
import { ExperimentDto, ExperimentStatus } from "../../../core/models/experiment.model";
import { ExperimentRepository } from "../../../core/repositories/experiment.repository";

@Injectable()
export class UpdateProvisioningStatusUseCase {
  private readonly logger = new Logger(UpdateProvisioningStatusUseCase.name);

  constructor(private readonly experimentRepository: ExperimentRepository) {}

  async execute({
    experimentId,
    status,
  }: {
    experimentId: string;
    status: ExperimentProvisioningStatus;
  }): Promise<Result<ExperimentDto["status"]>> {
    this.logger.log(
      `Processing Databricks workflow status update for experiment ID ${experimentId} with status ${status}`,
    );

    // Get the current experiment status first to make the operation idempotent
    const experimentResult = await this.experimentRepository.findOne(experimentId);

    return experimentResult.chain(async (experiment: ExperimentDto | null) => {
      if (!experiment) {
        this.logger.error(`Experiment with ID ${experimentId} not found`);
        return failure(AppError.notFound(`Experiment with ID ${experimentId} not found`));
      }

      // Map Databricks status to experiment status
      const experimentStatusResult = this.mapDatabricksStatus(status);

      if (experimentStatusResult.isFailure()) {
        return experimentStatusResult;
      }

      const targetStatus = experimentStatusResult.value;

      // If the experiment is already in the target state, return success without changing
      if (experiment.status === targetStatus) {
        this.logger.log(
          `Experiment ${experimentId} is already in ${targetStatus} state. No update needed.`,
        );
        return success(experiment.status);
      }

      this.logger.log(
        `Updating experiment ${experimentId} status from ${experiment.status} to ${targetStatus}`,
      );

      const updateExperimentStatusResult = await this.experimentRepository.update(experimentId, {
        status: targetStatus,
      });

      if (updateExperimentStatusResult.isFailure()) {
        this.logger.error(
          `Failed to update experiment ${experimentId} status: ${updateExperimentStatusResult.error.message}`,
        );
        return updateExperimentStatusResult;
      }

      if (updateExperimentStatusResult.value.length === 0) {
        this.logger.error(`No experiment was updated for ID ${experimentId}`);
        return failure(
          AppError.internal(`Failed to update experiment status for ID ${experimentId}`),
        );
      }

      const updatedExperiment = updateExperimentStatusResult.value[0];
      this.logger.log(
        `Successfully updated experiment "${updatedExperiment.name}" (ID: ${experimentId}) status to "${targetStatus}"`,
      );
      return success(updatedExperiment.status);
    });
  }

  /**
   * Maps Databricks workflow status to experiment status.
   * Returns success with the mapped status, or failure for non-terminal statuses.
   */
  private mapDatabricksStatus(status: ExperimentProvisioningStatus): Result<ExperimentStatus> {
    switch (status) {
      case "SUCCESS":
      case "COMPLETED":
        return success("active");

      case "FAILURE":
      case "FAILED":
      case "TIMEOUT":
      case "CANCELED":
      case "TERMINATED":
        return success("provisioning_failed");

      default:
        return failure(
          AppError.badRequest(
            `Non-terminal status '${status as string}' does not require a state change.`,
          ),
        );
    }
  }
}
