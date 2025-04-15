import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common";

import { ExperimentRepository } from "../../core/repositories/experiment.repository";

@Injectable()
export class ListExperimentMembersUseCase {
  constructor(private readonly experimentRepository: ExperimentRepository) {}

  async execute(experimentId: string, userId: string) {
    const experiment = await this.experimentRepository.findOne(experimentId);
    if (!experiment) {
      throw new NotFoundException(
        `Experiment with ID ${experimentId} not found`,
      );
    }

    // Check if user has access to the experiment
    const hasAccess = await this.experimentRepository.hasAccess(
      experimentId,
      userId,
    );
    if (!hasAccess) {
      throw new ForbiddenException(`No access to this experiment`);
    }

    return this.experimentRepository.getMembers(experimentId);
  }
}
