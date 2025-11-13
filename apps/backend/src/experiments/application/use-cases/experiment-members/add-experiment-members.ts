import { Inject, Injectable, Logger } from "@nestjs/common";

import { Result, success, failure, AppError } from "../../../../common/utils/fp-utils";
import {
  ExperimentMemberDto,
  ExperimentMemberRole,
} from "../../../core/models/experiment-members.model";
import { ExperimentDto } from "../../../core/models/experiment.model";
import { EMAIL_PORT } from "../../../core/ports/email.port";
import type { EmailPort } from "../../../core/ports/email.port";
import { ExperimentMemberRepository } from "../../../core/repositories/experiment-member.repository";
import { ExperimentRepository } from "../../../core/repositories/experiment.repository";

@Injectable()
export class AddExperimentMembersUseCase {
  private readonly logger = new Logger(AddExperimentMembersUseCase.name);

  constructor(
    private readonly experimentRepository: ExperimentRepository,
    private readonly experimentMemberRepository: ExperimentMemberRepository,
    @Inject(EMAIL_PORT) private readonly emailPort: EmailPort,
  ) {}

  async execute(
    experimentId: string,
    members: { userId: string; role?: ExperimentMemberRole }[],
    currentUserId: string,
  ): Promise<Result<ExperimentMemberDto[]>> {
    this.logger.log(
      `Adding members [${members.map((m) => m.userId).join(", ")}] to experiment ${experimentId} by user ${currentUserId}`,
    );

    // Check if the experiment exists and if the user is an admin
    const accessCheckResult = await this.experimentRepository.checkAccess(
      experimentId,
      currentUserId,
    );

    return accessCheckResult.chain(
      async ({ experiment, isAdmin }: { experiment: ExperimentDto | null; isAdmin: boolean }) => {
        if (!experiment) {
          this.logger.warn(
            `Attempt to add members to non-existent experiment with ID ${experimentId}`,
          );
          return failure(AppError.notFound(`Experiment with ID ${experimentId} not found`));
        }

        if (experiment.status === "archived") {
          this.logger.warn(
            `Attempt to add members to archived experiment ${experimentId} by user ${currentUserId}`,
          );
          return failure(AppError.forbidden("Cannot add members to archived experiments"));
        }

        if (!isAdmin) {
          this.logger.warn(`User ${currentUserId} is not admin for experiment ${experimentId}`);
          return failure(AppError.forbidden("Only admins can add experiment members"));
        }

        // Add the members
        const addMembersResult = await this.experimentMemberRepository.addMembers(
          experimentId,
          members,
        );

        if (addMembersResult.isFailure()) {
          this.logger.error(`Failed to add members to experiment ${experimentId}`);
          return failure(AppError.internal("Failed to add experiment members"));
        }

        this.logger.log(
          `Successfully added members [${members
            .map((m) => m.userId)
            .join(", ")}] to experiment "${experiment.name}" (ID: ${experimentId})`,
        );

        // Send notifications to the added members
        const actorProfileResult =
          await this.experimentMemberRepository.findUserFullNameFromProfile(currentUserId);

        if (actorProfileResult.isFailure()) {
          this.logger.error(`Failed to retrieve profile for user ${currentUserId}`);
          return failure(AppError.internal("Failed to retrieve actor profile"));
        }

        this.logger.log("Current user id", currentUserId);
        const actor = actorProfileResult.value
          ? `${actorProfileResult.value.firstName} ${actorProfileResult.value.lastName}`
          : "Anonymous User";
        for (const addedMember of addMembersResult.value) {
          if (addedMember.user.email) {
            await this.emailPort.sendAddedUserNotification(
              experimentId,
              experiment.name,
              actor,
              addedMember.role,
              addedMember.user.email,
            );
          }
        }

        return success(addMembersResult.value);
      },
    );
  }
}
