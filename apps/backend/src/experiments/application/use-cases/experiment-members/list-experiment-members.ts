import { Injectable, Logger } from "@nestjs/common";

import { AppError, Result, failure } from "../../../../common/utils/fp-utils";
import { ExperimentMemberDto } from "../../../core/models/experiment-members.model";
import { ExperimentMemberRepository } from "../../../core/repositories/experiment-member.repository";
import { ExperimentRepository } from "../../../core/repositories/experiment.repository";

@Injectable()
export class ListExperimentMembersUseCase {
  private readonly logger = new Logger(ListExperimentMembersUseCase.name);

  constructor(
    private readonly experimentRepository: ExperimentRepository,
    private readonly experimentMemberRepository: ExperimentMemberRepository,
  ) {}

  async execute(experimentId: string, userId: string): Promise<Result<ExperimentMemberDto[]>> {
    this.logger.log({
      msg: "Listing experiment members",
      operation: "list-experiment-members",
      experimentId,
      userId,
    });

    const experimentResult = await this.experimentRepository.findOne(experimentId);
    if (experimentResult.isFailure()) {
      return failure(experimentResult.error);
    }
    if (!experimentResult.value) {
      this.logger.warn({
        msg: "Attempt to list members of non-existent experiment",
        operation: "list-experiment-members",
        experimentId,
      });
      return failure(AppError.notFound(`Experiment with ID ${experimentId} not found`));
    }

    // Read authorization is enforced declaratively by
    // `@CanAccess({ resource: "experiment", action: "read" })` on the route.
    return this.experimentMemberRepository.getMembers(experimentId);
  }
}
