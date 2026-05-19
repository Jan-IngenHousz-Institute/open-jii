import { Injectable, Logger } from "@nestjs/common";

import { Result, success, failure, AppError } from "../../../../common/utils/fp-utils";
import type { ExperimentJoinRequestDto } from "../../../core/models/experiment-join-request.model";
import { ExperimentDto } from "../../../core/models/experiment.model";
import { ExperimentJoinRequestRepository } from "../../../core/repositories/experiment-join-request.repository";
import { ExperimentRepository } from "../../../core/repositories/experiment.repository";

@Injectable()
export class ListExperimentJoinRequestsUseCase {
  private readonly logger = new Logger(ListExperimentJoinRequestsUseCase.name);

  constructor(
    private readonly experimentRepository: ExperimentRepository,
    private readonly joinRequestRepository: ExperimentJoinRequestRepository,
  ) {}

  async execute(
    experimentId: string,
    currentUserId: string,
  ): Promise<Result<ExperimentJoinRequestDto[]>> {
    this.logger.log({
      msg: "Listing pending join requests",
      operation: "list-experiment-join-requests",
      experimentId,
      userId: currentUserId,
    });

    const accessCheckResult = await this.experimentRepository.checkAccess(
      experimentId,
      currentUserId,
    );

    return accessCheckResult.chain(
      async ({ experiment, isAdmin }: { experiment: ExperimentDto | null; isAdmin: boolean }) => {
        if (!experiment) {
          return failure(AppError.notFound(`Experiment with ID ${experimentId} not found`));
        }

        if (!isAdmin) {
          return failure(AppError.forbidden("Only admins can view join requests"));
        }

        const listResult = await this.joinRequestRepository.listPendingByExperiment(experimentId);
        if (listResult.isFailure()) {
          return failure(AppError.internal("Failed to list join requests"));
        }

        return success(listResult.value);
      },
    );
  }
}
