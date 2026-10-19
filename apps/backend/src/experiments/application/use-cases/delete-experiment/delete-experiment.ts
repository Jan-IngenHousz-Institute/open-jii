import { Injectable, Logger } from "@nestjs/common";

import { ErrorCodes } from "../../../../common/utils/error-codes";
import { Result, failure, AppError } from "../../../../common/utils/fp-utils";
import { NotificationDispatchService } from "../../../../notifications/application/services/notification-dispatch.service";
import { SharingRepository } from "../../../../sharing/core/repositories/sharing.repository";
import { ExperimentDto } from "../../../core/models/experiment.model";
import { ExperimentRepository } from "../../../core/repositories/experiment.repository";

@Injectable()
export class DeleteExperimentUseCase {
  private readonly logger = new Logger(DeleteExperimentUseCase.name);

  constructor(
    private readonly experimentRepository: ExperimentRepository,
    private readonly sharingRepository: SharingRepository,
    private readonly notifications: NotificationDispatchService,
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
        await this.notify(userId, id, experiment.name, members);

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

  /** Tell everyone who had access. A failure here leaves the delete standing. */
  private async notify(
    actorId: string,
    experimentId: string,
    resourceName: string,
    members: Result<string[]>,
  ): Promise<void> {
    if (members.isFailure()) {
      this.logger.error({
        msg: "Could not read who had access, nobody was notified of the deletion",
        errorCode: ErrorCodes.INTERNAL_SERVER_ERROR,
        operation: "deleteExperiment",
        experimentId,
        error: members.error,
      });
      return;
    }

    const dispatched = await this.notifications.dispatch({
      type: "resource_deleted",
      recipientIds: members.value,
      actorId,
      resource: { type: "experiment", id: experimentId },
      params: { resourceName },
    });

    if (dispatched.isFailure()) {
      this.logger.error({
        msg: "Failed to notify members, the experiment was still deleted",
        errorCode: ErrorCodes.INTERNAL_SERVER_ERROR,
        operation: "deleteExperiment",
        experimentId,
        error: dispatched.error,
      });
    }
  }
}
