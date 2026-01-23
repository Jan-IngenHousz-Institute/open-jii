import { Injectable, Logger } from "@nestjs/common";

import { ExperimentProvisioningStatus } from "@repo/api";

import { ErrorCodes } from "../../../../common/utils/error-codes";
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
    pipelineId,
    schemaName,
  }: {
    experimentId: string;
    status: ExperimentProvisioningStatus;
    pipelineId?: string;
    schemaName?: string;
  }): Promise<Result<ExperimentDto["status"]>> {
    this.logger.log({
      msg: "Processing Databricks workflow status update",
      operation: "update_provisioning_status",
      experimentId,
      status,
      pipelineId,
      schemaName,
    });

    // Get the current experiment status first to make the operation idempotent
    const experimentResult = await this.experimentRepository.findOne(experimentId);

    return experimentResult.chain(async (experiment: ExperimentDto | null) => {
      if (!experiment) {
        this.logger.error({
          msg: "Experiment not found",
          errorCode: ErrorCodes.NOT_FOUND,
          operation: "update_provisioning_status",
          experimentId,
        });
        return failure(AppError.notFound(`Experiment with ID ${experimentId} not found`));
      }

      // Map Databricks status to experiment status
      const experimentStatusResult = this.mapDatabricksStatus(status);

      if (experimentStatusResult.isFailure()) {
        return experimentStatusResult;
      }

      const targetStatus = experimentStatusResult.value;

      // Prepare update data
      const updateData: Partial<ExperimentDto> = {
        status: targetStatus,
      };

      // Include pipelineId and schemaName if provided
      if (pipelineId) {
        updateData.pipelineId = pipelineId;
      }
      if (schemaName) {
        updateData.schemaName = schemaName;
      }

      // If the experiment is already in the target state and no new metadata, return success without changing
      if (experiment.status === targetStatus && !pipelineId && !schemaName) {
        this.logger.log({
          msg: "Experiment already in target state, no update needed",
          operation: "update_provisioning_status",
          experimentId,
          status: targetStatus,
        });
        return success(experiment.status);
      }

      this.logger.log({
        msg: "Updating experiment status",
        operation: "update_provisioning_status",
        experimentId,
        fromStatus: experiment.status,
        toStatus: targetStatus,
      });

      const updateExperimentStatusResult = await this.experimentRepository.update(
        experimentId,
        updateData,
      );

      if (updateExperimentStatusResult.isFailure()) {
        this.logger.error({
          msg: "Failed to update experiment status",
          errorCode: updateExperimentStatusResult.error.code,
          operation: "update_provisioning_status",
          experimentId,
          error: updateExperimentStatusResult.error,
        });
        return updateExperimentStatusResult;
      }

      if (updateExperimentStatusResult.value.length === 0) {
        this.logger.error({
          msg: "No experiment was updated",
          errorCode: ErrorCodes.INTERNAL_SERVER_ERROR,
          operation: "update_provisioning_status",
          experimentId,
        });
        return failure(
          AppError.internal(`Failed to update experiment status for ID ${experimentId}`),
        );
      }

      const updatedExperiment = updateExperimentStatusResult.value[0];
      this.logger.log({
        msg: "Successfully updated experiment status",
        operation: "update_provisioning_status",
        experimentId,
        status: "success",
        newStatus: targetStatus,
      });
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
