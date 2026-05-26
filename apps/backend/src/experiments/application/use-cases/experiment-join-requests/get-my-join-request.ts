import { Injectable, Logger } from "@nestjs/common";

import { Result, success, failure, AppError } from "../../../../common/utils/fp-utils";
import type { ExperimentJoinRequestDto } from "../../../core/models/experiment-join-request.model";
import { ExperimentJoinRequestRepository } from "../../../core/repositories/experiment-join-request.repository";

@Injectable()
export class GetMyJoinRequestUseCase {
  private readonly logger = new Logger(GetMyJoinRequestUseCase.name);

  constructor(private readonly joinRequestRepository: ExperimentJoinRequestRepository) {}

  async execute(
    experimentId: string,
    userId: string,
  ): Promise<Result<ExperimentJoinRequestDto | null>> {
    this.logger.debug({
      msg: "Looking up own pending join request",
      operation: "get-my-join-request",
      experimentId,
      userId,
    });

    const result = await this.joinRequestRepository.findPendingByExperimentAndUser(
      experimentId,
      userId,
    );

    if (result.isFailure()) {
      return failure(AppError.internal("Failed to look up join request"));
    }

    return success(result.value);
  }
}
