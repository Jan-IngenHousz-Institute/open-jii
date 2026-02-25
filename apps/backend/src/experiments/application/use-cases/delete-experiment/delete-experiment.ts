import { Injectable, Logger } from "@nestjs/common";

import { ErrorCodes } from "../../../../common/utils/error-codes";
import { Result, failure, AppError } from "../../../../common/utils/fp-utils";
import { ExperimentDto } from "../../../core/models/experiment.model";
import { ExperimentMetadataRepository } from "../../../core/repositories/experiment-metadata.repository";
import { ExperimentRepository } from "../../../core/repositories/experiment.repository";

@Injectable()
export class DeleteExperimentUseCase {
  private readonly logger = new Logger(DeleteExperimentUseCase.name);

  constructor(
    private readonly experimentRepository: ExperimentRepository,
    private readonly experimentMetadataRepository: ExperimentMetadataRepository,
  ) {}

  async execute(id: string, userId: string): Promise<Result<void>> {
    this.logger.log({
      msg: "Deleting experiment",
      operation: "deleteExperiment",
      experimentId: id,
      userId,
    });

    // Check if experiment exists and user is a member
    const accessCheckResult = await this.experimentRepository.checkAccess(id, userId);

    return accessCheckResult.chain(
      async ({
        experiment,
        hasAccess,
      }: {
        experiment: ExperimentDto | null;
        hasAccess: boolean;
      }) => {
        if (!experiment) {
          this.logger.warn({
            msg: "Attempt to delete non-existent experiment",
            errorCode: ErrorCodes.EXPERIMENT_NOT_FOUND,
            operation: "deleteExperiment",
            experimentId: id,
          });
          return failure(AppError.notFound(`Experiment with ID ${id} not found`));
        }

        if (!hasAccess) {
          this.logger.warn({
            msg: "User is not a member of experiment",
            errorCode: ErrorCodes.FORBIDDEN,
            operation: "deleteExperiment",
            experimentId: id,
            userId,
          });
          return failure(AppError.forbidden("Only experiment members can delete experiments"));
        }

        // Clean up metadata in Databricks before deleting the experiment from Postgres.
        // This is best-effort — we log but don't block the delete if metadata cleanup fails,
        // since the experiment record is the source of truth.
        const metadataDeleteResult =
          await this.experimentMetadataRepository.deleteByExperimentId(id);

        if (metadataDeleteResult.isFailure()) {
          this.logger.warn({
            msg: "Failed to delete experiment metadata from Databricks, proceeding with experiment deletion",
            operation: "deleteExperiment",
            experimentId: id,
            error: metadataDeleteResult.error.message,
          });
        }

        this.logger.debug({
          msg: "Deleting experiment from repository",
          operation: "deleteExperiment",
          experimentId: id,
        });
        // Delete the experiment
        const deleteResult = await this.experimentRepository.delete(id);

        if (deleteResult.isSuccess()) {
          this.logger.log({
            msg: "Experiment deleted successfully",
            operation: "deleteExperiment",
            experimentId: id,
            userId,
            status: "success",
          });
        } else {
          this.logger.error({
            msg: "Failed to delete experiment",
            errorCode: ErrorCodes.EXPERIMENT_DELETE_FAILED,
            operation: "deleteExperiment",
            experimentId: id,
            userId,
          });
        }

        return deleteResult;
      },
    );
  }
}
