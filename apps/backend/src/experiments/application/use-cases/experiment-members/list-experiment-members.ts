import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import { ExperimentRepository } from "../../../core/repositories/experiment.repository";

@Injectable()
export class ListExperimentMembersUseCase {
  constructor(private readonly experimentRepository: ExperimentRepository) {}

  async execute(experimentId: string, userId: string): Promise<any[]> {
    // Check if experiment exists
    const experiment = await this.experimentRepository.findOne(experimentId);
    if (!experiment) {
      throw new NotFoundException(
        `Experiment with ID ${experimentId} not found`,
      );
    }

    // Check if user has access (is a member or experiment is public)
    const hasAccess = await this.experimentRepository.hasAccess(
      experimentId,
      userId,
    );
    if (!hasAccess && experiment.visibility !== "public") {
      throw new ForbiddenException("You do not have access to this experiment");
    }

    // Return the members
    return this.experimentRepository.getMembers(experimentId);
  }
}
