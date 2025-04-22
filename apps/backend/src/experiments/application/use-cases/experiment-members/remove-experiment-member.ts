import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import { ExperimentRepository } from "../../../core/repositories/experiment.repository";

@Injectable()
export class RemoveExperimentMemberUseCase {
  constructor(private readonly experimentRepository: ExperimentRepository) {}

  async execute(
    experimentId: string,
    memberId: string,
    currentUserId: string,
  ): Promise<void> {
    // Check if experiment exists
    const experiment = await this.experimentRepository.findOne(experimentId);
    if (!experiment) {
      throw new NotFoundException(
        `Experiment with ID ${experimentId} not found`,
      );
    }

    // Check if user has permission (must be admin)
    // const role = await this.experimentRepository.getMemberRole(
    //   experimentId,
    //   currentUserId,
    // );
    // if (role !== "admin") {
    //   throw new ForbiddenException("Only experiment admins can remove members");
    // }

    // Check if memberId exists and belongs to this experiment
    const members = await this.experimentRepository.getMembers(experimentId);
    const memberExists = members.some((member) => member.id === memberId);
    if (!memberExists) {
      throw new NotFoundException(
        `Member with ID ${memberId} not found in this experiment`,
      );
    }

    // Remove the member
    await this.experimentRepository.removeMember(experimentId, memberId);
  }
}
