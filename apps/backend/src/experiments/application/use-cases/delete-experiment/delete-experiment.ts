import { Injectable, Logger } from "@nestjs/common";

import { ErrorCodes } from "../../../../common/utils/error-codes";
import { Result, failure, AppError } from "../../../../common/utils/fp-utils";
import { ResourceDeletedNotifier } from "../../../../notifications/application/services/resource-deleted-notifier";
import { SharingRepository } from "../../../../sharing/core/repositories/sharing.repository";
import { ExperimentDto } from "../../../core/models/experiment.model";
import { ExperimentRepository } from "../../../core/repositories/experiment.repository";

@Injectable()
export class DeleteExperimentUseCase {
  private readonly logger = new Logger(DeleteExperimentUseCase.name);

  constructor(
    private readonly experimentRepository: ExperimentRepository,
    private readonly sharingRepository: SharingRepository,
    private readonly deletionNotifier: ResourceDeletedNotifier,
  ) {}

  async execute(id: string, userId: string): Promise<Result<void>> {
    this.logger.log({
      msg: "Deleting experiment",
      operation: "deleteExperiment",
      experimentId: id,
      userId,
    });

    const experimentResult = await this.experimentRepository.findOne(id);

    return experimentResult.chain(async (experiment: ExperimentDto | null) => {
      if (!experiment) {
        this.logger.warn({
          msg: "Attempt to delete non-existent experiment",
          errorCode: ErrorCodes.EXPERIMENT_NOT_FOUND,
          operation: "deleteExperiment",
          experimentId: id,
        });
        return failure(AppError.notFound(`Experiment with ID ${id} not found`));
      }

      // Authorization is enforced declaratively by @CanAccess on the route.
      this.logger.debug({
        msg: "Deleting experiment from repository",
        operation: "deleteExperiment",
        experimentId: id,
      });
      const members = await this.sharingRepository.listMemberIds("experiment", id);

      const deleteResult = await this.experimentRepository.delete(id);

      if (deleteResult.isSuccess()) {
        await this.deletionNotifier.notify({
          operation: "deleteExperiment",
          actorId: userId,
          resource: { type: "experiment", id },
          name: experiment.name,
          members,
        });

        this.logger.log({
          msg: "Experiment deleted successfully",
          operation: "deleteExperiment",
          experimentId: id,
          status: "success",
        });
      } else {
        this.logger.error({
          msg: "Failed to delete experiment",
          errorCode: ErrorCodes.EXPERIMENT_DELETE_FAILED,
          operation: "deleteExperiment",
          experimentId: id,
        });
      }

      return deleteResult;
    });
  }
}
