import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common";

import { ExperimentRepository } from "../../core/repositories/experiment.repository";

export interface AddMemberDto {
  userId: string;
  role?: "admin" | "member";
}

@Injectable()
export class AddExperimentMemberUseCase {
  constructor(private readonly experimentRepository: ExperimentRepository) {}

  async execute(
    experimentId: string,
    addMemberDto: AddMemberDto,
    currentUserId: string,
  ) {
    const experiment = await this.experimentRepository.findOne(experimentId);
    if (!experiment) {
      throw new NotFoundException(
        `Experiment with ID ${experimentId} not found`,
      );
    }

    // Only the creator or admin members can add members
    const isCreator = experiment.createdBy === currentUserId;
    const isAdmin = await this.isUserAdmin(experimentId, currentUserId);

    if (!isCreator && !isAdmin) {
      throw new ForbiddenException(
        `No permission to add members to this experiment`,
      );
    }

    return this.experimentRepository.addMember(
      experimentId,
      addMemberDto.userId,
      addMemberDto.role || "member",
    );
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
