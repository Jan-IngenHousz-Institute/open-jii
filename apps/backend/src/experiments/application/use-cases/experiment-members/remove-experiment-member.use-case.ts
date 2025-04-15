import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common";

import { ExperimentRepository } from "../../core/repositories/experiment.repository";

@Injectable()
export class RemoveExperimentMemberUseCase {
  constructor(private readonly experimentRepository: ExperimentRepository) {}

  async execute(
    experimentId: string,
    memberUserId: string,
    currentUserId: string,
  ) {
    const experiment = await this.experimentRepository.findOne(experimentId);
    if (!experiment) {
      throw new NotFoundException(
        `Experiment with ID ${experimentId} not found`,
      );
    }

    // Users can remove themselves from an experiment
    if (memberUserId === currentUserId) {
      return this.experimentRepository.removeMember(experimentId, memberUserId);
    }

    // Otherwise, only the creator or admin members can remove members
    const isCreator = experiment.createdBy === currentUserId;
    const isAdmin = await this.isUserAdmin(experimentId, currentUserId);

    if (!isCreator && !isAdmin) {
      throw new ForbiddenException(
        `No permission to remove members from this experiment`,
      );
    }

    // Cannot remove the creator
    if (memberUserId === experiment.createdBy) {
      throw new ForbiddenException(`Cannot remove the experiment creator`);
    }

    return this.experimentRepository.removeMember(experimentId, memberUserId);
  }

  private async isUserAdmin(
    experimentId: string,
    userId: string,
  ): Promise<boolean> {
    const members = await this.experimentRepository.getMembers(experimentId);
    return members.some(
      (member) => member.userId === userId && member.role === "admin",
    );
  }
}
