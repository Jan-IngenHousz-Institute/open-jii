import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import { ExperimentRepository } from "../../../core/repositories/experiment.repository";

@Injectable()
export class AddExperimentMemberUseCase {
  constructor(private readonly experimentRepository: ExperimentRepository) {}

  async execute(
    experimentId: string,
    data: { userId: string; role?: "admin" | "member" },
    currentUserId: string,
  ): Promise<any> {
    // Check if the experiment exists
    const experiment = await this.experimentRepository.findOne(experimentId);
    if (!experiment) {
      throw new NotFoundException(
        `Experiment with ID ${experimentId} not found`,
      );
    }

    // Check if current user has permission to add members (must be admin)
    const members = await this.experimentRepository.getMembers(experimentId);
    const currentUserMember = members.find(member => member.userId === currentUserId);
    if (!currentUserMember || currentUserMember.role !== "admin") {
      throw new ForbiddenException("Only experiment admins can add members");
    }

    // Add the member
    return this.experimentRepository.addMember(
      experimentId,
      data.userId,
      data.role,
    );
  }
}
